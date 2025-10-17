const { getDatabase } = require('./init');

// Helper function to sanitize undefined values to null for SQLite
function sanitizeValue(value) {
  return value === undefined ? null : value;
}

// ============= LOG SOURCES =============
function getAllLogSources() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM log_sources ORDER BY name').all();
}

function getLogSource(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM log_sources WHERE id = ?').get(id);
}

function createLogSource(data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO log_sources (
      name, source_type, dynatrace_url, dynatrace_token, dynatrace_query_filter,
      splunk_url, splunk_token, splunk_search_query, splunk_index,
      file_path, file_search_query,
      proxy_url, proxy_username, proxy_password, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.name,
    data.source_type,
    data.dynatrace_url || null,
    data.dynatrace_token || null,
    data.dynatrace_query_filter || null,
    data.splunk_url || null,
    data.splunk_token || null,
    data.splunk_search_query || null,
    data.splunk_index || null,
    data.file_path || null,
    data.file_search_query || null,
    data.proxy_url || null,
    data.proxy_username || null,
    data.proxy_password || null,
    data.enabled !== undefined ? data.enabled : 1
  );

  return result.lastInsertRowid;
}

function updateLogSource(id, data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE log_sources SET
      name = COALESCE(?, name),
      dynatrace_url = COALESCE(?, dynatrace_url),
      dynatrace_token = COALESCE(?, dynatrace_token),
      dynatrace_query_filter = COALESCE(?, dynatrace_query_filter),
      splunk_url = COALESCE(?, splunk_url),
      splunk_token = COALESCE(?, splunk_token),
      splunk_search_query = COALESCE(?, splunk_search_query),
      splunk_index = COALESCE(?, splunk_index),
      file_path = COALESCE(?, file_path),
      file_search_query = COALESCE(?, file_search_query),
      proxy_url = COALESCE(?, proxy_url),
      proxy_username = COALESCE(?, proxy_username),
      proxy_password = COALESCE(?, proxy_password),
      enabled = COALESCE(?, enabled),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  return stmt.run(
    sanitizeValue(data.name), sanitizeValue(data.dynatrace_url), sanitizeValue(data.dynatrace_token), sanitizeValue(data.dynatrace_query_filter),
    sanitizeValue(data.splunk_url), sanitizeValue(data.splunk_token), sanitizeValue(data.splunk_search_query), sanitizeValue(data.splunk_index),
    sanitizeValue(data.file_path), sanitizeValue(data.file_search_query),
    sanitizeValue(data.proxy_url), sanitizeValue(data.proxy_username), sanitizeValue(data.proxy_password),
    sanitizeValue(data.enabled), id
  );
}

function deleteLogSource(id) {
  const db = getDatabase();
  return db.prepare('DELETE FROM log_sources WHERE id = ?').run(id);
}

// ============= REGEX PATTERNS =============
function getRegexPatterns(logSourceId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM regex_patterns WHERE log_source_id = ?').all(logSourceId);
}

function createRegexPattern(data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO regex_patterns (log_source_id, pattern, description, test_sample)
    VALUES (?, ?, ?, ?)
  `);

  return stmt.run(
    data.log_source_id,
    data.pattern,
    data.description || null,
    data.test_sample || null
  ).lastInsertRowid;
}

function updateRegexPattern(id, data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE regex_patterns SET
      pattern = COALESCE(?, pattern),
      description = COALESCE(?, description),
      test_sample = COALESCE(?, test_sample)
    WHERE id = ?
  `);

  return stmt.run(data.pattern, data.description, data.test_sample, id);
}

function deleteRegexPattern(id) {
  const db = getDatabase();
  return db.prepare('DELETE FROM regex_patterns WHERE id = ?').run(id);
}

// ============= TAG MAPPINGS =============
function getTagMappings(logSourceId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tag_mappings WHERE log_source_id = ?').all(logSourceId);
}

