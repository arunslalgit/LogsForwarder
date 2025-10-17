import type { LogSource, RegexPattern, TagMapping, InfluxConfig, PostgresConfig, Job, ActivityLog } from '../types';

// Dynamically determine BASE_URL from the page's actual location
// This allows the same build to work with any BASE_PATH at runtime
// If app is served at /forwarder/, this returns /forwarder/api
// If app is served at /, this returns /api
function getBaseUrl() {
  const pathname = window.location.pathname;
  // Extract base path from pathname (everything before /api or first route segment)
  // Examples: /forwarder/log-sources -> /forwarder, /log-sources -> '', /forwarder/ -> /forwarder
  const segments = pathname.split('/').filter(Boolean);

  // If first segment exists and isn't a known route, it's likely the base path
  const knownRoutes = [
    'log-sources', 'influx-configs', 'postgres-configs', 'jobs',
    'regex-patterns', 'tag-mappings', 'sqlite-explorer', 'dashboard',
    'influx-explorer', 'postgres-explorer', 'activity-logs', 'change-password'
  ];
  if (segments.length > 0 && !knownRoutes.includes(segments[0])) {
    return `/${segments[0]}/api`;
  }

  return '/api';
}

const BASE_URL = getBaseUrl();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      // Clear any stale session data
      document.cookie = 'auth_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      // Redirect to login page (preserve current path for redirect after login)
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }

    // Check if response is JSON before trying to parse
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    } else {
      // Response is not JSON (likely HTML error page) - consume the response
      await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
  }

  return response.json();
}

