const { Pool } = require('pg');
const format = require('pg-format');
const crypto = require('crypto');
const { getLogger } = require('../utils/logger');

/**
 * PostgreSQL client with batching and deduplication
 * Hybrid deduplication: in-memory cache + DB-level UNIQUE constraint
 */
class PostgresClient {
  constructor(config) {
    this.logger = getLogger();
    this.configId = config.id;
    this.configName = config.name;

    // PostgreSQL connection pool
    this.pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 10, // connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    this.schemaName = config.schema_name || 'public';
    this.tableName = config.table_name;
    this.dedupKeys = (config.dedup_keys || 'timestamp').split(',').map(k => k.trim());

    // Parse tag columns schema from JSON
    this.tagColumns = config.tag_columns_schema
      ? JSON.parse(config.tag_columns_schema)
      : [];

    // Batching configuration
    this.batch = [];
    this.batchSize = config.batch_size || 100;
    this.batchInterval = (config.batch_interval_seconds || 10) * 1000;

    // In-memory deduplication cache
    this.seenHashes = new Set();
    this.maxCacheSize = 10000;

    // Track flush errors for reporting to activity logs
    this.flushErrors = [];

    console.log(`[PostgresClient] Initializing for config "${config.name}" (ID: ${config.id})`);
    console.log(`[PostgresClient] Target: ${config.host}:${config.port}/${config.database}`);
    console.log(`[PostgresClient] Table: ${this.schemaName}.${this.tableName}`);
    console.log(`[PostgresClient] Tag columns: ${this.tagColumns.map(c => c.name).join(', ')}`);
    console.log(`[PostgresClient] Dedup keys: ${this.dedupKeys.join(', ')}`);

    this.logger.info('PostgresClient initialized', {
      configId: config.id,
      configName: config.name,
      host: config.host,
      database: config.database,
      table: `${this.schemaName}.${this.tableName}`,
      dedupKeys: this.dedupKeys
    });

    // Auto-create table if enabled
    if (config.auto_create_table) {
      this.ensureTableExists().catch(err => {
        console.error('[PostgresClient] Failed to create table:', err.message);
        this.logger.error('PostgresClient table creation failed', {
          configId: config.id,
          error: err.message
        });
      });
    }

    this.startBatchTimer();
  }

