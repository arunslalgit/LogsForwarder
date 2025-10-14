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

router.post('/test', (req, res) => {
  try {
    const { pattern, test_sample } = req.body;
    const regex = new RegExp(pattern);
    const match = regex.exec(test_sample);

    if (!match) {
      return res.json({ success: false, message: 'No match found' });
    }

    let extracted = match[0];
    let parsed = null;
    let parseAttempts = [];

    // Debug logging
    console.log('=== REGEX TEST DEBUG ===');
    console.log('Extracted length:', extracted.length);
    console.log('First 100 chars:', extracted.substring(0, 100));
    console.log('Char codes (first 20):', extracted.substring(0, 20).split('').map((c, i) => `${i}:'${c}'=${c.charCodeAt(0)}`).join(', '));

    // Try parsing as-is
    try {
      parsed = JSON.parse(extracted);
      return res.json({ success: true, extracted, parsed });
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
        message: 'Parsed after double-unescaping'
      });
    } catch (e) {
      parseAttempts.push('Double unescape failed');
    }

    // If all parsing attempts fail
    res.json({
      success: true,
      extracted,
      parsed: null,
      message: `Not valid JSON (tried: ${parseAttempts.join(', ')})`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
