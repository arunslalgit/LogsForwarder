const express = require('express');
const router = express.Router();

router.use('/log-sources', require('./logSources'));
router.use('/regex-patterns', require('./regexPatterns'));
router.use('/tag-mappings', require('./tagMappings'));
router.use('/influx-configs', require('./influxConfigs'));
router.use('/jobs', require('./jobs'));
router.use('/activity-logs', require('./activityLogs'));

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
