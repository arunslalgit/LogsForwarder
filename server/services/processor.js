const { JSONPath } = require('jsonpath-plus');

class LogProcessor {
  constructor(regexPattern, tagMappings) {
    this.regex = new RegExp(regexPattern);
    this.tagMappings = tagMappings || [];
  }

  // Helper function to extract complete JSON with balanced braces
  extractCompleteJSON(text, startIndex) {
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Found the matching closing brace
            return text.substring(startIndex, i + 1);
          }
        }
      }
    }

    return null; // Unbalanced braces
  }

  extractJSON(messageField) {
    if (!messageField) return null;

    const match = this.regex.exec(messageField);
    if (!match) return null;

    // For multi-group patterns (timestamp + JSON), prioritize Group 2 for JSON extraction
    // Group 1 is typically timestamp, Group 2 is typically JSON
    let extracted;
    if (match[2]) {
      // Multiple groups: prefer group 2 for JSON extraction
      extracted = match[2];

      // If it starts with { or \{, always try to extract complete balanced JSON
      const startsWithBrace = extracted.startsWith('{') || extracted.startsWith('\\{') || extracted.includes('{');
      if (startsWithBrace) {
        // Find where the JSON actually starts in the original text
        const jsonStartIndex = match.index + match[0].indexOf(extracted);
        const completeJSON = this.extractCompleteJSON(messageField, jsonStartIndex);
        if (completeJSON) {
          console.log(`Processor: Extracted complete JSON: ${completeJSON.length} chars (was ${extracted.length} chars)`);
          extracted = completeJSON;
        }
      }
    } else if (match[1]) {
      // Single group pattern
      extracted = match[1];

      // If it starts with { or \{, try to extract complete balanced JSON
      const startsWithBrace = extracted.startsWith('{') || extracted.startsWith('\\{') || extracted.includes('{');
      if (startsWithBrace) {
        const jsonStartIndex = match.index + match[0].indexOf(extracted);
        const completeJSON = this.extractCompleteJSON(messageField, jsonStartIndex);
        if (completeJSON) {
          console.log(`Processor: Extracted complete JSON: ${completeJSON.length} chars (was ${extracted.length} chars)`);
          extracted = completeJSON;
        }
      }
    } else {
      // No capture groups, use full match
      extracted = match[0];
    }

    let jsonString = extracted;

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
        let value;

        // Check if this is a static tag/field
        if (mapping.is_static) {
          value = mapping.static_value;
        } else {
          // Extract value using JSONPath
          value = JSONPath({ path: mapping.json_path, json: jsonContent })[0];
          
          if (value === undefined || value === null) continue;

          // Apply regex transformation if specified
          if (mapping.transform_regex) {
            try {
              const regex = new RegExp(mapping.transform_regex, 'g');
              value = String(value).replace(regex, '');
            } catch (regexError) {
              console.error(`Invalid transform regex for ${mapping.influx_tag_name}:`, regexError.message);
            }
          }
        }

        if (value === undefined || value === null || value === '') continue;

        // Convert to appropriate data type
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
        console.error(`Error processing mapping ${mapping.influx_tag_name}:`, error.message);
      }
    }

    if (Object.keys(fields).length === 0) {
      fields.value = 1;
    }

    return {
      tags,
      fields,
      timestamp: logEntry.timestamp || new Date()
    };
  }

}

module.exports = { LogProcessor };
