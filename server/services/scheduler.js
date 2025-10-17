const cron = require('node-cron');
const db = require('../db/queries');
const { LogSourceFactory } = require('./logSourceFactory');
const { LogProcessor } = require('./processor');
const { InfluxClient } = require('./influxClient');
const { PostgresClient } = require('./postgresClient');
const { getLogger } = require('../utils/logger');

const activeTasks = new Map();
const runningJobs = new Map(); // Track currently executing jobs to prevent concurrent runs

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
  const jobStart = Date.now();

  // Declare these in function scope so they're available in catch/finally blocks
  let logSource, destinationType, destinationConfig, destinationClient;

  // Check if job is already running
  if (runningJobs.has(job.id)) {
    const runningStartTime = runningJobs.get(job.id);
    const runningSince = Date.now() - runningStartTime;
    console.log(`[Scheduler] ⚠️  Job ${job.id} is already running (started ${Math.floor(runningSince / 1000)}s ago), skipping this execution`);
    logger.warn(`Job execution skipped - already running`, {
      jobId: job.id,
      runningSinceMs: runningSince
    });
    return;
  }

  try {
    // Mark job as running
    runningJobs.set(job.id, jobStart);

    console.log(`\n========== JOB EXECUTION START ==========`);
    console.log(`[Scheduler] Job ID: ${job.id}`);
    console.log(`[Scheduler] Cron: ${job.cron_schedule}`);
    console.log(`[Scheduler] Start Time: ${new Date().toISOString()}`);
    logger.info(`Job execution started`, {
      jobId: job.id,
      cronSchedule: job.cron_schedule,
      logSourceId: job.log_source_id,
      influxConfigId: job.influx_config_id
    });

    logSource = db.getLogSource(job.log_source_id);
    if (!logSource || !logSource.enabled) {
      console.log(`[Scheduler] ✗ Job ${job.id} skipped: log source ${job.log_source_id} disabled or not found`);
      logger.warn(`Job skipped: log source disabled or not found`, { jobId: job.id, logSourceId: job.log_source_id });
      return;
    }
    console.log(`[Scheduler] ✓ Log Source: "${logSource.name}" (${logSource.source_type})`);

    // Validate destination config based on destination type
    destinationType = job.destination_type || 'influxdb';
    console.log(`[Scheduler] Destination Type: ${destinationType}`);
    if (destinationType === 'influxdb') {
      const influxConfig = db.getInfluxConfig(job.influx_config_id);
      if (!influxConfig || !influxConfig.enabled) {
        console.log(`[Scheduler] ✗ Job ${job.id} skipped: InfluxDB config ${job.influx_config_id} disabled or not found`);
        logger.warn(`Job skipped: InfluxDB config disabled or not found`, { jobId: job.id, influxConfigId: job.influx_config_id });
        return;
      }
      console.log(`[Scheduler] ✓ InfluxDB Config: "${influxConfig.name}" (${influxConfig.url}/${influxConfig.database})`);
      destinationConfig = influxConfig;
    } else if (destinationType === 'postgresql') {
      const postgresConfig = db.getPostgresConfig(job.postgres_config_id);
      if (!postgresConfig || !postgresConfig.enabled) {
        console.log(`[Scheduler] ✗ Job ${job.id} skipped: PostgreSQL config ${job.postgres_config_id} disabled or not found`);
        logger.warn(`Job skipped: PostgreSQL config disabled or not found`, { jobId: job.id, postgresConfigId: job.postgres_config_id });
        return;
      }
      console.log(`[Scheduler] ✓ PostgreSQL Config: "${postgresConfig.name}" (${postgresConfig.host}:${postgresConfig.port}/${postgresConfig.database})`);
      destinationConfig = postgresConfig;
    } else {
      console.log(`[Scheduler] ✗ Job ${job.id} skipped: Unknown destination type "${destinationType}"`);
      logger.error(`Job skipped: unknown destination type`, { jobId: job.id, destinationType });
      return;
    }

    const regexPatterns = db.getRegexPatterns(job.log_source_id);
    if (regexPatterns.length === 0) {
      console.log(`[Scheduler] ✗ Job ${job.id} skipped: No regex pattern configured for log source ${job.log_source_id}`);
      logger.warn(`Job skipped: no regex pattern`, { jobId: job.id, logSourceId: job.log_source_id });
      db.logActivity(job.id, 'warning', 'No regex pattern configured', 0, 0);
      return;
    }
    console.log(`[Scheduler] ✓ Regex Pattern: ${regexPatterns[0].pattern.substring(0, 100)}...`);

    const tagMappings = db.getTagMappings(job.log_source_id);
    if (tagMappings.length === 0) {
      console.log(`[Scheduler] ✗ Job ${job.id} skipped: No tag mappings configured for log source ${job.log_source_id}`);
      logger.warn(`Job skipped: no tag mappings`, { jobId: job.id, logSourceId: job.log_source_id });
      db.logActivity(job.id, 'warning', 'No tag mappings configured', 0, 0);
      return;
    }
    console.log(`[Scheduler] ✓ Tag Mappings: ${tagMappings.length} configured (${tagMappings.filter(t => !t.is_field).length} tags, ${tagMappings.filter(t => t.is_field).length} fields)`);

    console.log(`[Scheduler] Creating clients and processor...`);

    // Reconstruct log source object from job data
    const logSourceData = {
      id: job.log_source_id,
      name: job.log_source_name,
      source_type: job.source_type,
      dynatrace_url: job.dynatrace_url,
      dynatrace_token: job.dynatrace_token,
      dynatrace_query_filter: job.dynatrace_query_filter,
      splunk_url: job.splunk_url,
      splunk_token: job.splunk_token,
      splunk_search_query: job.splunk_search_query,
      splunk_index: job.splunk_index,
      file_path: job.file_path,
      file_search_query: job.file_search_query,
      proxy_url: job.ls_proxy_url,
      proxy_username: job.ls_proxy_username,
      proxy_password: job.ls_proxy_password
    };

    // Create destination client based on type
    if (destinationType === 'influxdb') {
      const influxConfigData = {
        id: job.influx_config_id,
        name: job.influx_config_name,
        url: job.influx_url,
        database: job.influx_database,
        username: job.influx_username,
        password: job.influx_password,
        measurement_name: job.measurement_name,
        batch_size: job.batch_size,
        batch_interval_seconds: job.batch_interval_seconds,
        proxy_url: job.ic_proxy_url,
        proxy_username: job.ic_proxy_username,
        proxy_password: job.ic_proxy_password,
        timestamp_format: job.timestamp_format
      };
      destinationClient = new InfluxClient(influxConfigData);
    } else if (destinationType === 'postgresql') {
      const postgresConfigData = {
        id: job.postgres_config_id,
        name: job.postgres_config_name,
        host: job.pg_host,
        port: job.pg_port,
        database: job.pg_database,
        username: job.pg_username,
        password: job.pg_password,
        schema_name: job.pg_schema,
        table_name: job.pg_table,
        dedup_keys: job.pg_dedup_keys,
        tag_columns_schema: job.pg_tag_columns_schema,
        auto_create_table: job.pg_auto_create_table,
        batch_size: job.pg_batch_size,
        batch_interval_seconds: job.pg_batch_interval_seconds,
        proxy_url: job.pc_proxy_url,
        proxy_username: job.pc_proxy_username,
        proxy_password: job.pc_proxy_password
      };
      destinationClient = new PostgresClient(postgresConfigData);
    }

    const sourceClient = LogSourceFactory.createClient(logSourceData);
    const queryFilter = LogSourceFactory.getQueryFilter(logSourceData);
    const processor = new LogProcessor(regexPatterns[0].pattern, tagMappings);
    console.log(`[Scheduler] ✓ All clients and processor initialized`);

    const lookbackMs = (job.lookback_minutes || 5) * 60000;
    const maxLookbackMs = (job.max_lookback_minutes || 30) * 60000;
    const now = new Date();

    // Calculate query time window
    // If this is the first run, query from (now - lookback) to now
    // If not first run, query from (last_run - lookback) to now to create overlap buffer
    // BUT: Cap the window to max_lookback_minutes to prevent source overload after long downtime
    let queryStart;
    if (!job.last_run) {
      // First run: query lookback minutes from now
      queryStart = new Date(now.getTime() - lookbackMs);
      console.log(`Job ${job.id} - First run: querying from ${queryStart.toISOString()} to ${now.toISOString()} (${job.lookback_minutes || 5} min window)`);
    } else {
      // Subsequent runs: start from last_run minus lookback to create overlap
      const lastRunTime = new Date(job.last_run);
      const desiredStart = new Date(lastRunTime.getTime() - lookbackMs);
      const timeSinceLastRun = now.getTime() - lastRunTime.getTime();

      // Check if we need to cap the lookback window
      if (timeSinceLastRun > maxLookbackMs) {
        queryStart = new Date(now.getTime() - maxLookbackMs);
        const cappedMinutes = Math.round(maxLookbackMs / 60000);
        const gapMinutes = Math.round((queryStart.getTime() - lastRunTime.getTime()) / 60000);
        console.log(`[Scheduler] ⚠️  MAX LOOKBACK CAP APPLIED`);
        console.log(`[Scheduler]    - Job was down for: ${Math.round(timeSinceLastRun / 60000)} minutes`);
        console.log(`[Scheduler]    - Capping to: ${cappedMinutes} minutes`);
        console.log(`[Scheduler]    - Data gap: ${gapMinutes} minutes`);
        console.log(`[Scheduler]    - Gap period: ${lastRunTime.toISOString()} to ${queryStart.toISOString()}`);
        logger.warn(`Max lookback cap applied`, {
          jobId: job.id,
          downMinutes: Math.round(timeSinceLastRun / 60000),
          cappedToMinutes: cappedMinutes,
          gapMinutes: gapMinutes,
          lastRun: lastRunTime.toISOString(),
          cappedStart: queryStart.toISOString()
        });
      } else {
        queryStart = desiredStart;
        const windowMinutes = Math.round((now.getTime() - queryStart.getTime()) / 60000);
        console.log(`[Scheduler] Query window: ${windowMinutes} min (${queryStart.toISOString()} to ${now.toISOString()})`);
        console.log(`[Scheduler] Overlap: ${job.lookback_minutes || 5} min to avoid data gaps`);
      }
    }

    console.log(`[Scheduler] Fetching logs from ${logSource.source_type} source...`);

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

    console.log(`[Scheduler] ✓ Fetched ${logs.length} logs from ${logSource.source_type}`);
    logger.info(`Fetched logs from source`, {
      jobId: job.id,
      sourceType: logSource.source_type,
      logCount: logs.length,
      queryStart: queryStart.toISOString(),
      queryEnd: now.toISOString()
    });

    if (logs.length === 0) {
      console.log(`[Scheduler] No logs to process, completing job`);
    } else {
      console.log(`[Scheduler] Processing ${logs.length} logs...`);
    }

    let processed = 0;
    let failed = 0;
    const failureDetails = [];
    const processingStart = Date.now();

    for (const log of logs) {
      try {
        const jsonContent = processor.extractJSON(log.message);
        if (!jsonContent) {
          failed++;
          if (failed <= 3) { // Only log first 3 failures to console
            console.log(`[Scheduler]   ✗ Log extraction failed at ${log.timestamp}`);
          }
          failureDetails.push({
            reason: 'JSON extraction failed',
            log_message: log.message.substring(0, 500), // First 500 chars
            timestamp: log.timestamp
          });
          continue;
        }

        const point = processor.mapToInflux(log, jsonContent);
        destinationClient.add(point);
        processed++;

        // Log progress every 100 logs
        if (processed % 100 === 0) {
          console.log(`[Scheduler]   Progress: ${processed}/${logs.length} logs processed`);
        }
      } catch (error) {
        if (failed < 3) { // Only log first 3 errors to console
          console.error(`[Scheduler]   ✗ Error processing log:`, error.message);
        }
        failed++;
        failureDetails.push({
          reason: error.message,
          log_message: log.message.substring(0, 500),
          timestamp: log.timestamp,
          stack: error.stack
        });
      }
    }

    const processingDuration = Date.now() - processingStart;
    console.log(`[Scheduler] Processing complete: ${processed} successful, ${failed} failed (${processingDuration}ms)`);
    logger.info('Log processing complete', {
      jobId: job.id,
      totalLogs: logs.length,
      processed: processed,
      failed: failed,
      processingMs: processingDuration
    });

    // Flush remaining points to destination
    console.log(`[Scheduler] Flushing remaining points to ${destinationType}...`);
    try {
      await destinationClient.flush();
      console.log(`[Scheduler] ✓ All points flushed to ${destinationType}`);
    } catch (flushError) {
      console.error(`[Scheduler] ✗ ${destinationType} flush failed:`, flushError.message);
      logger.error(`Destination flush failed`, {
        jobId: job.id,
        destinationType,
        error: flushError.message,
        stack: flushError.stack,
        processed: processed,
        failed: failed
      });
      throw flushError; // Re-throw to be caught by outer catch
    }

    console.log(`[Scheduler] Updating job run status...`);
    db.updateJobRun(job.id, true);

    // Include failure details if any failures occurred
    const details = failed > 0 ? {
      total_fetched: logs.length,
      sample_failures: failureDetails.slice(0, 5), // First 5 failures
      log_source: logSource.name,
      destination_type: destinationType,
      destination_config: destinationConfig.name,
      query_window: {
        start: queryStart.toISOString(),
        end: now.toISOString()
      }
    } : null;

    console.log(`[Scheduler] Logging activity to database...`);
    db.logActivity(
      job.id,
      'info',
      `Processed ${processed} logs, ${failed} failed`,
      processed,
      failed,
      details
    );

    const jobDuration = Date.now() - jobStart;
    const total = processed + failed;
    const successRate = total > 0 ? ((processed / total) * 100).toFixed(2) : '0';
    console.log(`\n========== JOB EXECUTION COMPLETE ==========`);
    console.log(`[Scheduler] Job ID: ${job.id}`);
    console.log(`[Scheduler] Status: SUCCESS`);
    console.log(`[Scheduler] Duration: ${jobDuration}ms`);
    console.log(`[Scheduler] Processed: ${processed} logs`);
    console.log(`[Scheduler] Failed: ${failed} logs`);
    console.log(`[Scheduler] Success Rate: ${successRate}%`);
    console.log(`[Scheduler] End Time: ${new Date().toISOString()}`);
    console.log(`==========================================\n`);

    logger.info(`Job completed successfully`, {
      jobId: job.id,
      durationMs: jobDuration,
      processed,
      failed,
      successRate: successRate + '%',
      logSource: logSource.name,
      destinationType,
      destinationConfig: destinationConfig.name
    });

  } catch (error) {
    const jobDuration = Date.now() - jobStart;
    console.log(`\n========== JOB EXECUTION FAILED ==========`);
    console.log(`[Scheduler] Job ID: ${job.id}`);
    console.log(`[Scheduler] Status: FAILED`);
    console.log(`[Scheduler] Duration: ${jobDuration}ms`);
    console.log(`[Scheduler] Error: ${error.message}`);
    console.log(`[Scheduler] Error Type: ${error.name}`);
    if (error.code) {
      console.log(`[Scheduler] Error Code: ${error.code}`);
    }
    console.log(`[Scheduler] End Time: ${new Date().toISOString()}`);
    console.log(`==========================================\n`);

    const errorDetails = {
      error_type: error.name,
      error_message: error.message,
      error_code: error.code,
      stack_trace: error.stack,
      job_duration_ms: jobDuration,
      job_config: {
        log_source_id: job.log_source_id,
        log_source_name: logSource?.name,
        destination_type: destinationType,
        destination_config_id: destinationType === 'influxdb' ? job.influx_config_id : job.postgres_config_id,
        destination_config_name: destinationConfig?.name,
        lookback_minutes: job.lookback_minutes || 5,
        max_lookback_minutes: job.max_lookback_minutes || 30
      }
    };

    logger.error(`Job failed`, {
      jobId: job.id,
      durationMs: jobDuration,
      error: error.message,
      errorType: error.name,
      errorCode: error.code
    });

    db.logActivity(job.id, 'error', error.message, 0, 0, errorDetails);
  } finally {
    // Cleanup destination client (close connections, timers, etc.)
    if (destinationClient && typeof destinationClient.destroy === 'function') {
      try {
        // Don't await - let cleanup happen in background to avoid blocking
        // The client will flush remaining data and close connections
        destinationClient.destroy().catch(err => {
          console.error(`[Scheduler] Background cleanup error for job ${job.id}:`, err.message);
        });
        console.log(`[Scheduler] ✓ Destination client cleanup initiated for job ${job.id}`);
      } catch (cleanupError) {
        console.error(`[Scheduler] ✗ Cleanup error for job ${job.id}:`, cleanupError.message);
      }
    }

    // Always remove job from running set when execution completes or fails
    runningJobs.delete(job.id);
    console.log(`[Scheduler] Job ${job.id} execution lock released`);
  }
}

module.exports = { startScheduler, scheduleJob, executeJob };