function createTagMapping(data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO tag_mappings (log_source_id, json_path, influx_tag_name, is_field, data_type, is_static, static_value, transform_regex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.log_source_id,
    data.json_path || '',
    data.influx_tag_name,
    data.is_field || 0,
    data.data_type || 'string',
    data.is_static || 0,
    data.static_value || null,
    data.transform_regex || null
  ).lastInsertRowid;
}

function updateTagMapping(id, data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE tag_mappings SET
      json_path = COALESCE(?, json_path),
      influx_tag_name = COALESCE(?, influx_tag_name),
      is_field = COALESCE(?, is_field),
      data_type = COALESCE(?, data_type),
      is_static = COALESCE(?, is_static),
      static_value = ?,
      transform_regex = ?
    WHERE id = ?
  `);

  return stmt.run(
    data.json_path,
    data.influx_tag_name,
    data.is_field,
    data.data_type,
    data.is_static,
    data.static_value !== undefined ? data.static_value : null,
    data.transform_regex !== undefined ? data.transform_regex : null,
    id
  );
}

function deleteTagMapping(id) {
  const db = getDatabase();
  return db.prepare('DELETE FROM tag_mappings WHERE id = ?').run(id);
}

// ============= INFLUX CONFIGS =============
function getAllInfluxConfigs() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM influx_configs ORDER BY name').all();
}

function getInfluxConfig(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM influx_configs WHERE id = ?').get(id);
}

function createInfluxConfig(data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO influx_configs (
      name, url, database, username, password, measurement_name,
      batch_size, batch_interval_seconds, proxy_url, proxy_username, proxy_password, timestamp_format, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.name, data.url, data.database, data.username || null, data.password || null,
    data.measurement_name, data.batch_size || 100, data.batch_interval_seconds || 10,
    data.proxy_url || null, data.proxy_username || null, data.proxy_password || null,
    data.timestamp_format || 'nanoseconds',
    data.enabled !== undefined ? data.enabled : 1
  ).lastInsertRowid;
}

function updateInfluxConfig(id, data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE influx_configs SET
      name = COALESCE(?, name),
      url = COALESCE(?, url),
      database = COALESCE(?, database),
      username = COALESCE(?, username),
      password = COALESCE(?, password),
      measurement_name = COALESCE(?, measurement_name),
      batch_size = COALESCE(?, batch_size),
      batch_interval_seconds = COALESCE(?, batch_interval_seconds),
      proxy_url = COALESCE(?, proxy_url),
      proxy_username = COALESCE(?, proxy_username),
      proxy_password = COALESCE(?, proxy_password),
      timestamp_format = COALESCE(?, timestamp_format),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `);

  return stmt.run(
    data.name, data.url, data.database, data.username, data.password,
    data.measurement_name, data.batch_size, data.batch_interval_seconds,
    data.proxy_url, data.proxy_username, data.proxy_password,
    data.timestamp_format,
    data.enabled, id
  );
}

function deleteInfluxConfig(id) {
  const db = getDatabase();
  return db.prepare('DELETE FROM influx_configs WHERE id = ?').run(id);
}

// ============= JOBS =============
function getAllJobs() {
  const db = getDatabase();
  return db.prepare(`
    SELECT j.*, ls.name as log_source_name, ls.source_type, ic.name as influx_config_name
    FROM jobs j
    JOIN log_sources ls ON j.log_source_id = ls.id
    JOIN influx_configs ic ON j.influx_config_id = ic.id
    ORDER BY j.id DESC
  `).all();
}

function getJob(id) {
  const db = getDatabase();
  return db.prepare(`
    SELECT j.*, ls.name as log_source_name, ls.source_type, ic.name as influx_config_name
    FROM jobs j
    JOIN log_sources ls ON j.log_source_id = ls.id
    JOIN influx_configs ic ON j.influx_config_id = ic.id
    WHERE j.id = ?
  `).get(id);
}

