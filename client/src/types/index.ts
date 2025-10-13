export interface LogSource {
  id: number;
  name: string;
  source_type: 'dynatrace' | 'splunk';
  dynatrace_url?: string;
  dynatrace_token?: string;
  dynatrace_query_filter?: string;
  splunk_url?: string;
  splunk_token?: string;
  splunk_search_query?: string;
  splunk_index?: string;
  proxy_url?: string;
  proxy_username?: string;
  proxy_password?: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface RegexPattern {
  id: number;
  log_source_id: number;
  pattern: string;
  description?: string;
  test_sample?: string;
}

export interface TagMapping {
  id: number;
  log_source_id: number;
  json_path: string;
  influx_tag_name: string;
  is_field: number;
  data_type: 'string' | 'integer' | 'float' | 'boolean';
}

export interface InfluxConfig {
  id: number;
  name: string;
  url: string;
  database: string;
  username?: string;
  password?: string;
  measurement_name: string;
  batch_size: number;
  batch_interval_seconds: number;
  proxy_url?: string;
  proxy_username?: string;
  proxy_password?: string;
  enabled: number;
  created_at: string;
}

export interface Job {
  id: number;
  log_source_id: number;
  influx_config_id: number;
  cron_schedule: string;
  lookback_minutes: number;
  last_run?: string;
  last_success?: string;
  enabled: number;
  log_source_name?: string;
  source_type?: string;
  influx_config_name?: string;
}

export interface ActivityLog {
  id: number;
  job_id?: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  records_processed: number;
  records_failed: number;
  timestamp: string;
  log_source_name?: string;
  source_type?: string;
}
