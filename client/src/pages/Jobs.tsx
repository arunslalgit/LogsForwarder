import { useEffect, useState } from 'react';
import { Container, Title, Button, Table, Badge, ActionIcon, Group, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { Job } from '../types';
import dayjs from 'dayjs';

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
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
            <Table.Th>InfluxDB Config</Table.Th>
            <Table.Th>Schedule</Table.Th>
            <Table.Th>Lookback</Table.Th>
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
              <Table.Td>{job.influx_config_name}</Table.Td>
              <Table.Td><Text ff="monospace" size="sm">{job.cron_schedule}</Text></Table.Td>
              <Table.Td>
                <Text size="sm">{job.lookback_minutes || 5} min</Text>
              </Table.Td>
              <Table.Td>
                {job.last_run ? dayjs(job.last_run).format('MMM DD HH:mm') : 'Never'}
              </Table.Td>
              <Table.Td>
                <Badge color={job.enabled ? 'green' : 'gray'}>
                  {job.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => navigate(`/jobs/${job.id}/edit`)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => handleDelete(job.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  );
}
