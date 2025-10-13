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
    try {
      const parsed = JSON.parse(extracted);
      res.json({ success: true, extracted, parsed });
    } catch (e) {
      res.json({ success: true, extracted, parsed: null, message: 'Not valid JSON' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
