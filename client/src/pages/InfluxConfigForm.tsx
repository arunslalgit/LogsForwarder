import { useEffect, useState } from 'react';
import { Container, Title, Paper, TextInput, NumberInput, Button, Switch, Group, PasswordInput, Alert, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconPlugConnected, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { api } from '../api/client';

export default function InfluxConfigForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);

  const form = useForm({
    initialValues: {
      name: '',
      url: '',
      database: '',
      username: '',
      password: '',
      measurement_name: '',
      batch_size: 100,
      batch_interval_seconds: 10,
      proxy_url: '',
      proxy_username: '',
      proxy_password: '',
      timestamp_format: 'nanoseconds',
      enabled: 1,
    },
    validate: {
      name: (val) => (val.length < 2 ? 'Name required' : null),
      url: (val) => (!val ? 'URL required' : null),
      database: (val) => (!val ? 'Database required' : null),
      measurement_name: (val) => (!val ? 'Measurement name required' : null),
      batch_size: (val) => (val < 1 || val > 10000 ? 'Must be between 1 and 10000' : null),
      batch_interval_seconds: (val) => (val < 1 || val > 3600 ? 'Must be between 1 and 3600' : null),
    },
  });

  useEffect(() => {
    if (id) {
      loadConfig();
    }
  }, [id]);

  async function loadConfig() {
    try {
      const data = await api.getInfluxConfig(Number(id));
      form.setValues(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      if (id) {
        await api.updateInfluxConfig(Number(id), values);
        notifications.show({ title: 'Success', message: 'Config updated', color: 'green' });
      } else {
        await api.createInfluxConfig(values);
        notifications.show({ title: 'Success', message: 'Config created', color: 'green' });
      }
      navigate('/influx-configs');
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
      const result = await api.testInfluxConnection(form.values);
      setConnectionTestResult(result);
      if (result.success) {
        notifications.show({
          title: 'Success',
          message: result.message || 'Connected successfully',
          color: 'green'
        });
      } else if (result.warning) {
        notifications.show({
          title: 'Warning',
          message: result.message || result.error,
          color: 'yellow'
        });
      } else {
        notifications.show({
          title: 'Connection Failed',
          message: result.error || 'Failed to connect',
          color: 'red'
        });
      }
    } catch (error: any) {
      setConnectionTestResult({ success: false, error: error.message });
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setTestingConnection(false);
    }
  }

  return (
    <Container size="sm">
      <Title order={2} mb="lg">
        {id ? 'Edit InfluxDB Config' : 'New InfluxDB Config'}
      </Title>

      <Paper shadow="sm" p="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Name"
            placeholder="Production InfluxDB"
            required
            mb="md"
            {...form.getInputProps('name')}
          />
          <TextInput
            label="URL"
            placeholder="http://influxdb.local:8086"
            required
            mb="md"
            {...form.getInputProps('url')}
          />
          <TextInput
            label="Database"
            placeholder="logs"
            required
            mb="md"
            {...form.getInputProps('database')}
          />
          <TextInput
            label="Username (Optional)"
            placeholder="admin"
            mb="md"
            {...form.getInputProps('username')}
          />
          <PasswordInput
            label="Password (Optional)"
            placeholder="••••••••"
            mb="md"
            {...form.getInputProps('password')}
          />
          <TextInput
            label="Measurement Name"
            placeholder="application_logs"
            required
            mb="md"
            {...form.getInputProps('measurement_name')}
          />
          <NumberInput
            label="Batch Size"
            description="Number of points to batch before writing"
            placeholder="100"
            required
            min={1}
            max={10000}
            mb="md"
            {...form.getInputProps('batch_size')}
          />
          <NumberInput
            label="Batch Interval (seconds)"
            description="Time interval to flush batch"
            placeholder="10"
            required
            min={1}
            max={3600}
            mb="md"
            {...form.getInputProps('batch_interval_seconds')}
          />
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
            label="Timestamp Precision"
            description="Choose the precision for timestamps written to this InfluxDB database"
            data={[
              { value: 'nanoseconds', label: 'Nanoseconds (ns) - Default' },
              { value: 'milliseconds', label: 'Milliseconds (ms)' },
              { value: 'seconds', label: 'Seconds (s)' }
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

          <Button
            fullWidth
            variant="light"
            leftSection={<IconPlugConnected size={16} />}
            onClick={handleTestConnection}
            loading={testingConnection}
            mb="md"
            disabled={!form.values.url || !form.values.database}
          >
            Test Connection
          </Button>

          {connectionTestResult && (
            <Alert
              icon={connectionTestResult.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
              title={connectionTestResult.success ? 'Connection Successful' : 'Connection Failed'}
              color={connectionTestResult.success ? 'green' : connectionTestResult.warning ? 'yellow' : 'red'}
              mb="md"
            >
              {connectionTestResult.message || connectionTestResult.error}
              {connectionTestResult.influxVersion && (
                <div style={{marginTop: 4, fontSize: '0.85em', opacity: 0.8}}>
                  InfluxDB Version: {connectionTestResult.influxVersion}
                </div>
              )}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => navigate('/influx-configs')}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {id ? 'Update' : 'Create'}
            </Button>
          </Group>
        </form>
      </Paper>
    </Container>
  );
}
