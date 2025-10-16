const express = require('express');
const router = express.Router();
const db = require('../db/queries');

router.get('/log-source/:logSourceId', (req, res) => {
  try {
    const patterns = db.getRegexPatterns(req.params.logSourceId);
    res.json(patterns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const id = db.createRegexPattern(req.body);
    res.status(201).json({ id, message: 'Pattern created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    db.updateRegexPattern(req.params.id, req.body);
    res.json({ message: 'Pattern updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.deleteRegexPattern(req.params.id);
    res.json({ message: 'Pattern deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to extract complete JSON with balanced braces
function extractCompleteJSON(text, startIndex) {
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

router.post('/test', (req, res) => {
  try {
    const { pattern, test_sample } = req.body;
    const regex = new RegExp(pattern);
    const match = regex.exec(test_sample);

    if (!match) {
      return res.json({ success: false, message: 'No match found' });
    }

    // Extract all capture groups
    const allCaptures = {};
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        allCaptures[`group${i}`] = match[i];
      }
    }

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
        const completeJSON = extractCompleteJSON(test_sample, jsonStartIndex);
        if (completeJSON) {
          extracted = completeJSON;
          allCaptures.group2 = completeJSON; // Update the capture
        }
      }
    } else if (match[1]) {
      // Single group: use group 1
      extracted = match[1];

      // Same check for single group
      const startsWithBrace = extracted.startsWith('{') || extracted.startsWith('\\{') || extracted.includes('{');
      if (startsWithBrace) {
        const jsonStartIndex = match.index + match[0].indexOf(extracted);
        const completeJSON = extractCompleteJSON(test_sample, jsonStartIndex);
        if (completeJSON) {
          extracted = completeJSON;
          allCaptures.group1 = completeJSON;
        }
      }
    } else {
      // No groups: use full match
      extracted = match[0];
    }

    let parsed = null;
    let parseAttempts = [];

    // Try parsing as-is
    try {
      parsed = JSON.parse(extracted);
      return res.json({ success: true, extracted, parsed, captures: allCaptures });
    } catch (e) {
      parseAttempts.push('Direct parse failed');
    }

    // Try unescaping once (for strings like {\"key\":\"value\"})
    try {
      const unescaped = extracted.replace(/\\"/g, '"');
      parsed = JSON.parse(unescaped);
      return res.json({
        success: true,
        extracted,
        parsed,
        captures: allCaptures,
        message: 'Parsed after unescaping'
      });
    } catch (e) {
      parseAttempts.push('Unescape once failed');
    }

    // Try double-unescaping (for strings like {\\\"key\\\":\\\"value\\\"})
    try {
      const doubleUnescaped = extracted.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
      parsed = JSON.parse(doubleUnescaped);
      return res.json({
        success: true,
        extracted,
        parsed,
        captures: allCaptures,
        message: 'Parsed after double-unescaping'
      });
    } catch (e) {
      parseAttempts.push('Double unescape failed');
    }

    // If all parsing attempts fail, still return success with extracted value
    // (it might not be JSON, could be timestamp or other field)
    res.json({
      success: true,
      extracted,
      parsed: null,
      captures: allCaptures,
      message: `Not valid JSON (tried: ${parseAttempts.join(', ')})`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
