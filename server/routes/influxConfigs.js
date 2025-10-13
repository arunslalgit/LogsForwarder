const express = require('express');
const router = express.Router();
const db = require('../db/queries');

router.get('/', (req, res) => {
  try {
    const configs = db.getAllInfluxConfigs();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const config = db.getInfluxConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const id = db.createInfluxConfig(req.body);
    res.status(201).json({ id, message: 'InfluxDB config created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    db.updateInfluxConfig(req.params.id, req.body);
    res.json({ message: 'InfluxDB config updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.deleteInfluxConfig(req.params.id);
    res.json({ message: 'InfluxDB config deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
