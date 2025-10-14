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

module.exports = router;
