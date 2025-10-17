import { useEffect, useState } from 'react';
import { Container, Title, Paper, Select, TextInput, NumberInput, Button, Switch, Group, Text, SegmentedControl } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { LogSource, InfluxConfig, PostgresConfig } from '../types';

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logSources, setLogSources] = useState<LogSource[]>([]);
  const [influxConfigs, setInfluxConfigs] = useState<InfluxConfig[]>([]);
  const [postgresConfigs, setPostgresConfigs] = useState<PostgresConfig[]>([]);

  const form = useForm({
    initialValues: {
      log_source_id: '',
      destination_type: 'influxdb' as 'influxdb' | 'postgresql',
      influx_config_id: '',
      postgres_config_id: '',
      cron_schedule: '*/5 * * * *',
      lookback_minutes: 5,
      max_lookback_minutes: 30,
      enabled: 1,
    },
    validate: {
      log_source_id: (val) => (!val ? 'Log source required' : null),
      influx_config_id: (val, values) => (values.destination_type === 'influxdb' && !val ? 'InfluxDB config required' : null),
      postgres_config_id: (val, values) => (values.destination_type === 'postgresql' && !val ? 'PostgreSQL config required' : null),
      cron_schedule: (val) => (!val ? 'Cron schedule required' : null),
      lookback_minutes: (val) => (val < 0 ? 'Must be 0 or greater' : null),
      max_lookback_minutes: (val) => {
        if (val < 1) return 'Must be at least 1 minute';
        if (val > 43200) return 'Maximum is 43200 minutes (30 days)';
        return null;
      },
    },
  });

  useEffect(() => {
    loadOptions();
    if (id) {
      loadJob();
    }
  }, [id]);

  async function loadOptions() {
    try {
      const [sources, influxConfigs, postgresConfigs] = await Promise.all([
        api.getLogSources(),
        api.getInfluxConfigs(),
        api.getPostgresConfigs(),
      ]);
      setLogSources(sources.filter(s => s.enabled));
      setInfluxConfigs(influxConfigs.filter(c => c.enabled));
      setPostgresConfigs(postgresConfigs.filter(c => c.enabled));
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function loadJob() {
    try {
      const jobs = await api.getJobs();
      const job = jobs.find(j => j.id === Number(id));
      if (job) {
        form.setValues({
          log_source_id: String(job.log_source_id),
          destination_type: job.destination_type || 'influxdb',
          influx_config_id: job.influx_config_id ? String(job.influx_config_id) : '',
          postgres_config_id: job.postgres_config_id ? String(job.postgres_config_id) : '',
          cron_schedule: job.cron_schedule,
          lookback_minutes: job.lookback_minutes || 5,
          max_lookback_minutes: job.max_lookback_minutes || 30,
          enabled: job.enabled,
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload: any = {
        log_source_id: Number(values.log_source_id),
        destination_type: values.destination_type,
        cron_schedule: values.cron_schedule,
        lookback_minutes: values.lookback_minutes,
        max_lookback_minutes: values.max_lookback_minutes,
        enabled: values.enabled,
      };

      if (values.destination_type === 'influxdb') {
        payload.influx_config_id = Number(values.influx_config_id);
        payload.postgres_config_id = null;
      } else {
        payload.postgres_config_id = Number(values.postgres_config_id);
        payload.influx_config_id = null;
      }

      if (id) {
        await api.updateJob(Number(id), payload);
        notifications.show({ title: 'Success', message: 'Job updated', color: 'green' });
      } else {
        await api.createJob(payload);
        notifications.show({ title: 'Success', message: 'Job created', color: 'green' });
      }
      navigate('/jobs');
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm">
      <Title order={2} mb="lg">
        {id ? 'Edit Job' : 'New Job'}
      </Title>

      <Paper shadow="sm" p="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Select
            label="Log Source"
            placeholder="Select log source"
            data={logSources.map(s => ({ value: String(s.id), label: `${s.name} (${s.source_type})` }))}
            required
            mb="md"
            {...form.getInputProps('log_source_id')}
          />

          <div style={{ marginBottom: '1rem' }}>
            <Text size="sm" fw={500} mb={4}>Destination Type</Text>
            <SegmentedControl
              value={form.values.destination_type}
              onChange={(value) => form.setFieldValue('destination_type', value as 'influxdb' | 'postgresql')}
              data={[
                { label: 'InfluxDB', value: 'influxdb' },
                { label: 'PostgreSQL', value: 'postgresql' },
              ]}
            />
          </div>

          {form.values.destination_type === 'influxdb' ? (
            <Select
              label="InfluxDB Config"
              placeholder="Select InfluxDB config"
              data={influxConfigs.map(c => ({ value: String(c.id), label: c.name }))}
              required
              mb="md"
              {...form.getInputProps('influx_config_id')}
            />
          ) : (
            <Select
              label="PostgreSQL Config"
              placeholder="Select PostgreSQL config"
              data={postgresConfigs.map(c => ({ value: String(c.id), label: c.name }))}
              required
              mb="md"
              {...form.getInputProps('postgres_config_id')}
            />
          )}
          <TextInput
            label="Cron Schedule"
            placeholder="*/5 * * * *"
            description="Every 5 minutes"
            required
            mb="xs"
            {...form.getInputProps('cron_schedule')}
          />
          <Text size="xs" c="dimmed" mb="md">
            Examples: */5 * * * * (every 5 min), 0 * * * * (hourly), 0 0 * * * (daily)
          </Text>
          <NumberInput
            label="Lookback/Overlap Minutes"
            placeholder="5"
            description="Minutes to look back from last run to avoid data gaps due to delays"
            min={0}
            max={43200}
            required
            mb="md"
            {...form.getInputProps('lookback_minutes')}
          />
          <NumberInput
            label="Max Lookback Minutes"
            placeholder="30"
            description="Maximum lookback window after job downtime (1-43200 minutes / 30 days). Prevents source overload after long outages."
            min={1}
            max={43200}
            required
            mb="md"
            {...form.getInputProps('max_lookback_minutes')}
          />
          <Switch
            label="Enabled"
            mb="lg"
            checked={form.values.enabled === 1}
            onChange={(e) => form.setFieldValue('enabled', e.currentTarget.checked ? 1 : 0)}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => navigate('/jobs')}>
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
