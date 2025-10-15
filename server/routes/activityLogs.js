const express = require('express');
const router = express.Router();
const db = require('../db/queries');

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const logs = db.getActivityLogs(limit, offset);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/cleanup', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const deleted = db.deleteOldActivityLogs(days);

    res.json({
      success: true,
      deleted: deleted.changes,
      message: `Deleted ${deleted.changes} activity logs older than ${days} days`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
