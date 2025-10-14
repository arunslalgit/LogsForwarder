import { useEffect, useState } from 'react';
import { Container, Title, Paper, TextInput, Select, Button, Switch, Group, PasswordInput, Textarea, Alert, Code, Text, Divider, Stack } from '@mantine/core';
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
  const [testResult, setTestResult] = useState<{ success: boolean; count?: number; samples?: any[]; error?: string } | null>(null);

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
      // Test with current form values (even if not saved yet)
      if (id) {
        result = await api.testLogSource(Number(id));
      } else {
        result = await api.testLogSourceConfig(form.values as any);
      }

      setTestResult(result);
      if (result.success) {
        notifications.show({
          title: 'Success',
          message: `Connection successful! Found ${result.count || 0} logs in last 5 minutes.`,
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

          <Switch
            label="Enabled"
            mb="lg"
            checked={form.values.enabled === 1}
            onChange={(e) => form.setFieldValue('enabled', e.currentTarget.checked ? 1 : 0)}
          />

          <Group justify="space-between">
            <Group>
              <Button variant="subtle" onClick={() => navigate('/log-sources')}>
                Cancel
              </Button>
              <Button variant="light" onClick={handleTest} loading={testing}>
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
                          {JSON.stringify(sample, null, 2)}
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
