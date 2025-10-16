const cron = require('node-cron');
const db = require('../db/queries');
const { LogSourceFactory } = require('./logSourceFactory');
const { LogProcessor } = require('./processor');
const { InfluxClient } = require('./influxClient');
const { getLogger } = require('../utils/logger');

const activeTasks = new Map();

function startScheduler() {
  const logger = getLogger();
  console.log('Loading scheduled jobs...');
  logger.info('Loading scheduled jobs...');

  const jobs = db.getEnabledJobs();
  console.log(`Found ${jobs.length} enabled jobs`);
  logger.info(`Found ${jobs.length} enabled jobs`);

  for (const job of jobs) {
    try {
      scheduleJob(job);
      console.log(`✓ Scheduled job ${job.id}: ${job.cron_schedule}`);
      logger.info(`Scheduled job`, { jobId: job.id, schedule: job.cron_schedule });
    } catch (error) {
      console.error(`Failed to schedule job ${job.id}:`, error.message);
      logger.error(`Failed to schedule job`, { jobId: job.id, error: error.message });
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
  const logger = getLogger();
  console.log(`Executing job ${job.id}...`);
  logger.info(`Executing job`, { jobId: job.id });

  const logSource = db.getLogSource(job.log_source_id);
  if (!logSource || !logSource.enabled) {
    console.log(`Job ${job.id} skipped: log source disabled or not found`);
    logger.warn(`Job skipped: log source disabled or not found`, { jobId: job.id });
    return;
  }

  const influxConfig = db.getInfluxConfig(job.influx_config_id);
  if (!influxConfig || !influxConfig.enabled) {
    console.log(`Job ${job.id} skipped: InfluxDB config disabled or not found`);
    logger.warn(`Job skipped: InfluxDB config disabled or not found`, { jobId: job.id });
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
    // InfluxDB config already has timestamp_format, just pass it through
    const influxClient = new InfluxClient(influxConfig);
    const processor = new LogProcessor(regexPatterns[0].pattern, tagMappings);

    const lookbackMs = (job.lookback_minutes || 5) * 60000;
    const now = new Date();

    // Calculate query time window
    // If this is the first run, query from (now - lookback) to now
    // If not first run, query from (last_run - lookback) to now to create overlap buffer
    let queryStart;
    if (!job.last_run) {
      // First run: query lookback minutes from now
      queryStart = new Date(now.getTime() - lookbackMs);
      console.log(`Job ${job.id} - First run: querying from ${queryStart.toISOString()} to ${now.toISOString()} (${job.lookback_minutes || 5} min window)`);
    } else {
      // Subsequent runs: start from last_run minus lookback to create overlap
      const lastRunTime = new Date(job.last_run);
      queryStart = new Date(lastRunTime.getTime() - lookbackMs);
      const windowMinutes = Math.round((now.getTime() - queryStart.getTime()) / 60000);
      console.log(`Job ${job.id} - Query window: ${queryStart.toISOString()} to ${now.toISOString()} (~${windowMinutes} min, ${job.lookback_minutes || 5} min overlap)`);
    }

    let logs;
    if (logSource.source_type === 'dynatrace') {
      logs = await sourceClient.fetchLogs(queryFilter, queryStart, now);
    } else if (logSource.source_type === 'splunk') {
      logs = await sourceClient.fetchLogs(
        queryFilter.searchQuery,
        queryStart,
        now,
        queryFilter.index
      );
    } else if (logSource.source_type === 'file') {
      logs = await sourceClient.fetchLogs(queryFilter, queryStart, now, null);
    }

    console.log(`Fetched ${logs.length} logs from ${logSource.source_type}`);
    logger.info(`Fetched logs from source`, {
      jobId: job.id,
      sourceType: logSource.source_type,
      logCount: logs.length
    });

    let processed = 0;
    let failed = 0;
    const failureDetails = [];

    for (const log of logs) {
      try {
        const jsonContent = processor.extractJSON(log.message);
        if (!jsonContent) {
          failed++;
          failureDetails.push({
            reason: 'JSON extraction failed',
            log_message: log.message.substring(0, 500), // First 500 chars
            timestamp: log.timestamp
          });
          continue;
        }

        const influxPoint = processor.mapToInflux(log, jsonContent);
        influxClient.add(influxPoint);
        processed++;
      } catch (error) {
        console.error('Error processing log:', error.message);
        failed++;
        failureDetails.push({
          reason: error.message,
          log_message: log.message.substring(0, 500),
          timestamp: log.timestamp,
          stack: error.stack
        });
      }
    }

    // Flush remaining points to InfluxDB
    try {
      await influxClient.flush();
    } catch (flushError) {
      console.error(`InfluxDB flush error for job ${job.id}:`, flushError.message);
      logger.error(`InfluxDB flush failed`, {
        jobId: job.id,
        error: flushError.message,
        stack: flushError.stack
      });
      throw flushError; // Re-throw to be caught by outer catch
    }

    db.updateJobRun(job.id, true);

    // Include failure details if any failures occurred
    const details = failed > 0 ? {
      total_fetched: logs.length,
      sample_failures: failureDetails.slice(0, 5), // First 5 failures
      log_source: logSource.name,
      influx_config: influxConfig.name,
      query_window: {
        start: queryStart.toISOString(),
        end: now.toISOString()
      }
    } : null;

    db.logActivity(
      job.id,
      'info',
      `[${logSource.source_type.toUpperCase()}] Processed ${processed} logs, ${failed} failed`,
      processed,
      failed,
      details
    );

    console.log(`Job ${job.id} completed: ${processed} processed, ${failed} failed`);
    logger.info(`Job completed`, {
      jobId: job.id,
      processed,
      failed,
      successRate: processed > 0 ? ((processed / (processed + failed)) * 100).toFixed(2) + '%' : '0%'
    });

  } catch (error) {
    console.error(`Job ${job.id} error:`, error.message);

    const errorDetails = {
      error_type: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      job_config: {
        log_source_id: job.log_source_id,
        log_source_name: logSource?.name,
        influx_config_id: job.influx_config_id,
        influx_config_name: influxConfig?.name,
        lookback_minutes: job.lookback_minutes || 5
      }
    };

    db.logActivity(job.id, 'error', error.message, 0, 0, errorDetails);
  }
}

module.exports = { startScheduler, scheduleJob, executeJob };
