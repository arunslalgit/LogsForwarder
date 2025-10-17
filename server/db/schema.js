const SCHEMA = `
-- Log Source Configurations
CREATE TABLE IF NOT EXISTS log_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK(source_type IN ('dynatrace', 'splunk', 'file')),

  -- Dynatrace specific
  dynatrace_url TEXT,
  dynatrace_token TEXT,
  dynatrace_query_filter TEXT,

  -- Splunk specific
  splunk_url TEXT,
  splunk_token TEXT,
  splunk_search_query TEXT,
  splunk_index TEXT,

  -- File specific
  file_path TEXT,
  file_search_query TEXT,

  -- Proxy configuration (optional)
  proxy_url TEXT,
  proxy_username TEXT,
  proxy_password TEXT,

  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Regex Patterns
CREATE TABLE IF NOT EXISTS regex_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_source_id INTEGER NOT NULL,
  pattern TEXT NOT NULL,
  description TEXT,
  test_sample TEXT,
  FOREIGN KEY (log_source_id) REFERENCES log_sources(id) ON DELETE CASCADE
);

-- Tag Mappings
CREATE TABLE IF NOT EXISTS tag_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_source_id INTEGER NOT NULL,
  json_path TEXT NOT NULL,
  influx_tag_name TEXT NOT NULL,
  is_field INTEGER DEFAULT 0,
  data_type TEXT DEFAULT 'string' CHECK(data_type IN ('string', 'integer', 'float', 'boolean')),
  FOREIGN KEY (log_source_id) REFERENCES log_sources(id) ON DELETE CASCADE
);

-- InfluxDB Configurations
CREATE TABLE IF NOT EXISTS influx_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  database TEXT NOT NULL,
  username TEXT,
  password TEXT,
  measurement_name TEXT NOT NULL,
  batch_size INTEGER DEFAULT 100,
  batch_interval_seconds INTEGER DEFAULT 10,

  -- Proxy configuration (optional)
  proxy_url TEXT,
  proxy_username TEXT,
  proxy_password TEXT,

  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- PostgreSQL Configurations
CREATE TABLE IF NOT EXISTS postgres_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 5432,
  database TEXT NOT NULL,
  username TEXT,
  password TEXT,
  schema_name TEXT DEFAULT 'public',
  table_name TEXT NOT NULL,

  -- Deduplication keys (comma-separated column names)
  dedup_keys TEXT NOT NULL DEFAULT 'timestamp',

  -- Tag columns schema (JSON array)
  -- Example: [{"name":"service_name","type":"TEXT","required":true,"indexed":true}]
  tag_columns_schema TEXT NOT NULL,

  -- Auto-create table on first use
  auto_create_table INTEGER DEFAULT 1,

  -- Batching
  batch_size INTEGER DEFAULT 100,
  batch_interval_seconds INTEGER DEFAULT 10,

  -- Proxy configuration (optional)
  proxy_url TEXT,
  proxy_username TEXT,
  proxy_password TEXT,

  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Processing Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_source_id INTEGER NOT NULL,
  destination_type TEXT NOT NULL DEFAULT 'influxdb' CHECK(destination_type IN ('influxdb', 'postgresql')),
  influx_config_id INTEGER,
  postgres_config_id INTEGER,
  cron_schedule TEXT DEFAULT '*/5 * * * *',
  lookback_minutes INTEGER DEFAULT 5,
  last_run TEXT,
  last_success TEXT,
  enabled INTEGER DEFAULT 1,
  FOREIGN KEY (log_source_id) REFERENCES log_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (influx_config_id) REFERENCES influx_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (postgres_config_id) REFERENCES postgres_configs(id) ON DELETE CASCADE
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  level TEXT CHECK(level IN ('info', 'warning', 'error')),
  message TEXT,
  details TEXT,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

-- Application Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Admin Users (Authentication)
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_enabled ON jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_log_sources_enabled ON log_sources(enabled);
`;

module.exports = { SCHEMA };
