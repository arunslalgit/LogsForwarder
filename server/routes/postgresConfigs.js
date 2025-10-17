const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { Pool } = require('pg');

// Get all PostgreSQL configs
router.get('/', (req, res) => {
  try {
    const configs = db.getAllPostgresConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Error fetching PostgreSQL configs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single PostgreSQL config
router.get('/:id', (req, res) => {
  try {
    const config = db.getPostgresConfig(parseInt(req.params.id));
    if (!config) {
      return res.status(404).json({ error: 'PostgreSQL config not found' });
    }
    res.json(config);
  } catch (error) {
    console.error('Error fetching PostgreSQL config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create PostgreSQL config
router.post('/', (req, res) => {
  try {
    const { tag_columns_schema } = req.body;

    // Validate tag_columns_schema is valid JSON
    if (tag_columns_schema) {
      try {
        JSON.parse(tag_columns_schema);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid tag_columns_schema: must be valid JSON' });
      }
    }

    const id = db.createPostgresConfig(req.body);
    res.status(201).json({ id, message: 'PostgreSQL config created' });
  } catch (error) {
    console.error('Error creating PostgreSQL config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update PostgreSQL config
router.put('/:id', (req, res) => {
  try {
    const config = db.getPostgresConfig(parseInt(req.params.id));
    if (!config) {
      return res.status(404).json({ error: 'PostgreSQL config not found' });
    }

    const { tag_columns_schema } = req.body;

    // Validate tag_columns_schema if provided
    if (tag_columns_schema) {
      try {
        JSON.parse(tag_columns_schema);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid tag_columns_schema: must be valid JSON' });
      }
    }

    db.updatePostgresConfig(parseInt(req.params.id), req.body);
    res.json({ message: 'PostgreSQL config updated' });
  } catch (error) {
    console.error('Error updating PostgreSQL config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete PostgreSQL config
router.delete('/:id', (req, res) => {
  try {
    const config = db.getPostgresConfig(parseInt(req.params.id));
    if (!config) {
      return res.status(404).json({ error: 'PostgreSQL config not found' });
    }

    db.deletePostgresConfig(parseInt(req.params.id));
    res.json({ message: 'PostgreSQL config deleted' });
  } catch (error) {
    console.error('Error deleting PostgreSQL config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Recommend schema based on log source tag mappings
router.post('/recommend-schema', (req, res) => {
  try {
    const { log_source_id } = req.body;

    if (!log_source_id) {
      return res.status(400).json({ error: 'log_source_id is required' });
    }

    const tagMappings = db.getTagMappings(log_source_id);

    if (tagMappings.length === 0) {
      return res.status(400).json({
        error: 'No tag mappings found for this log source. Please configure tag mappings first.'
      });
    }

    // Build recommended schema from tag mappings
    const schema = tagMappings.map(mapping => {
      // Determine PostgreSQL type from data_type
      let pgType = 'TEXT';
      switch (mapping.data_type) {
        case 'integer':
          pgType = 'INTEGER';
          break;
        case 'float':
          pgType = 'REAL';
          break;
        case 'boolean':
          pgType = 'BOOLEAN';
          break;
        default:
          pgType = 'TEXT';
      }

      // Check if this is likely a timestamp field - use TIMESTAMPTZ for timestamp columns
      if (mapping.influx_tag_name.toLowerCase().includes('time') ||
          mapping.influx_tag_name.toLowerCase().includes('date')) {
        pgType = mapping.influx_tag_name.toLowerCase() === 'timestamp' ? 'TIMESTAMPTZ' : 'TIMESTAMP';
      }

      return {
        name: mapping.influx_tag_name,
        type: pgType,
        required: !mapping.is_field, // Tags are typically required, fields are optional
        indexed: !mapping.is_field // Index tags for faster queries
      };
    });

    // If no timestamp column exists, add one as first column
    const hasTimestamp = schema.some(col => col.name.toLowerCase() === 'timestamp');
    if (!hasTimestamp) {
      schema.unshift({
        name: 'timestamp',
        type: 'TIMESTAMPTZ',
        required: true,
        indexed: true
      });
    }

    res.json({
      success: true,
      schema: schema,
      tag_count: tagMappings.filter(m => !m.is_field).length,
      field_count: tagMappings.filter(m => m.is_field).length,
      message: `Generated schema with ${schema.length} columns from ${tagMappings.length} tag/field mappings`
    });
  } catch (error) {
    console.error('Error generating schema recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test PostgreSQL connection
router.post('/test-connection', async (req, res) => {
  const { host, port, database, username, password, schema_name, table_name } = req.body;

  if (!host || !database || !username) {
    return res.status(400).json({ error: 'Missing required fields: host, database, username' });
  }

  let pool;
  try {
    // Create temporary connection pool
    pool = new Pool({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
      connectionTimeoutMillis: 5000,
      max: 1
    });

    // Test connection
    const client = await pool.connect();

    // Check if schema exists
    const schemaCheck = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schema_name || 'public']
    );

    if (schemaCheck.rows.length === 0) {
      client.release();
      await pool.end();
      return res.status(400).json({
        error: `Schema '${schema_name || 'public'}' does not exist in database '${database}'`
      });
    }

    // Check if table exists (optional, since we might auto-create it)
    let tableExists = false;
    if (table_name) {
      const tableCheck = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2`,
        [schema_name || 'public', table_name]
      );
      tableExists = tableCheck.rows.length > 0;
    }

    client.release();
    await pool.end();

    res.json({
      success: true,
      message: 'Connection successful',
      schema_exists: true,
      table_exists: tableExists
    });
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error);
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
