const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/init');

// Execute SQL query
router.post('/query', (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const db = getDatabase();

    // Determine if it's a SELECT query or other
    const isSelect = query.trim().toUpperCase().startsWith('SELECT') ||
                     query.trim().toUpperCase().startsWith('PRAGMA');

    if (isSelect) {
      const results = db.prepare(query).all();
      res.json({ results, rowCount: results.length });
    } else {
      const info = db.prepare(query).run();
      res.json({
        results: [],
        rowCount: 0,
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
        message: `Query executed successfully. ${info.changes} rows affected.`
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of all tables
router.get('/tables', (req, res) => {
  try {
    const db = getDatabase();
    const tables = db.prepare(`
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get schema for a specific table
router.get('/tables/:tableName/schema', (req, res) => {
  try {
    const db = getDatabase();
    const { tableName } = req.params;

    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    res.json(schema);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
