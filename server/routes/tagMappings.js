const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const jp = require('jsonpath');

router.get('/log-source/:logSourceId', (req, res) => {
  try {
    const mappings = db.getTagMappings(req.params.logSourceId);
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const id = db.createTagMapping(req.body);
    res.status(201).json({ id, message: 'Tag mapping created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.deleteTagMapping(req.params.id);
    res.json({ message: 'Tag mapping deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test JSONPath expression on sample JSON
router.post('/test', (req, res) => {
  try {
    const { json_path, test_json } = req.body;

    if (!json_path || !test_json) {
      return res.status(400).json({
        success: false,
        error: 'Both json_path and test_json are required'
      });
    }

    let jsonData;
    try {
      jsonData = typeof test_json === 'string' ? JSON.parse(test_json) : test_json;
    } catch (parseError) {
      return res.json({
        success: false,
        error: 'Invalid JSON: ' + parseError.message
      });
    }

    try {
      const result = jp.query(jsonData, json_path);

      if (result.length === 0) {
        return res.json({
          success: false,
          message: 'JSONPath expression matched no values',
          result: null
        });
      }

      // Return the first match (or the match if only one)
      const value = result.length === 1 ? result[0] : result;

      res.json({
        success: true,
        result: value,
        type: typeof value,
        message: result.length > 1 ? `Matched ${result.length} values (showing all)` : 'Match found'
      });
    } catch (jpError) {
      res.json({
        success: false,
        error: 'Invalid JSONPath expression: ' + jpError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
