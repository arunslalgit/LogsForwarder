const express = require('express');
const router = express.Router();
const db = require('../db/queries');

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

module.exports = router;
