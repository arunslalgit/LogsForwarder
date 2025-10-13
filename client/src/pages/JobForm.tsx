import { useEffect, useState } from 'react';
import { Container, Title, Paper, Select, TextInput, NumberInput, Button, Switch, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { LogSource, InfluxConfig } from '../types';

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logSources, setLogSources] = useState<LogSource[]>([]);
  const [influxConfigs, setInfluxConfigs] = useState<InfluxConfig[]>([]);

  const form = useForm({
    initialValues: {
      log_source_id: '',
      influx_config_id: '',
      cron_schedule: '*/5 * * * *',
      lookback_minutes: 5,
      enabled: 1,
    },
    validate: {
      log_source_id: (val) => (!val ? 'Log source required' : null),
      influx_config_id: (val) => (!val ? 'InfluxDB config required' : null),
      cron_schedule: (val) => (!val ? 'Cron schedule required' : null),
      lookback_minutes: (val) => (val < 0 ? 'Must be 0 or greater' : null),
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
      const [sources, configs] = await Promise.all([
        api.getLogSources(),
        api.getInfluxConfigs(),
      ]);
      setLogSources(sources.filter(s => s.enabled));
      setInfluxConfigs(configs.filter(c => c.enabled));
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
          influx_config_id: String(job.influx_config_id),
          cron_schedule: job.cron_schedule,
          lookback_minutes: job.lookback_minutes || 5,
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
      const payload = {
        log_source_id: Number(values.log_source_id),
        influx_config_id: Number(values.influx_config_id),
        cron_schedule: values.cron_schedule,
        lookback_minutes: values.lookback_minutes,
        enabled: values.enabled,
      };

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
          <Select
            label="InfluxDB Config"
            placeholder="Select InfluxDB config"
            data={influxConfigs.map(c => ({ value: String(c.id), label: c.name }))}
            required
            mb="md"
            {...form.getInputProps('influx_config_id')}
          />
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
            max={60}
            required
            mb="md"
            {...form.getInputProps('lookback_minutes')}
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
