import { useEffect, useState } from 'react';
import { Container, Title, Button, Table, Badge, ActionIcon, Group, Text, Tooltip, Modal, NumberInput, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconEdit, IconTrash, IconPlayerPlay, IconClockCancel } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { Job } from '../types';
import { formatTableDate } from '../utils/dateFormat';

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runningJobs, setRunningJobs] = useState<Set<number>>(new Set());
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetJobId, setResetJobId] = useState<number | null>(null);
  const [resetMinutes, setResetMinutes] = useState(5);
  const navigate = useNavigate();

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this job?')) return;

    try {
      await api.deleteJob(id);
      notifications.show({ title: 'Success', message: 'Job deleted', color: 'green' });
      loadJobs();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleRunJob(id: number) {
    setRunningJobs(prev => new Set(prev).add(id));
    try {
      const result = await api.runJob(id);
      notifications.show({
        title: 'Job Started',
        message: result.message,
        color: 'blue'
      });
      // Reload jobs after a delay to show updated last_run
      setTimeout(() => {
        loadJobs();
        setRunningJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 2000);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  function openResetModal(id: number) {
    setResetJobId(id);
    setResetMinutes(5);
    setResetModalOpen(true);
  }

  async function handleResetLastRun() {
    if (!resetJobId) return;

    try {
      await api.resetJobLastRun(resetJobId, resetMinutes);
      notifications.show({
        title: 'Success',
        message: `Job last run reset to ${resetMinutes} minutes ago`,
        color: 'green'
      });
      setResetModalOpen(false);
      loadJobs();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Jobs</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/jobs/new')}>
          Add Job
        </Button>
      </Group>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Log Source</Table.Th>
            <Table.Th>Destination</Table.Th>
            <Table.Th>Schedule</Table.Th>
            <Table.Th>Lookback</Table.Th>
            <Table.Th>Max Lookback</Table.Th>
            <Table.Th>Last Run</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {jobs.map((job) => (
            <Table.Tr key={job.id}>
              <Table.Td>{job.id}</Table.Td>
              <Table.Td>
                <Text size="sm">{job.log_source_name}</Text>
                {job.source_type && <Badge size="xs" variant="light">{job.source_type}</Badge>}
              </Table.Td>
              <Table.Td>
                <Text size="sm">{job.destination_type === 'postgresql' ? job.postgres_config_name : job.influx_config_name}</Text>
                <Badge size="xs" variant="light" color={job.destination_type === 'postgresql' ? 'blue' : 'cyan'}>
                  {job.destination_type === 'postgresql' ? 'PostgreSQL' : 'InfluxDB'}
                </Badge>
              </Table.Td>
              <Table.Td><Text ff="monospace" size="sm">{job.cron_schedule}</Text></Table.Td>
              <Table.Td>
                <Text size="sm">{job.lookback_minutes || 5} min</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="orange">{job.max_lookback_minutes || 30} min</Text>
              </Table.Td>
              <Table.Td>
                {formatTableDate(job.last_run)}
              </Table.Td>
              <Table.Td>
                <Badge color={job.enabled ? 'green' : 'gray'}>
                  {job.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Tooltip label="Run Job Now">
                    <ActionIcon
                      variant="light"
                      color="green"
                      onClick={() => handleRunJob(job.id)}
                      loading={runningJobs.has(job.id)}
                    >
                      <IconPlayerPlay size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Reset Last Run">
                    <ActionIcon
                      variant="light"
                      color="orange"
                      onClick={() => openResetModal(job.id)}
                    >
                      <IconClockCancel size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Edit Job">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => navigate(`/jobs/${job.id}/edit`)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete Job">
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(job.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Job Last Run"
      >
        <Stack>
          <Text size="sm">
            Reset the job's last run time to start fresh from a recent point. The next scheduled run will query from NOW minus the specified minutes.
          </Text>
          <NumberInput
            label="Lookback Minutes"
            description="Job will query from NOW minus this many minutes"
            value={resetMinutes}
            onChange={(val) => setResetMinutes(Number(val))}
            min={1}
            max={1440}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetLastRun} color="orange">
              Reset Last Run
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
