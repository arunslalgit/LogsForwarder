const cron = require('node-cron');
const db = require('../db/queries');
const { LogSourceFactory } = require('./logSourceFactory');
const { LogProcessor } = require('./processor');
const { InfluxClient } = require('./influxClient');

const activeTasks = new Map();

function startScheduler() {
  console.log('Loading scheduled jobs...');

  const jobs = db.getEnabledJobs();
  console.log(`Found ${jobs.length} enabled jobs`);

  for (const job of jobs) {
    try {
      scheduleJob(job);
      console.log(`✓ Scheduled job ${job.id}: ${job.cron_schedule}`);
    } catch (error) {
      console.error(`Failed to schedule job ${job.id}:`, error.message);
    }
  }
}

function scheduleJob(job) {
  if (activeTasks.has(job.id)) {
    activeTasks.get(job.id).stop();
  }

  const task = cron.schedule(job.cron_schedule, () => {
    executeJob(job).catch(err => {
      console.error(`Job ${job.id} execution error:`, err.message);
    });
  });

  activeTasks.set(job.id, task);
}

async function executeJob(job) {
  console.log(`Executing job ${job.id}...`);

  const logSource = db.getLogSource(job.log_source_id);
  if (!logSource || !logSource.enabled) {
    console.log(`Job ${job.id} skipped: log source disabled or not found`);
    return;
  }

  const influxConfig = db.getInfluxConfig(job.influx_config_id);
  if (!influxConfig || !influxConfig.enabled) {
    console.log(`Job ${job.id} skipped: InfluxDB config disabled or not found`);
    return;
  }

  const regexPatterns = db.getRegexPatterns(job.log_source_id);
  if (regexPatterns.length === 0) {
    db.logActivity(job.id, 'warning', 'No regex pattern configured', 0, 0);
    return;
  }

  const tagMappings = db.getTagMappings(job.log_source_id);
  if (tagMappings.length === 0) {
    db.logActivity(job.id, 'warning', 'No tag mappings configured', 0, 0);
    return;
  }

  try {
    const sourceClient = LogSourceFactory.createClient(logSource);
    const queryFilter = LogSourceFactory.getQueryFilter(logSource);
    const influxClient = new InfluxClient(influxConfig);
    const processor = new LogProcessor(regexPatterns[0].pattern, tagMappings);

    const lookbackMs = (job.lookback_minutes || 5) * 60000;
    // Apply lookback offset to avoid data gaps
    // If last_run exists, subtract lookback to create overlap; otherwise go back by lookback
    const lastRun = job.last_run
      ? new Date(new Date(job.last_run).getTime() - lookbackMs)
      : new Date(Date.now() - lookbackMs);
    const now = new Date();

    let logs;
    if (logSource.source_type === 'dynatrace') {
      logs = await sourceClient.fetchLogs(queryFilter, lastRun, now);
    } else if (logSource.source_type === 'splunk') {
      logs = await sourceClient.fetchLogs(
        queryFilter.searchQuery,
        lastRun,
        now,
        queryFilter.index
      );
    }

    console.log(`Fetched ${logs.length} logs from ${logSource.source_type}`);

    let processed = 0;
    let failed = 0;

    for (const log of logs) {
      try {
        const jsonContent = processor.extractJSON(log.message);
        if (!jsonContent) {
          failed++;
          continue;
        }

        const influxPoint = processor.mapToInflux(log, jsonContent);
        influxClient.add(influxPoint);
        processed++;
      } catch (error) {
        console.error('Error processing log:', error.message);
        failed++;
      }
    }

    await influxClient.flush();

    db.updateJobRun(job.id, true);
    db.logActivity(
      job.id,
      'info',
      `[${logSource.source_type.toUpperCase()}] Processed ${processed} logs, ${failed} failed`,
      processed,
      failed
    );

    console.log(`Job ${job.id} completed: ${processed} processed, ${failed} failed`);

  } catch (error) {
    console.error(`Job ${job.id} error:`, error.message);
    db.logActivity(job.id, 'error', error.message, 0, 0);
  }
}

module.exports = { startScheduler, scheduleJob, executeJob };
