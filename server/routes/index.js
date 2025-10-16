const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Public routes (no auth required)
router.use('/auth', require('./auth'));

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes (auth required)
router.use('/log-sources', requireAuth, require('./logSources'));
router.use('/regex-patterns', requireAuth, require('./regexPatterns'));
router.use('/tag-mappings', requireAuth, require('./tagMappings'));
router.use('/influx-configs', requireAuth, require('./influxConfigs'));
router.use('/jobs', requireAuth, require('./jobs'));
router.use('/activity-logs', requireAuth, require('./activityLogs'));
router.use('/sqlite-explorer', requireAuth, require('./sqliteExplorer'));

module.exports = router;
