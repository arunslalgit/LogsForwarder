const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { LogSourceFactory } = require('../services/logSourceFactory');

router.get('/', (req, res) => {
  try {
    const sources = db.getAllLogSources();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const source = db.getLogSource(req.params.id);
    if (!source) {
      return res.status(404).json({ error: 'Log source not found' });
    }
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { source_type } = req.body;

    if (!source_type || !['dynatrace', 'splunk'].includes(source_type)) {
      return res.status(400).json({ error: 'Invalid source_type' });
    }

    if (source_type === 'dynatrace' && (!req.body.dynatrace_url || !req.body.dynatrace_token)) {
      return res.status(400).json({ error: 'Dynatrace URL and token required' });
    }

    if (source_type === 'splunk' && (!req.body.splunk_url || !req.body.splunk_token)) {
      return res.status(400).json({ error: 'Splunk URL and token required' });
    }

    const id = db.createLogSource(req.body);
    res.status(201).json({ id, message: 'Log source created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    db.updateLogSource(req.params.id, req.body);
    res.json({ message: 'Log source updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.deleteLogSource(req.params.id);
    res.json({ message: 'Log source deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const logSource = db.getLogSource(req.params.id);
    if (!logSource) {
      return res.status(404).json({ error: 'Log source not found' });
    }

    const client = LogSourceFactory.createClient(logSource);

    if (logSource.source_type === 'splunk') {
      const result = await client.testConnection();
      res.json(result);
    } else {
      const query = LogSourceFactory.getQueryFilter(logSource);
      const result = await client.fetchLogs(query, new Date(Date.now() - 60000), new Date());
      res.json({ success: true, count: result.length });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
