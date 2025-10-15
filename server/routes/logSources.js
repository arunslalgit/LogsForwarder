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

    if (!source_type || !['dynatrace', 'splunk', 'file'].includes(source_type)) {
      return res.status(400).json({ error: 'Invalid source_type' });
    }

    if (source_type === 'dynatrace' && (!req.body.dynatrace_url || !req.body.dynatrace_token)) {
      return res.status(400).json({ error: 'Dynatrace URL and token required' });
    }

    if (source_type === 'splunk' && (!req.body.splunk_url || !req.body.splunk_token)) {
      return res.status(400).json({ error: 'Splunk URL and token required' });
    }

    if (source_type === 'file' && !req.body.file_path) {
      return res.status(400).json({ error: 'File path required' });
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

    // Get time window from request body (in minutes, default 5)
    const timeWindowMinutes = req.body.timeWindowMinutes || 5;
    const timeWindowMs = timeWindowMinutes * 60000;

    // Get sample limit from request body (default 10, max 1000)
    const sampleLimit = Math.min(Math.max(1, req.body.sampleLimit || 10), 1000);

    const client = LogSourceFactory.createClient(logSource);
    const query = LogSourceFactory.getQueryFilter(logSource);

    let logs;
    if (logSource.source_type === 'splunk') {
      logs = await client.fetchLogs(
        query.searchQuery,
        new Date(Date.now() - timeWindowMs),
        new Date(),
        query.index
      );
    } else if (logSource.source_type === 'file') {
      logs = await client.fetchLogs(query, new Date(Date.now() - timeWindowMs), new Date(), null);
    } else {
      logs = await client.fetchLogs(query, new Date(Date.now() - timeWindowMs), new Date());
    }

    // Return up to requested sample limit
    const samples = logs.slice(0, sampleLimit);
    res.json({
      success: true,
      count: logs.length,
      samples: samples,
      samplesShown: samples.length,
      timeWindowMinutes
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test connection with unsaved configuration
router.post('/test-config', async (req, res) => {
  try {
    const config = req.body;

    if (!config.source_type || !['dynatrace', 'splunk', 'file'].includes(config.source_type)) {
      return res.status(400).json({ error: 'Invalid source_type' });
    }

    // Get time window from request body (in minutes, default 5)
    const timeWindowMinutes = config.timeWindowMinutes || 5;
    const timeWindowMs = timeWindowMinutes * 60000;

    // Get sample limit from request body (default 10, max 1000)
    const sampleLimit = Math.min(Math.max(1, config.sampleLimit || 10), 1000);

    const client = LogSourceFactory.createClient(config);
    const query = LogSourceFactory.getQueryFilter(config);

    let logs;
    if (config.source_type === 'splunk') {
      logs = await client.fetchLogs(
        query.searchQuery,
        new Date(Date.now() - timeWindowMs),
        new Date(),
        query.index
      );
    } else if (config.source_type === 'file') {
      logs = await client.fetchLogs(query, new Date(Date.now() - timeWindowMs), new Date(), null);
    } else {
      logs = await client.fetchLogs(query, new Date(Date.now() - timeWindowMs), new Date());
    }

    const samples = logs.slice(0, sampleLimit);
    res.json({
      success: true,
      count: logs.length,
      samples: samples,
      samplesShown: samples.length,
      timeWindowMinutes
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
