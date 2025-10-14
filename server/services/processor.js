const jp = require('jsonpath');

class LogProcessor {
  constructor(regexPattern, tagMappings) {
    this.regex = new RegExp(regexPattern);
    this.tagMappings = tagMappings || [];
  }

  extractJSON(messageField) {
    if (!messageField) return null;

    const match = this.regex.exec(messageField);
    if (!match) return null;

    let jsonString = match[0] || match[1];

    // Try parsing as-is
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // Try unescaping once (for strings like {\"key\":\"value\"})
      try {
        const unescaped = jsonString.replace(/\\"/g, '"');
        return JSON.parse(unescaped);
      } catch (e2) {
        // Try double-unescaping (for strings like {\\\"key\\\":\\\"value\\\"})
        try {
          const doubleUnescaped = jsonString.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
          return JSON.parse(doubleUnescaped);
        } catch (e3) {
          console.error('JSON parse error after all unescape attempts:', e3.message);
          return null;
        }
      }
    }
  }

  mapToInflux(logEntry, jsonContent) {
    const tags = {};
    const fields = {};

    for (const mapping of this.tagMappings) {
      try {
        let value = jp.query(jsonContent, mapping.json_path)[0];

        if (value === undefined || value === null) continue;

        switch (mapping.data_type) {
          case 'integer':
            value = parseInt(value);
            break;
          case 'float':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = Boolean(value);
            break;
          default:
            value = String(value);
        }

        if (mapping.is_field) {
          fields[mapping.influx_tag_name] = value;
        } else {
          tags[mapping.influx_tag_name] = String(value);
        }
      } catch (error) {
        console.error(`Error processing mapping ${mapping.json_path}:`, error.message);
      }
    }

    if (Object.keys(fields).length === 0) {
      fields.value = 1;
    }

    return {
      tags,
      fields,
      timestamp: new Date(logEntry.timestamp)
    };
  }
}

module.exports = { LogProcessor };
