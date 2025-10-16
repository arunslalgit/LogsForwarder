import { useEffect, useState } from 'react';
import { Container, Title, Paper, TextInput, Select, Button, Switch, Group, PasswordInput, Textarea, Alert, Code, Text, Divider, Stack, NumberInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { api } from '../api/client';

export default function LogSourceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState('dynatrace');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; count?: number; samples?: any[]; error?: string; timeWindowMinutes?: number } | null>(null);
  const [timeWindow, setTimeWindow] = useState(5);

  const form = useForm({
    initialValues: {
      name: '',
      source_type: 'dynatrace',
      dynatrace_url: '',
      dynatrace_token: '',
      dynatrace_query_filter: '',
      splunk_url: '',
      splunk_token: '',
      splunk_search_query: '',
      splunk_index: '',
      proxy_url: '',
      proxy_username: '',
      proxy_password: '',
      timestamp_format: 'nanoseconds',
      enabled: 1,
    },
    validate: {
      name: (val) => (val.length < 2 ? 'Name must be at least 2 characters' : null),
      dynatrace_url: (val, values) =>
        values.source_type === 'dynatrace' && !val ? 'URL is required' : null,
      dynatrace_token: (val, values) =>
        values.source_type === 'dynatrace' && !val ? 'Token is required' : null,
      splunk_url: (val, values) =>
        values.source_type === 'splunk' && !val ? 'URL is required' : null,
      splunk_token: (val, values) =>
        values.source_type === 'splunk' && !val ? 'Token is required' : null,
    },
  });

  useEffect(() => {
    if (id) {
      loadSource();
    }
  }, [id]);

  async function loadSource() {
    try {
      const data = await api.getLogSource(Number(id));
      form.setValues(data);
      setSourceType(data.source_type);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      if (id) {
        await api.updateLogSource(Number(id), values as any);
        notifications.show({ title: 'Success', message: 'Log source updated', color: 'green' });
      } else {
        await api.createLogSource(values as any);
        notifications.show({ title: 'Success', message: 'Log source created', color: 'green' });
      }
      navigate('/log-sources');
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      let result;
      // ALWAYS test with current form values (not saved config) with time window
      const testData = { ...form.values, timeWindowMinutes: timeWindow };
      result = await api.testLogSourceConfig(testData as any);

      setTestResult(result);
      if (result.success) {
        const mins = result.timeWindowMinutes || timeWindow;
        const timeDesc = mins >= 1440
          ? `${Math.floor(mins / 1440)} day(s)`
          : mins >= 60
            ? `${Math.floor(mins / 60)} hour(s)`
            : `${mins} minute(s)`;

        notifications.show({
          title: 'Success',
          message: `Connection successful! Found ${result.count || 0} logs in last ${timeDesc}.`,
          color: 'green'
        });
      } else {
        notifications.show({ title: 'Error', message: result.error || 'Connection failed', color: 'red' });
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Container size="sm">
      <Title order={2} mb="lg">
        {id ? 'Edit Log Source' : 'New Log Source'}
      </Title>

      <Paper shadow="sm" p="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Name"
            placeholder="My Log Source"
            required
            mb="md"
            {...form.getInputProps('name')}
          />

          {!id && (
            <Select
              label="Source Type"
              data={[
                { value: 'dynatrace', label: 'Dynatrace' },
                { value: 'splunk', label: 'Splunk' },
                { value: 'file', label: 'File (Local Log File)' },
              ]}
              required
              mb="md"
              value={sourceType}
              onChange={(val) => {
                setSourceType(val!);
                form.setFieldValue('source_type', val!);
              }}
            />
          )}

          {sourceType === 'dynatrace' && (
            <>
              <TextInput
                label="Dynatrace URL"
                placeholder="https://abc123.live.dynatrace.com"
                required
                mb="md"
                {...form.getInputProps('dynatrace_url')}
              />
              <PasswordInput
                label="API Token"
                placeholder="dt0c01.XXX..."
                required
                mb="md"
                {...form.getInputProps('dynatrace_token')}
              />
              <Textarea
                label="DQL Query Filter (Optional)"
                placeholder='log.source="app" AND level="ERROR"'
                mb="md"
                rows={3}
                {...form.getInputProps('dynatrace_query_filter')}
              />
            </>
          )}

          {sourceType === 'splunk' && (
            <>
              <TextInput
                label="Splunk URL"
                placeholder="https://splunk.example.com:8089"
                required
                mb="md"
                {...form.getInputProps('splunk_url')}
              />
              <PasswordInput
                label="Authentication Token"
                placeholder="Bearer token..."
                required
                mb="md"
                {...form.getInputProps('splunk_token')}
              />
              <TextInput
                label="Index (Optional)"
                placeholder="main"
                mb="md"
                {...form.getInputProps('splunk_index')}
              />
              <Textarea
                label="Search Query (SPL)"
                placeholder='sourcetype="app_logs" level="ERROR"'
                mb="md"
                rows={3}
                {...form.getInputProps('splunk_search_query')}
              />
            </>
          )}

          {sourceType === 'file' && (
            <>
              <TextInput
                label="Log File Path"
                placeholder="/Users/arunlal/o11yControlCenter/DefaultRatingEngine.log"
                required
                mb="md"
                description="Absolute path to the log file on this server"
                {...form.getInputProps('file_path')}
              />
              <TextInput
                label="Search Filter (Regex)"
                placeholder="error|exception|critical"
                mb="md"
                description="Optional regex pattern to filter log lines (case-insensitive)"
                {...form.getInputProps('file_search_query')}
              />
              <Alert color="blue" mb="md">
                File source reads logs from a local file with timestamps. The file will be parsed line-by-line within the configured time window. Timestamps must be in format: YYYY-MM-DD HH:MM:SS.mmm
                <br/>
                <strong>Search Filter:</strong> Use regex to filter logs (e.g., "error|exception" to find errors, "userId.*123" to find specific user)
              </Alert>
            </>
          )}

          <Title order={5} mt="xl" mb="md">Proxy Configuration (Optional)</Title>
          <TextInput
            label="Proxy URL"
            placeholder="http://proxy.example.com:8080"
            mb="md"
            {...form.getInputProps('proxy_url')}
          />
          <TextInput
            label="Proxy Username (Optional)"
            placeholder="proxy_user"
            mb="md"
            {...form.getInputProps('proxy_username')}
          />
          <PasswordInput
            label="Proxy Password (Optional)"
            placeholder="••••••••"
            mb="md"
            {...form.getInputProps('proxy_password')}
          />

          <Title order={5} mt="xl" mb="md">Timestamp Configuration</Title>
          <Select
            label="Timestamp Format"
            description="Format for timestamps sent to InfluxDB. Choose based on your InfluxDB database configuration."
            data={[
              { value: 'nanoseconds', label: 'Nanoseconds (default)' },
              { value: 'milliseconds', label: 'Milliseconds' },
              { value: 'seconds', label: 'Seconds' }
            ]}
            mb="md"
            {...form.getInputProps('timestamp_format')}
          />

          <Switch
            label="Enabled"
            mb="lg"
            checked={form.values.enabled === 1}
            onChange={(e) => form.setFieldValue('enabled', e.currentTarget.checked ? 1 : 0)}
          />

          <Group justify="space-between" align="flex-end">
            <Group>
              <Button variant="subtle" onClick={() => navigate('/log-sources')}>
                Cancel
              </Button>
              <NumberInput
                label="Time Window (minutes)"
                value={timeWindow}
                onChange={(val) => setTimeWindow(Number(val) || 5)}
                min={1}
                max={43200}
                description="Up to 30 days (43200 min)"
                style={{ width: 200 }}
              />
              <Button variant="light" onClick={handleTest} loading={testing} style={{ marginTop: 25 }}>
                Test & Preview Data
              </Button>
            </Group>
            <Button type="submit" loading={loading}>
              {id ? 'Update' : 'Create'}
            </Button>
          </Group>
        </form>
      </Paper>

      {testResult && (
        <Paper shadow="sm" p="lg" mt="lg">
          {testResult.success ? (
            <>
              <Alert icon={<IconCheck size={16} />} title="Connection Successful" color="green" mb="md">
                Found {testResult.count || 0} log entries in the last 5 minutes.
                {testResult.samples && testResult.samples.length > 0 && (
                  <Text size="sm" mt="xs">Showing {testResult.samples.length} sample(s) below.</Text>
                )}
              </Alert>

              {testResult.samples && testResult.samples.length > 0 && (
                <>
                  <Divider my="md" label="Sample Data" labelPosition="center" />
                  <Text size="sm" c="dimmed" mb="md">
                    Use this sample data to configure regex patterns and field mappings
                  </Text>
                  <Stack gap="md">
                    {testResult.samples.map((sample, idx) => (
                      <Paper key={idx} withBorder p="sm" style={{ overflow: 'auto' }}>
                        <Text size="xs" c="dimmed" mb="xs">Sample {idx + 1}</Text>
                        <Code block style={{ fontSize: '11px' }}>
                          {sample.message}
                        </Code>
                      </Paper>
                    ))}
                  </Stack>
                </>
              )}
            </>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} title="Connection Failed" color="red">
              {testResult.error || 'Unable to connect to the log source'}
            </Alert>
          )}
        </Paper>
      )}
    </Container>
  );
}