export const api = {
  getLogSources: () => request<LogSource[]>('/log-sources'),
  getLogSource: (id: number) => request<LogSource>(`/log-sources/${id}`),
  createLogSource: (data: Partial<LogSource>) => request<{ id: number; message: string }>('/log-sources', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateLogSource: (id: number, data: Partial<LogSource>) => request<{ message: string }>(`/log-sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteLogSource: (id: number) => request<{ message: string }>(`/log-sources/${id}`, { method: 'DELETE' }),
  testLogSource: (id: number, timeWindowMinutes?: number, sampleLimit?: number) => request<{ success: boolean; count?: number; samples?: any[]; samplesShown?: number; error?: string; timeWindowMinutes?: number }>(`/log-sources/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ timeWindowMinutes, sampleLimit }),
  }),
  testLogSourceConfig: (data: Partial<LogSource> & { timeWindowMinutes?: number; sampleLimit?: number }) => request<{ success: boolean; count?: number; samples?: any[]; samplesShown?: number; error?: string; timeWindowMinutes?: number }>('/log-sources/test-config', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getRegexPatterns: (logSourceId: number) => request<RegexPattern[]>(`/regex-patterns/log-source/${logSourceId}`),
  createRegexPattern: (data: Partial<RegexPattern>) => request<{ id: number; message: string }>('/regex-patterns', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateRegexPattern: (id: number, data: Partial<RegexPattern>) => request<{ message: string }>(`/regex-patterns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteRegexPattern: (id: number) => request<{ message: string }>(`/regex-patterns/${id}`, { method: 'DELETE' }),
  testRegex: (data: { pattern: string; test_sample: string }) => request<{ success: boolean; extracted?: string; parsed?: any; message?: string }>('/regex-patterns/test', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getTagMappings: (logSourceId: number) => request<TagMapping[]>(`/tag-mappings/log-source/${logSourceId}`),
  createTagMapping: (data: Partial<TagMapping>) => request<{ id: number; message: string }>('/tag-mappings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTagMapping: (id: number, data: Partial<TagMapping>) => request<{ message: string }>(`/tag-mappings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTagMapping: (id: number) => request<{ message: string }>(`/tag-mappings/${id}`, { method: 'DELETE' }),
  testJsonPath: (data: { json_path: string; test_json: any }) => request<{ success: boolean; result?: any; type?: string; message?: string; error?: string }>('/tag-mappings/test', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getInfluxConfigs: () => request<InfluxConfig[]>('/influx-configs'),
  getInfluxConfig: (id: number) => request<InfluxConfig>(`/influx-configs/${id}`),
  createInfluxConfig: (data: Partial<InfluxConfig>) => request<{ id: number; message: string }>('/influx-configs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateInfluxConfig: (id: number, data: Partial<InfluxConfig>) => request<{ message: string }>(`/influx-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteInfluxConfig: (id: number) => request<{ message: string }>(`/influx-configs/${id}`, { method: 'DELETE' }),
  testInfluxConnection: (data: Partial<InfluxConfig>) => request<{ success: boolean; message?: string; error?: string; warning?: boolean; influxVersion?: string; databaseExists?: boolean }>('/influx-configs/test-connection', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getPostgresConfigs: () => request<PostgresConfig[]>('/postgres-configs'),
  getPostgresConfig: (id: number) => request<PostgresConfig>(`/postgres-configs/${id}`),
  createPostgresConfig: (data: Partial<PostgresConfig>) => request<{ id: number; message: string }>('/postgres-configs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updatePostgresConfig: (id: number, data: Partial<PostgresConfig>) => request<{ message: string }>(`/postgres-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deletePostgresConfig: (id: number) => request<{ message: string }>(`/postgres-configs/${id}`, { method: 'DELETE' }),
  testPostgresConnection: (data: Partial<PostgresConfig>) => request<{ success: boolean; message?: string; error?: string; schema_exists?: boolean; table_exists?: boolean }>('/postgres-configs/test-connection', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  recommendPostgresSchema: (log_source_id: number) => request<{ success: boolean; schema: any[]; tag_count: number; field_count: number; message: string; error?: string }>('/postgres-configs/recommend-schema', {
    method: 'POST',
    body: JSON.stringify({ log_source_id }),
  }),

  getJobs: () => request<Job[]>('/jobs'),
  createJob: (data: Partial<Job>) => request<{ id: number; message: string }>('/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateJob: (id: number, data: Partial<Job>) => request<{ message: string }>(`/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteJob: (id: number) => request<{ message: string }>(`/jobs/${id}`, { method: 'DELETE' }),
  runJob: (id: number) => request<{ success: boolean; message: string }>(`/jobs/${id}/run`, { method: 'POST' }),
  resetJobLastRun: (id: number, minutes: number) => request<{ message: string }>(`/jobs/${id}/reset-last-run`, {
    method: 'POST',
    body: JSON.stringify({ minutes }),
  }),

  getActivityLogs: (limit = 100, offset = 0) => request<ActivityLog[]>(`/activity-logs?limit=${limit}&offset=${offset}`),

  previewInfluxLines: (data: { log_source_id: number; test_json: any; measurement_name?: string; timestamp?: string; timestamp_format?: 'milliseconds' | 'seconds' | 'nanoseconds'; sample_count?: number }) =>
    request<{ success: boolean; lines?: string[]; samples_processed?: number; tags_extracted?: number; fields_extracted?: number; extraction_errors?: string[]; timestamp_info?: any; error?: string }>('/tag-mappings/preview-influx', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  postgresQuery: (postgres_config_id: number, query: string) =>
    request<{ success: boolean; rows: any[]; rowCount: number; fields: any[]; error?: string }>('/postgres-explorer/query', {
      method: 'POST',
      body: JSON.stringify({ postgres_config_id, query }),
    }),
  postgresSchemas: (postgres_config_id: number) =>
    request<{ success: boolean; schemas: string[]; error?: string }>('/postgres-explorer/schemas', {
      method: 'POST',
      body: JSON.stringify({ postgres_config_id }),
    }),
  postgresTables: (postgres_config_id: number, schema_name: string) =>
    request<{ success: boolean; tables: string[]; error?: string }>('/postgres-explorer/tables', {
      method: 'POST',
      body: JSON.stringify({ postgres_config_id, schema_name }),
    }),
};
