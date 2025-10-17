import { useEffect, useState } from 'react';
import { Container, Title, Paper, TextInput, NumberInput, Button, Switch, Group, PasswordInput, Alert, Textarea, Stack, Text, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconPlugConnected, IconAlertCircle, IconCheck, IconBulb } from '@tabler/icons-react';
import { api } from '../api/client';
import type { LogSource } from '../types';

const DEFAULT_SCHEMA = `[
  {"name": "timestamp", "type": "TIMESTAMPTZ", "required": true, "indexed": true},
  {"name": "service_name", "type": "TEXT", "required": false, "indexed": true},
  {"name": "environment", "type": "TEXT", "required": false, "indexed": true}
]`;

export default function PostgresConfigForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);
  const [logSources, setLogSources] = useState<LogSource[]>([]);
  const [selectedLogSourceId, setSelectedLogSourceId] = useState<string>('');

  const form = useForm({
    initialValues: {
      name: '',
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
      schema_name: 'public',
      table_name: '',
      dedup_keys: 'timestamp',
      tag_columns_schema: DEFAULT_SCHEMA,
      auto_create_table: 1,
      batch_size: 100,
      batch_interval_seconds: 10,
      proxy_url: '',
      proxy_username: '',
      proxy_password: '',
      enabled: 1,
    },
    validate: {
      name: (val) => (val.length < 2 ? 'Name required' : null),
      host: (val) => (!val ? 'Host required' : null),
      port: (val) => (val < 1 || val > 65535 ? 'Invalid port' : null),
      database: (val) => (!val ? 'Database required' : null),
      table_name: (val) => (!val ? 'Table name required' : null),
      dedup_keys: (val) => (!val ? 'Dedup keys required' : null),
      tag_columns_schema: (val) => {
        try {
          const parsed = JSON.parse(val);
          if (!Array.isArray(parsed)) return 'Must be a JSON array';
          for (const col of parsed) {
            if (!col.name || !col.type) return 'Each column must have name and type';
          }
          return null;
        } catch (e) {
          return 'Invalid JSON';
        }
      },
      batch_size: (val) => (val < 1 || val > 10000 ? 'Must be between 1 and 10000' : null),
      batch_interval_seconds: (val) => (val < 1 || val > 3600 ? 'Must be between 1 and 3600' : null),
    },
  });

  useEffect(() => {
    loadLogSources();
    if (id) {
      loadConfig();
    }
  }, [id]);

  async function loadLogSources() {
    try {
      const data = await api.getLogSources();
      setLogSources(data);
    } catch (error: any) {
      console.error('Failed to load log sources:', error);
    }
  }

  async function loadConfig() {
    try {
      const data = await api.getPostgresConfig(Number(id));
      form.setValues(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      if (id) {
        await api.updatePostgresConfig(Number(id), values);
        notifications.show({ title: 'Success', message: 'Config updated', color: 'green' });
      } else {
        await api.createPostgresConfig(values);
        notifications.show({ title: 'Success', message: 'Config created', color: 'green' });
      }
      navigate('/postgres-configs');
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const result = await api.testPostgresConnection(form.values);
      setConnectionTestResult(result);
      if (result.success) {
        notifications.show({
          title: 'Success',
          message: result.message || 'Connected successfully',
          color: 'green'
        });
      } else {
        notifications.show({
          title: 'Connection Failed',
          message: result.error || 'Failed to connect',
          color: 'red'
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleRecommendSchema() {
    if (!selectedLogSourceId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a log source first',
        color: 'red'
      });
      return;
    }

    try {
      const result = await api.recommendPostgresSchema(Number(selectedLogSourceId));
      if (result.success) {
        form.setFieldValue('tag_columns_schema', JSON.stringify(result.schema, null, 2));
        notifications.show({
          title: 'Schema Recommended',
          message: result.message,
          color: 'green'
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    }
  }

  return (
    <Container size="md">
      <Title order={2} mb="lg">
        {id ? 'Edit' : 'Add'} PostgreSQL Configuration
      </Title>

      <Paper p="md" withBorder>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Configuration Name"
              placeholder="Production PostgreSQL"
              required
              {...form.getInputProps('name')}
            />

            <Group grow>
              <TextInput
                label="Host"
                placeholder="localhost"
                required
                {...form.getInputProps('host')}
              />
              <NumberInput
                label="Port"
                placeholder="5432"
                required
                {...form.getInputProps('port')}
              />
            </Group>

            <TextInput
              label="Database"
              placeholder="logs_db"
              required
              {...form.getInputProps('database')}
            />

            <Group grow>
              <TextInput
                label="Username"
                placeholder="postgres"
                {...form.getInputProps('username')}
              />
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                {...form.getInputProps('password')}
              />
            </Group>

            <Group grow>
              <TextInput
                label="Schema Name"
                placeholder="public"
                required
                {...form.getInputProps('schema_name')}
              />
              <TextInput
                label="Table Name"
                placeholder="logs"
                required
                {...form.getInputProps('table_name')}
              />
            </Group>

            <TextInput
              label="Deduplication Keys"
              description="Comma-separated column names (e.g., 'timestamp' or 'timestamp,service_name')"
              placeholder="timestamp"
              required
              {...form.getInputProps('dedup_keys')}
            />

            <div>
              <Group justify="space-between" mb="xs">
                <div>
                  <Text size="sm" fw={500}>
                    Tag Columns Schema (JSON)
                  </Text>
                  <Text size="xs" c="dimmed">
                    Define columns with: name, type (TEXT/INTEGER/REAL/BOOLEAN/TIMESTAMP/TIMESTAMPTZ), required (optional), indexed (optional)
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Note: You <strong>must</strong> include a <strong>timestamp</strong> column with type TIMESTAMPTZ for proper time-series data.
                  </Text>
                </div>
              </Group>

              <Alert color="blue" mb="sm" icon={<IconBulb size={16} />}>
                <Text size="sm" mb="xs">
                  <strong>Generate schema from log source:</strong>
                </Text>
                <Group>
                  <Select
                    placeholder="Select log source"
                    data={logSources.map(s => ({ value: String(s.id), label: s.name }))}
                    value={selectedLogSourceId}
                    onChange={(value) => setSelectedLogSourceId(value || '')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="light"
                    leftSection={<IconBulb size={16} />}
                    onClick={handleRecommendSchema}
                    disabled={!selectedLogSourceId}
                  >
                    Recommend Schema
                  </Button>
                </Group>
              </Alert>

              <Textarea
                placeholder={DEFAULT_SCHEMA}
                required
                rows={8}
                {...form.getInputProps('tag_columns_schema')}
              />
              {form.errors.tag_columns_schema && (
                <Text size="xs" c="red" mt={4}>{form.errors.tag_columns_schema}</Text>
              )}
            </div>

            <Switch
              label="Auto-create table if it doesn't exist"
              description="Automatically create the table with the defined schema"
              {...form.getInputProps('auto_create_table', { type: 'checkbox' })}
              checked={form.values.auto_create_table === 1}
              onChange={(e) => form.setFieldValue('auto_create_table', e.currentTarget.checked ? 1 : 0)}
            />

            <Group grow>
              <NumberInput
                label="Batch Size"
                description="Number of records to batch"
                min={1}
                max={10000}
                {...form.getInputProps('batch_size')}
              />
              <NumberInput
                label="Batch Interval (seconds)"
                description="How often to flush batch"
                min={1}
                max={3600}
                {...form.getInputProps('batch_interval_seconds')}
              />
            </Group>

            <Title order={5}>Proxy Settings (Optional)</Title>

            <TextInput
              label="Proxy URL"
              placeholder="http://proxy.example.com:8080"
              {...form.getInputProps('proxy_url')}
            />

            <Group grow>
              <TextInput
                label="Proxy Username"
                {...form.getInputProps('proxy_username')}
              />
              <PasswordInput
                label="Proxy Password"
                {...form.getInputProps('proxy_password')}
              />
            </Group>

            <Switch
              label="Enabled"
              description="Enable this configuration"
              {...form.getInputProps('enabled', { type: 'checkbox' })}
              checked={form.values.enabled === 1}
              onChange={(e) => form.setFieldValue('enabled', e.currentTarget.checked ? 1 : 0)}
            />

            {connectionTestResult && (
              <Alert
                icon={connectionTestResult.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                color={connectionTestResult.success ? 'green' : 'red'}
                title={connectionTestResult.success ? 'Connection Successful' : 'Connection Failed'}
              >
                {connectionTestResult.message || connectionTestResult.error}
                {connectionTestResult.schema_exists !== undefined && (
                  <>
                    <br />Schema exists: {connectionTestResult.schema_exists ? 'Yes' : 'No'}
                  </>
                )}
                {connectionTestResult.table_exists !== undefined && (
                  <>
                    <br />Table exists: {connectionTestResult.table_exists ? 'Yes' : 'No'}
                  </>
                )}
              </Alert>
            )}

            <Group justify="space-between">
              <Button
                variant="light"
                leftSection={<IconPlugConnected size={16} />}
                onClick={handleTestConnection}
                loading={testingConnection}
                type="button"
              >
                Test Connection
              </Button>

              <Group>
                <Button variant="subtle" onClick={() => navigate('/postgres-configs')}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  {id ? 'Update' : 'Create'}
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
