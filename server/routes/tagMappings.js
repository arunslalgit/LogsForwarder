const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { JSONPath } = require('jsonpath-plus');

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
      const result = JSONPath({ path: json_path, json: jsonData });

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
    const { log_source_id, test_json, measurement_name, timestamp, timestamp_format, sample_count } = req.body;

    if (!log_source_id || !test_json) {
      return res.status(400).json({
        success: false,
        error: 'log_source_id and test_json are required'
      });
    }

    // Support both single JSON object and array of samples
    let jsonDataArray;
    try {
      const parsed = typeof test_json === 'string' ? JSON.parse(test_json) : test_json;
      jsonDataArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      return res.json({
        success: false,
        error: 'Invalid JSON: ' + parseError.message
      });
    }

    // Limit number of samples to process (default: 1, max: 10)
    const limit = Math.min(sample_count || 1, 10);
    jsonDataArray = jsonDataArray.slice(0, limit);

    // Get all tag mappings for this log source
    const mappings = db.getTagMappings(log_source_id);

    if (mappings.length === 0) {
      return res.json({
        success: false,
        error: 'No tag mappings configured for this log source'
      });
    }

    // Process each sample JSON
    const lines = [];
    const measurementToUse = measurement_name || 'application_logs';
    const allErrors = [];
    let totalTagsExtracted = 0;
    let totalFieldsExtracted = 0;

    jsonDataArray.forEach((jsonData, sampleIndex) => {
      // Extract values from JSON using JSONPath
      const tags = {};
      const fields = {};
      const errors = [];

      mappings.forEach(mapping => {
        try {
          const result = JSONPath({ path: mapping.json_path, json: jsonData });
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
            errors.push(`Sample ${sampleIndex + 1}: No value found for ${mapping.influx_tag_name} at path ${mapping.json_path}`);
          }
        } catch (error) {
          errors.push(`Sample ${sampleIndex + 1}: Error extracting ${mapping.influx_tag_name}: ${error.message}`);
        }
      });

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
        allErrors.push(`Sample ${sampleIndex + 1}: No tags or fields could be extracted`);
        allErrors.push(...errors);
        return; // Skip this sample
      }

      // Add at least one field if none exist (InfluxDB requirement)
      const finalFieldSet = fieldSet || 'value=1';

      totalTagsExtracted += Object.keys(tags).length;
      totalFieldsExtracted += Object.keys(fields).length;
      allErrors.push(...errors);

      // Handle timestamp conversion for this sample
      // Check if jsonData has _timestamp field (from extraction), or use provided timestamp, or fallback to current time
      const sampleTimestamp = jsonData._timestamp || timestamp;
      let influxTimestamp;
      let timestampSource = 'current_time';
      let timestampValue = null;

      if (sampleTimestamp) {
        // User provided a timestamp or extracted from log - parse and convert
        timestampSource = jsonData._timestamp ? 'extracted' : 'provided';
        let parsedTime;

        // Try to parse the timestamp string
        if (typeof sampleTimestamp === 'string') {
          // Handle common timestamp formats
          if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{3})?/.test(sampleTimestamp)) {
            // ISO format or similar: 2025-10-14 13:02:11.175 or 2025-10-14T13:02:11.175Z
            parsedTime = new Date(sampleTimestamp.replace(' ', 'T')).getTime();
          } else if (/^\d+$/.test(sampleTimestamp)) {
            // Already a number in string format
            parsedTime = parseInt(sampleTimestamp, 10);
          } else {
            // Try general Date parsing
            parsedTime = new Date(sampleTimestamp).getTime();
          }
        } else if (typeof sampleTimestamp === 'number') {
          parsedTime = sampleTimestamp;
        } else {
          // Invalid timestamp, fall back to current time
          parsedTime = Date.now();
          timestampSource = 'current_time';
        }

        timestampValue = parsedTime;

        // Convert to requested format (default: nanoseconds)
        const format = timestamp_format || 'nanoseconds';
        if (format === 'milliseconds') {
          influxTimestamp = parsedTime; // Already in milliseconds
        } else if (format === 'seconds') {
          influxTimestamp = Math.floor(parsedTime / 1000);
        } else if (format === 'nanoseconds') {
          influxTimestamp = parsedTime * 1000000;
        } else {
          influxTimestamp = parsedTime * 1000000; // Default to nanoseconds
        }
      } else {
        // No timestamp provided - use current time with small increment for each sample
        const now = Date.now() + sampleIndex; // Add small offset for each sample
        timestampValue = now;
        const format = timestamp_format || 'nanoseconds';
        if (format === 'milliseconds') {
          influxTimestamp = now;
        } else if (format === 'seconds') {
          influxTimestamp = Math.floor(now / 1000);
        } else if (format === 'nanoseconds') {
          influxTimestamp = now * 1000000;
        } else {
          influxTimestamp = now * 1000000; // Default to nanoseconds
        }
      }

      // Construct line protocol
      const line = tagSet
        ? `${measurementToUse},${tagSet} ${finalFieldSet} ${influxTimestamp}`
        : `${measurementToUse} ${finalFieldSet} ${influxTimestamp}`;

      lines.push(line);
    }); // End forEach

    // Return response after processing all samples
    const firstTimestampSource = jsonDataArray[0]?._timestamp ? 'extracted' : (timestamp ? 'provided' : 'current_time');
    res.json({
      success: true,
      lines,
      samples_processed: lines.length,
      tags_extracted: totalTagsExtracted,
      fields_extracted: totalFieldsExtracted,
      timestamp_info: {
        source: firstTimestampSource,
        original_value: timestamp || jsonDataArray[0]?._timestamp || 'none',
        format: timestamp_format || 'nanoseconds',
        note: lines.length > 1 ? `Processed ${lines.length} samples` : 'Single sample processed'
      },
      extraction_errors: allErrors.length > 0 ? allErrors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
