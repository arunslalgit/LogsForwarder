import type { LogSource, RegexPattern, TagMapping, InfluxConfig, Job, ActivityLog } from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
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
  testLogSource: (id: number, timeWindowMinutes?: number) => request<{ success: boolean; count?: number; samples?: any[]; error?: string; timeWindowMinutes?: number }>(`/log-sources/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ timeWindowMinutes }),
  }),
  testLogSourceConfig: (data: Partial<LogSource> & { timeWindowMinutes?: number }) => request<{ success: boolean; count?: number; samples?: any[]; error?: string; timeWindowMinutes?: number }>('/log-sources/test-config', {
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

  getActivityLogs: (limit = 100, offset = 0) => request<ActivityLog[]>(`/activity-logs?limit=${limit}&offset=${offset}`),
};