function getEnabledJobs() {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      j.id, j.log_source_id, j.influx_config_id, j.cron_schedule,
      j.lookback_minutes, j.max_lookback_minutes, j.last_run, j.last_success, j.enabled,
      ls.name as log_source_name, ls.source_type, ls.dynatrace_url, ls.dynatrace_token,
      ls.dynatrace_query_filter, ls.splunk_url, ls.splunk_token, ls.splunk_search_query,
      ls.splunk_index, ls.file_path, ls.file_search_query, ls.proxy_url as ls_proxy_url,
      ls.proxy_username as ls_proxy_username, ls.proxy_password as ls_proxy_password,
      ic.name as influx_config_name, ic.url as influx_url, ic.database as influx_database,
      ic.username as influx_username, ic.password as influx_password,
      ic.measurement_name, ic.batch_size, ic.batch_interval_seconds,
      ic.proxy_url as ic_proxy_url, ic.proxy_username as ic_proxy_username,
      ic.proxy_password as ic_proxy_password, ic.timestamp_format
    FROM jobs j
    JOIN log_sources ls ON j.log_source_id = ls.id
    JOIN influx_configs ic ON j.influx_config_id = ic.id
    WHERE j.enabled = 1 AND ls.enabled = 1 AND ic.enabled = 1
  `).all();
}

function createJob(data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO jobs (log_source_id, influx_config_id, cron_schedule, lookback_minutes, max_lookback_minutes, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.log_source_id,
    data.influx_config_id,
    data.cron_schedule || '*/5 * * * *',
    data.lookback_minutes !== undefined ? data.lookback_minutes : 5,
    data.max_lookback_minutes !== undefined ? data.max_lookback_minutes : 30,
    data.enabled !== undefined ? data.enabled : 1
  ).lastInsertRowid;
}

function updateJob(id, data) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE jobs SET
      cron_schedule = COALESCE(?, cron_schedule),
      lookback_minutes = COALESCE(?, lookback_minutes),
      max_lookback_minutes = COALESCE(?, max_lookback_minutes),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `);

  return stmt.run(data.cron_schedule, data.lookback_minutes, data.max_lookback_minutes, data.enabled, id);
}

function updateJobRun(jobId, success) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE jobs SET
      last_run = ?,
      last_success = CASE WHEN ? THEN ? ELSE last_success END
    WHERE id = ?
  `);

  return stmt.run(now, success ? 1 : 0, now, jobId);
}

function deleteJob(id) {
  const db = getDatabase();
  return db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

// ============= ACTIVITY LOGS =============
function getActivityLogs(limit = 100, offset = 0) {
  const db = getDatabase();
  return db.prepare(`
    SELECT al.*, j.id as job_id, ls.name as log_source_name, ls.source_type
    FROM activity_logs al
    LEFT JOIN jobs j ON al.job_id = j.id
    LEFT JOIN log_sources ls ON j.log_source_id = ls.id
    ORDER BY al.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function logActivity(jobId, level, message, recordsProcessed = 0, recordsFailed = 0, details = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO activity_logs (job_id, level, message, records_processed, records_failed, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Convert details object to JSON string if provided
  const detailsJson = details ? JSON.stringify(details) : null;

  return stmt.run(jobId, level, message, recordsProcessed, recordsFailed, detailsJson);
}

function deleteOldActivityLogs(daysToKeep = 30) {
  const db = getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return db.prepare(`
    DELETE FROM activity_logs
    WHERE timestamp < ?
  `).run(cutoffDate.toISOString());
}

module.exports = {
  getAllLogSources,
  getLogSource,
  createLogSource,
  updateLogSource,
  deleteLogSource,

  getRegexPatterns,
  createRegexPattern,
  updateRegexPattern,
  deleteRegexPattern,

  getTagMappings,
  createTagMapping,
  updateTagMapping,
  deleteTagMapping,

  getAllInfluxConfigs,
  getInfluxConfig,
  createInfluxConfig,
  updateInfluxConfig,
  deleteInfluxConfig,

  getAllJobs,
  getJob,
  getEnabledJobs,
  createJob,
  updateJob,
  updateJobRun,
  deleteJob,

  getActivityLogs,
  logActivity,
  deleteOldActivityLogs
};
