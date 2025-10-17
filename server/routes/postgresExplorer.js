const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { Pool } = require('pg');

// Execute PostgreSQL query
router.post('/query', async (req, res) => {
  const { postgres_config_id, query } = req.body;

  if (!postgres_config_id || !query) {
    return res.status(400).json({ error: 'postgres_config_id and query are required' });
  }

  let pool;
  try {
    const config = db.getPostgresConfig(postgres_config_id);
    if (!config) {
      return res.status(404).json({ error: 'PostgreSQL config not found' });
    }

    pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 1,
      connectionTimeoutMillis: 5000
    });

    const result = await pool.query(query);

    await pool.end();

    res.json({
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({ name: f.name, dataType: f.dataTypeID }))
    });
  } catch (error) {
    console.error('PostgreSQL query error:', error);
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

// Get schemas
router.post('/schemas', async (req, res) => {
  const { postgres_config_id } = req.body;

  if (!postgres_config_id) {
    return res.status(400).json({ error: 'postgres_config_id is required' });
  }

  let pool;
  try {
    const config = db.getPostgresConfig(postgres_config_id);
    if (!config) {
      return res.status(404).json({ error: 'PostgreSQL config not found' });
    }

    pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 1,
      connectionTimeoutMillis: 5000
    });

    const result = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `);

    await pool.end();

    res.json({
      success: true,
      schemas: result.rows.map(r => r.schema_name)
    });
  } catch (error) {
    console.error('PostgreSQL schemas error:', error);
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

// Get tables
router.post('/tables', async (req, res) => {
  const { postgres_config_id, schema_name } = req.body;

  if (!postgres_config_id) {
    return res.status(400).json({ error: 'postgres_config_id is required' });
  }

  let pool;
  try {
    const config = db.getPostgresConfig(postgres_config_id);
    if (!config) {
      return res.status(404).json({ error: 'PostgreSQL config not found' });
    }

    pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 1,
      connectionTimeoutMillis: 5000
    });

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema_name || 'public']);

    await pool.end();

    res.json({
      success: true,
      tables: result.rows.map(r => r.table_name)
    });
  } catch (error) {
    console.error('PostgreSQL tables error:', error);
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