  /**
   * Ensure the target table exists with proper schema
   */
  async ensureTableExists() {
    try {
      // Build tag columns definition from user-defined schema with quoted identifiers
      const tagColumnsDef = this.tagColumns.map(col =>
        `  ${format.ident(col.name)} ${col.type}${col.required ? ' NOT NULL' : ''}`
      ).join(',\n');

      // Build unique constraint for deduplication with quoted column names
      const dedupConstraint = this.dedupKeys.length > 0
        ? `,\n  CONSTRAINT ${format.ident('uq_' + this.tableName + '_dedup')} UNIQUE (${this.dedupKeys.map(k => format.ident(k)).join(', ')})`
        : '';

      // Create table SQL - only user-defined columns, no automatic timestamp
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${format.ident(this.schemaName)}.${format.ident(this.tableName)} (
          id BIGSERIAL PRIMARY KEY,
${tagColumnsDef}${tagColumnsDef ? ',' : ''}
          fields JSONB,
          inserted_at TIMESTAMPTZ DEFAULT NOW()${dedupConstraint}
        );
      `;

      // Create standard indexes with quoted identifiers
      const createIndexesQuery = `
        CREATE INDEX IF NOT EXISTS ${format.ident('idx_' + this.tableName + '_fields')}
          ON ${format.ident(this.schemaName)}.${format.ident(this.tableName)} USING GIN (fields);

        CREATE INDEX IF NOT EXISTS ${format.ident('idx_' + this.tableName + '_inserted')}
          ON ${format.ident(this.schemaName)}.${format.ident(this.tableName)}(inserted_at DESC);
      `;

      // Create indexes on user-defined tag columns (including timestamp if user defined it)
      const tagIndexesQuery = this.tagColumns
        .filter(col => col.indexed)
        .map(col => `
          CREATE INDEX IF NOT EXISTS ${format.ident('idx_' + this.tableName + '_' + col.name)}
            ON ${format.ident(this.schemaName)}.${format.ident(this.tableName)}(${format.ident(col.name)})
            ${col.required ? '' : `WHERE ${format.ident(col.name)} IS NOT NULL`};
        `).join('\n');

      await this.pool.query(createTableQuery);
      await this.pool.query(createIndexesQuery);
      if (tagIndexesQuery) {
        await this.pool.query(tagIndexesQuery);
      }

      console.log(`[PostgresClient] ✓ Table ${this.schemaName}.${this.tableName} ensured`);
      this.logger.info('PostgresClient table ensured', {
        configId: this.configId,
        table: `${this.schemaName}.${this.tableName}`
      });
    } catch (error) {
      console.error(`[PostgresClient] Failed to ensure table:`, error.message);
      throw error;
    }
  }

  /**
   * Generate hash for deduplication from specified keys
   */
  generateHash(tags, timestamp) {
    const dedupValues = this.dedupKeys.map(key => {
      if (key === 'timestamp') return String(timestamp);
      return tags[key] || '';
    }).join('|');

    return crypto.createHash('md5').update(dedupValues).digest('hex');
  }

  /**
   * Add a point to the batch (with in-memory deduplication)
   */
  add(point) {
    const { tags, fields, timestamp } = point;

    // In-memory deduplication check (fast path)
    const hash = this.generateHash(tags, timestamp);
    if (this.seenHashes.has(hash)) {
      console.log(`[PostgresClient] Skipping duplicate: ${hash.substring(0, 8)}...`);
      return;
    }

    this.seenHashes.add(hash);

    // Clean cache if too large (remove oldest half)
    if (this.seenHashes.size > this.maxCacheSize) {
      const toDelete = Array.from(this.seenHashes).slice(0, this.maxCacheSize / 2);
      toDelete.forEach(h => this.seenHashes.delete(h));
      console.log(`[PostgresClient] Cleaned dedup cache: ${toDelete.length} entries removed`);
    }

    this.batch.push({ tags, fields, timestamp });

    if (this.batch.length >= this.batchSize) {
      console.log(`[PostgresClient] Batch size reached (${this.batch.length}), triggering flush`);
      this.flush().catch(err => {
        console.error(`[PostgresClient] Auto-flush error:`, err.message);
        // Track error for later reporting to activity logs
        this.flushErrors.push({
          timestamp: new Date().toISOString(),
          error: err.message,
          batchSize: this.batch.length
        });
      });
    }
  }

  /**
   * Flush the batch to PostgreSQL with ON CONFLICT handling
   */
  async flush() {
    // If there are accumulated errors from previous flushes, throw them first
    if (this.flushErrors.length > 0 && this.batch.length === 0) {
      const errorSummary = `PostgreSQL encountered ${this.flushErrors.length} flush error(s): ${this.flushErrors[0].error}`;
      const allErrors = this.flushErrors.slice(); // Copy for error details
      this.flushErrors = []; // Clear errors
      const error = new Error(errorSummary);
      error.details = allErrors;
      throw error;
    }

    if (this.batch.length === 0) return;

    const batchSize = this.batch.length;
    console.log(`[PostgresClient] Flushing ${batchSize} records to PostgreSQL...`);

    try {
      // Build column lists from user-defined schema + fields
      const tagColumnNames = this.tagColumns.map(col => col.name);
      const allColumns = [...tagColumnNames, 'fields'];

      // Build values array
      const values = this.batch.map(record => {
        const row = [
          ...tagColumnNames.map(colName => {
            // Special handling for timestamp column - use record.timestamp
            if (colName.toLowerCase() === 'timestamp') {
              return record.timestamp;
            }
            return record.tags[colName] || null;
          }), // tag columns
          JSON.stringify(record.fields) // fields as JSONB
        ];
        return row;
      });

      // Use pg-format for safe SQL generation with ON CONFLICT for deduplication
      // Quote dedup keys for conflict clause
      const dedupClause = this.dedupKeys.length > 0
        ? `ON CONFLICT (${this.dedupKeys.map(k => format.ident(k)).join(', ')}) DO NOTHING`
        : '';

      // Build column list with proper quoting
      const columnsList = allColumns.map(col => format.ident(col)).join(', ');

      const query = format(
        'INSERT INTO %I.%I (%s) VALUES %L %s',
        this.schemaName,
        this.tableName,
        columnsList,
        values,
        dedupClause
      );

      const result = await this.pool.query(query);

      const inserted = result.rowCount;
      const duplicates = batchSize - inserted;

      console.log(`[PostgresClient] ✓ Flushed ${batchSize} records (${inserted} inserted, ${duplicates} duplicates skipped)`);

      this.logger.info('PostgreSQL batch written', {
        configId: this.configId,
        configName: this.configName,
        batchSize: batchSize,
        inserted: inserted,
        duplicatesSkipped: duplicates
      });

      this.batch = [];
    } catch (error) {
      console.error(`[PostgresClient] ✗ Flush failed:`, error.message);
      this.logger.error('PostgreSQL flush failed', {
        configId: this.configId,
        error: error.message,
        stack: error.stack,
        batchSize: batchSize
      });

      // Don't clear batch on error - will retry on next flush
      throw error;
    }
  }

  /**
   * Start the batch timer for periodic flushing
   */
  startBatchTimer() {
    // Clear any existing timer to prevent memory leaks
    if (this.timer) {
      console.log(`[PostgresClient] Clearing existing timer before starting new one`);
      clearInterval(this.timer);
    }

    console.log(`[PostgresClient] Starting batch timer (interval: ${this.batchInterval}ms)`);
    this.timer = setInterval(() => {
      if (this.batch.length > 0) {
        console.log(`[PostgresClient] Timer triggered flush (${this.batch.length} points pending)`);
      }
      this.flush().catch(err => {
        console.error(`[PostgresClient] Batch timer flush error:`, err.message);
        this.logger.error('PostgreSQL batch timer flush failed', {
          configId: this.configId,
          error: err.message
        });
        // Track error for later reporting to activity logs
        this.flushErrors.push({
          timestamp: new Date().toISOString(),
          error: err.message,
          source: 'timer'
        });
      });
    }, this.batchInterval);
  }

  /**
   * Stop the client and flush remaining data
   */
  async stop() {
    console.log(`[PostgresClient] Stopping client for ${this.configName}`);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.flush();
    await this.pool.end();

    this.logger.info('PostgresClient stopped', {
      configId: this.configId,
      configName: this.configName
    });
  }

  /**
   * Destructor-like cleanup method
   */
  destroy() {
    console.log(`[PostgresClient] Destroying client for ${this.configName}`);
    this.stop();
  }

  /**
   * Test the PostgreSQL connection
   */
  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW() as server_time, version() as version');
      return {
        success: true,
        serverTime: result.rows[0].server_time,
        version: result.rows[0].version
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { PostgresClient };
