const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const { executeJob } = require('../services/scheduler');

router.get('/', (req, res) => {
  try {
    const jobs = db.getAllJobs();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { log_source_id, influx_config_id } = req.body;

    // Validate required fields
    if (!log_source_id || !influx_config_id) {
      return res.status(400).json({ error: 'log_source_id and influx_config_id are required' });
    }

    // Validate that log source exists
    const logSource = db.getLogSource(log_source_id);
    if (!logSource) {
      return res.status(404).json({ error: `Log source with id ${log_source_id} not found` });
    }

    // Validate that influx config exists
    const influxConfig = db.getInfluxConfig(influx_config_id);
    if (!influxConfig) {
      return res.status(404).json({ error: `InfluxDB config with id ${influx_config_id} not found` });
    }

    const id = db.createJob(req.body);
    res.status(201).json({ id, message: 'Job created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    db.updateJob(req.params.id, req.body);
    res.json({ message: 'Job updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.deleteJob(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual job execution
router.post('/:id/run', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const job = db.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Execute job asynchronously
    executeJob(job)
      .then(() => {
        console.log(`Manual job ${jobId} completed successfully`);
      })
      .catch(err => {
        console.error(`Manual job ${jobId} failed:`, err.message);
      });

    res.json({
      success: true,
      message: 'Job execution started. Check activity logs for results.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset job last_run time
router.post('/:id/reset-last-run', (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const { minutes } = req.body;

    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Minutes must be at least 1' });
    }

    const job = db.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Calculate new last_run time: NOW - minutes
    const newLastRun = new Date(Date.now() - (minutes * 60000));

    // Update job with new last_run
    const { getDatabase } = require('../db/init');
    const database = getDatabase();
    database.prepare('UPDATE jobs SET last_run = ? WHERE id = ?').run(newLastRun.toISOString(), jobId);

    console.log(`Job ${jobId} last_run reset to ${newLastRun.toISOString()} (${minutes} minutes ago)`);

    res.json({
      message: `Job last run reset to ${minutes} minutes ago`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
