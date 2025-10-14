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

// Preview InfluxDB line protocol with sample data
router.post('/preview-influx', (req, res) => {
  try {
    const { log_source_id, test_json, measurement_name } = req.body;

    if (!log_source_id || !test_json) {
      return res.status(400).json({
        success: false,
        error: 'log_source_id and test_json are required'
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

    // Get all tag mappings for this log source
    const mappings = db.getTagMappings(log_source_id);

    if (mappings.length === 0) {
      return res.json({
        success: false,
        error: 'No tag mappings configured for this log source'
      });
    }

    // Extract values from JSON using JSONPath
    const tags = {};
    const fields = {};
    const errors = [];

    mappings.forEach(mapping => {
      try {
        const result = jp.query(jsonData, mapping.json_path);
        if (result.length > 0) {
          let value = result[0];

          // Convert value based on data type
          if (mapping.data_type === 'integer') {
            value = parseInt(value, 10);
          } else if (mapping.data_type === 'float') {
            value = parseFloat(value);
          } else if (mapping.data_type === 'boolean') {
            value = Boolean(value);
          } else {
            value = String(value);
          }

          if (mapping.is_field) {
            fields[mapping.influx_tag_name] = value;
          } else {
            tags[mapping.influx_tag_name] = value;
          }
        } else {
          errors.push(`No value found for ${mapping.influx_tag_name} at path ${mapping.json_path}`);
        }
      } catch (error) {
        errors.push(`Error extracting ${mapping.influx_tag_name}: ${error.message}`);
      }
    });

    // Build InfluxDB line protocol
    const lines = [];
    const measurementToUse = measurement_name || 'application_logs';

    // Build tag set
    const tagSet = Object.entries(tags)
      .map(([key, value]) => `${key}=${String(value).replace(/[ ,=]/g, '\\$&')}`)
      .join(',');

    // Build field set
    const fieldSet = Object.entries(fields)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value.replace(/"/g, '\\"')}"`;
        } else if (typeof value === 'boolean') {
          return `${key}=${value}`;
        } else {
          return `${key}=${value}`;
        }
      })
      .join(',');

    if (fieldSet === '' && tagSet === '') {
      return res.json({
        success: false,
        error: 'No tags or fields could be extracted from the JSON',
        extraction_errors: errors
      });
    }

    // Add at least one field if none exist (InfluxDB requirement)
    const finalFieldSet = fieldSet || 'value=1';

    // Construct line protocol
    const timestamp = Date.now() * 1000000; // nanoseconds
    const line = tagSet
      ? `${measurementToUse},${tagSet} ${finalFieldSet} ${timestamp}`
      : `${measurementToUse} ${finalFieldSet} ${timestamp}`;

    lines.push(line);

    res.json({
      success: true,
      lines,
      tags_extracted: Object.keys(tags).length,
      fields_extracted: Object.keys(fields).length,
      extraction_errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
