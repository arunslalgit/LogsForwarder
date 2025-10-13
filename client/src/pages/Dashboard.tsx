import { useEffect, useState } from 'react';
import { Container, Title, Grid, Card, Text, Badge, Table } from '@mantine/core';
import { api } from '../api/client';
import type { ActivityLog } from '../types';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [stats, setStats] = useState({ jobs: 0, sources: 0, influxConfigs: 0 });
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [jobs, sources, configs, logs] = await Promise.all([
        api.getJobs(),
        api.getLogSources(),
        api.getInfluxConfigs(),
        api.getActivityLogs(20, 0),
      ]);

      setStats({
        jobs: jobs.length,
        sources: sources.length,
        influxConfigs: configs.length,
      });

      setRecentLogs(logs);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'red';
      case 'warning': return 'yellow';
      default: return 'blue';
    }
  };

  return (
    <Container size="xl">
      <Title order={2} mb="lg">Dashboard</Title>

      <Grid mb="xl">
        <Grid.Col span={4}>
          <Card shadow="sm" padding="lg">
            <Text fw={500} size="xl">{stats.sources}</Text>
            <Text c="dimmed" size="sm">Log Sources</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card shadow="sm" padding="lg">
            <Text fw={500} size="xl">{stats.influxConfigs}</Text>
            <Text c="dimmed" size="sm">InfluxDB Configs</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card shadow="sm" padding="lg">
            <Text fw={500} size="xl">{stats.jobs}</Text>
            <Text c="dimmed" size="sm">Active Jobs</Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Title order={3} mb="md">Recent Activity</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Level</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th>Message</Table.Th>
            <Table.Th>Processed</Table.Th>
            <Table.Th>Failed</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {recentLogs.map((log) => (
            <Table.Tr key={log.id}>
              <Table.Td>{dayjs(log.timestamp).format('MMM DD HH:mm:ss')}</Table.Td>
              <Table.Td>
                <Badge color={getLevelColor(log.level)} size="sm">{log.level}</Badge>
              </Table.Td>
              <Table.Td>
                {log.log_source_name || 'N/A'}
                {log.source_type && <Badge ml="xs" size="xs" variant="light">{log.source_type}</Badge>}
              </Table.Td>
              <Table.Td>{log.message}</Table.Td>
              <Table.Td>{log.records_processed}</Table.Td>
              <Table.Td>{log.records_failed}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  );
}
