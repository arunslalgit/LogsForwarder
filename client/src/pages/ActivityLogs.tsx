import { useEffect, useState } from 'react';
import { Container, Title, Table, Badge, Pagination, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { ActivityLog } from '../types';
import dayjs from 'dayjs';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    loadLogs();
  }, [page]);

  async function loadLogs() {
    try {
      const data = await api.getActivityLogs(pageSize, (page - 1) * pageSize);
      setLogs(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
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
      <Title order={2} mb="lg">Activity Logs</Title>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Timestamp</Table.Th>
            <Table.Th>Level</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th>Message</Table.Th>
            <Table.Th>Processed</Table.Th>
            <Table.Th>Failed</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {logs.map((log) => (
            <Table.Tr key={log.id}>
              <Table.Td>{dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}</Table.Td>
              <Table.Td>
                <Badge color={getLevelColor(log.level)} size="sm">
                  {log.level}
                </Badge>
              </Table.Td>
              <Table.Td>
                {log.log_source_name || 'N/A'}
                {log.source_type && (
                  <Badge ml="xs" size="xs" variant="light">
                    {log.source_type}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>{log.message}</Table.Td>
              <Table.Td>{log.records_processed}</Table.Td>
              <Table.Td>{log.records_failed}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group justify="center" mt="xl">
        <Pagination value={page} onChange={setPage} total={10} />
      </Group>
    </Container>
  );
}
