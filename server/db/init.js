const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { SCHEMA } = require('./schema');

let db = null;

function initDatabase(rootDir) {
  const dbPath = rootDir
    ? path.join(rootDir, 'data.db')
    : path.join(__dirname, '../../data.db');

  console.log('Database path:', dbPath);

  db = new Database(dbPath, { verbose: process.env.DEBUG ? console.log : null });
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  runMigrations(db);

  const settingsCheck = db.prepare('SELECT COUNT(*) as count FROM app_settings').get();
  if (settingsCheck.count === 0) {
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES
      ('version', '3.0'),
      ('initialized_at', datetime('now'))
    `).run();
    console.log('✓ Database initialized (first run)');
  } else {
    console.log('✓ Database connected (existing)');
  }

  ensureAdminUser(db);

  console.log('✓ Database ready at', dbPath);
  return db;
}

function runMigrations(db) {
  // Migration: Add details column to activity_logs
  try {
    const tableInfo = db.prepare("PRAGMA table_info(activity_logs)").all();
    const hasDetailsColumn = tableInfo.some(col => col.name === 'details');

    if (!hasDetailsColumn) {
      console.log('Running migration: Adding details column to activity_logs');
      db.prepare('ALTER TABLE activity_logs ADD COLUMN details TEXT').run();
      console.log('✓ Migration completed');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }

  // Migration: Add static tag/field and regex transformation columns
  try {
    const tagMappingsInfo = db.prepare("PRAGMA table_info(tag_mappings)").all();
    const hasIsStatic = tagMappingsInfo.some(col => col.name === 'is_static');
    const hasStaticValue = tagMappingsInfo.some(col => col.name === 'static_value');
    const hasTransformRegex = tagMappingsInfo.some(col => col.name === 'transform_regex');

    if (!hasIsStatic) {
      console.log('Running migration: Adding is_static column to tag_mappings');
      db.prepare('ALTER TABLE tag_mappings ADD COLUMN is_static INTEGER DEFAULT 0').run();
    }
    if (!hasStaticValue) {
      console.log('Running migration: Adding static_value column to tag_mappings');
      db.prepare('ALTER TABLE tag_mappings ADD COLUMN static_value TEXT').run();
    }
    if (!hasTransformRegex) {
      console.log('Running migration: Adding transform_regex column to tag_mappings');
      db.prepare('ALTER TABLE tag_mappings ADD COLUMN transform_regex TEXT').run();
    }

    if (!hasIsStatic || !hasStaticValue || !hasTransformRegex) {
      console.log('✓ Tag mappings migration completed');
    }
  } catch (error) {
    console.error('Tag mappings migration error:', error.message);
  }

  // Migration: Add timestamp_format column to influx_configs (moved from log_sources)
  try {
    const influxConfigsInfo = db.prepare("PRAGMA table_info(influx_configs)").all();
    const hasTimestampFormat = influxConfigsInfo.some(col => col.name === 'timestamp_format');

    if (!hasTimestampFormat) {
      console.log('Running migration: Adding timestamp_format column to influx_configs');
      db.prepare("ALTER TABLE influx_configs ADD COLUMN timestamp_format TEXT DEFAULT 'nanoseconds'").run();
      console.log('✓ Timestamp format migration completed');
    }
  } catch (error) {
    console.error('Timestamp format migration error:', error.message);
  }

  // Migration: Add max_lookback_minutes column to jobs
  try {
    const jobsInfo = db.prepare("PRAGMA table_info(jobs)").all();
    const hasMaxLookback = jobsInfo.some(col => col.name === 'max_lookback_minutes');

    if (!hasMaxLookback) {
      console.log('Running migration: Adding max_lookback_minutes column to jobs');
      db.prepare("ALTER TABLE jobs ADD COLUMN max_lookback_minutes INTEGER DEFAULT 30").run();
      console.log('✓ Max lookback migration completed');
    }
  } catch (error) {
    console.error('Max lookback migration error:', error.message);
  }

  // Migration: Add PostgreSQL destination support to jobs
  try {
    const jobsInfo = db.prepare("PRAGMA table_info(jobs)").all();
    const hasDestinationType = jobsInfo.some(col => col.name === 'destination_type');
    const hasPostgresConfigId = jobsInfo.some(col => col.name === 'postgres_config_id');
    const influxConfigIdCol = jobsInfo.find(col => col.name === 'influx_config_id');

    if (!hasDestinationType) {
      console.log('Running migration: Adding destination_type column to jobs');
      db.prepare("ALTER TABLE jobs ADD COLUMN destination_type TEXT DEFAULT 'influxdb' CHECK(destination_type IN ('influxdb', 'postgresql'))").run();
    }
    if (!hasPostgresConfigId) {
      console.log('Running migration: Adding postgres_config_id column to jobs');
      db.prepare("ALTER TABLE jobs ADD COLUMN postgres_config_id INTEGER REFERENCES postgres_configs(id)").run();
    }

    // Migration: Make influx_config_id nullable (SQLite doesn't support ALTER COLUMN, so recreate table)
    if (influxConfigIdCol && influxConfigIdCol.notnull === 1) {
      console.log('Running migration: Making influx_config_id nullable in jobs table');

      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      db.exec(`
        BEGIN TRANSACTION;

        -- Create new table with nullable influx_config_id
        CREATE TABLE jobs_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          log_source_id INTEGER NOT NULL,
          destination_type TEXT NOT NULL DEFAULT 'influxdb' CHECK(destination_type IN ('influxdb', 'postgresql')),
          influx_config_id INTEGER,
          postgres_config_id INTEGER,
          cron_schedule TEXT DEFAULT '*/5 * * * *',
          lookback_minutes INTEGER DEFAULT 5,
          max_lookback_minutes INTEGER DEFAULT 30,
          last_run TEXT,
          last_success TEXT,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (log_source_id) REFERENCES log_sources(id) ON DELETE CASCADE,
          FOREIGN KEY (influx_config_id) REFERENCES influx_configs(id) ON DELETE CASCADE,
          FOREIGN KEY (postgres_config_id) REFERENCES postgres_configs(id) ON DELETE CASCADE
        );

        -- Copy data from old table
        INSERT INTO jobs_new SELECT * FROM jobs;

        -- Drop old table and rename new table
        DROP TABLE jobs;
        ALTER TABLE jobs_new RENAME TO jobs;

        -- Recreate index
        CREATE INDEX IF NOT EXISTS idx_jobs_enabled ON jobs(enabled);

        COMMIT;
      `);

      console.log('✓ influx_config_id is now nullable');
    }

    if (!hasDestinationType || !hasPostgresConfigId) {
      console.log('✓ PostgreSQL destination migration completed');
    }
  } catch (error) {
    console.error('PostgreSQL destination migration error:', error.message);
  }
}

function ensureAdminUser(db) {
  try {
    const adminCheck = db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE username = ?').get('admin');

    if (adminCheck.count === 0) {
      // Use environment variable or generate random password
      const defaultPassword = process.env.ADMIN_PASSWORD || generateRandomPassword();
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      db.prepare(`
        INSERT INTO admin_users (username, password_hash)
        VALUES (?, ?)
      `).run('admin', passwordHash);

      if (process.env.ADMIN_PASSWORD) {
        console.log('✓ Default admin user created (username: admin, password: from ADMIN_PASSWORD env var)');
      } else {
        console.log('✓ Default admin user created (username: admin, password: ' + defaultPassword + ')');
        console.log('⚠️  IMPORTANT: Save this password! Set ADMIN_PASSWORD env var to customize.');
      }
    }
  } catch (error) {
    console.error('Error ensuring admin user:', error.message);
  }
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
