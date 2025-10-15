import { useEffect, useState } from 'react';
import { Container, Title, Table, Badge, Pagination, Group, Collapse, ActionIcon, Code, Text, Box, Stack, Button, Modal, NumberInput } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { ActivityLog } from '../types';
import { formatDetailDate } from '../utils/dateFormat';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [retentionModalOpen, setRetentionModalOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState(3);
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function handleDeleteOldLogs() {
    if (!confirm(`Delete activity logs older than ${retentionDays} days?`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/activity-logs/cleanup?days=${retentionDays}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete old logs');

      const result = await response.json();
      notifications.show({
        title: 'Success',
        message: `Deleted ${result.deleted} log entries older than ${retentionDays} days`,
        color: 'green'
      });

      setRetentionModalOpen(false);
      loadLogs();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setIsDeleting(false);
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'red';
      case 'warning': return 'yellow';
      default: return 'blue';
    }
  };

  const toggleRow = (logId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const renderDetails = (log: ActivityLog) => {
    if (!log.details) return null;

    try {
      const details = JSON.parse(log.details);
      return (
        <Box p="md" bg="gray.0" style={{ borderRadius: 4 }}>
          <Stack gap="sm">
            {details.error_type && (
              <div>
                <Text size="sm" fw={600}>Error Type:</Text>
                <Code block>{details.error_type}</Code>
              </div>
            )}
            {details.total_fetched !== undefined && (
              <div>
                <Text size="sm" fw={600}>Total Fetched:</Text>
                <Text size="sm">{details.total_fetched} logs</Text>
              </div>
            )}
            {details.log_source && (
              <div>
                <Text size="sm" fw={600}>Log Source:</Text>
                <Text size="sm">{details.log_source}</Text>
              </div>
            )}
            {details.influx_config && (
              <div>
                <Text size="sm" fw={600}>InfluxDB Config:</Text>
                <Text size="sm">{details.influx_config}</Text>
              </div>
            )}
            {details.query_window && (
              <div>
                <Text size="sm" fw={600}>Query Window:</Text>
                <Text size="sm">Start: {details.query_window.start}</Text>
                <Text size="sm">End: {details.query_window.end}</Text>
              </div>
            )}
            {details.sample_failures && details.sample_failures.length > 0 && (
              <div>
                <Text size="sm" fw={600}>Sample Failures ({details.sample_failures.length}):</Text>
                {details.sample_failures.map((failure: any, idx: number) => (
                  <Box key={idx} mt="xs" p="xs" bg="white" style={{ borderRadius: 4, border: '1px solid #e0e0e0' }}>
                    <Text size="xs" fw={600}>Reason:</Text>
                    <Text size="xs">{failure.reason}</Text>
                    {failure.log_message && (
                      <>
                        <Text size="xs" fw={600} mt="xs">Log Message:</Text>
                        <Code block>{failure.log_message.substring(0, 300)}...</Code>
                      </>
                    )}
                    {failure.timestamp && (
                      <>
                        <Text size="xs" fw={600} mt="xs">Timestamp:</Text>
                        <Text size="xs">{failure.timestamp}</Text>
                      </>
                    )}
                  </Box>
                ))}
              </div>
            )}
            {details.stack_trace && (
              <div>
                <Text size="sm" fw={600}>Stack Trace:</Text>
                <Code block>{details.stack_trace}</Code>
              </div>
            )}
            {details.job_config && (
              <div>
                <Text size="sm" fw={600}>Job Configuration:</Text>
                <Code block>{JSON.stringify(details.job_config, null, 2)}</Code>
              </div>
            )}
          </Stack>
        </Box>
      );
    } catch (e) {
      return (
        <Box p="md" bg="gray.0">
          <Text size="sm" c="red">Failed to parse details: {log.details}</Text>
        </Box>
      );
    }
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Activity Logs</Title>
        <Button
          leftSection={<IconTrash size={16} />}
          color="red"
          variant="light"
          onClick={() => setRetentionModalOpen(true)}
        >
          Clean Old Logs
        </Button>
      </Group>

      <Modal
        opened={retentionModalOpen}
        onClose={() => setRetentionModalOpen(false)}
        title="Clean Old Activity Logs"
      >
        <NumberInput
          label="Delete logs older than (days)"
          description="Activity logs older than this many days will be permanently deleted"
          value={retentionDays}
          onChange={(val) => setRetentionDays(val as number)}
          min={1}
          max={365}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setRetentionModalOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDeleteOldLogs}
            loading={isDeleting}
          >
            Delete Old Logs
          </Button>
        </Group>
      </Modal>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}></Table.Th>
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
            <>
              <Table.Tr key={log.id}>
                <Table.Td>
                  {log.details && (
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => toggleRow(log.id)}
                    >
                      {expandedRows.has(log.id) ? (
                        <IconChevronDown size={16} />
                      ) : (
                        <IconChevronRight size={16} />
                      )}
                    </ActionIcon>
                  )}
                </Table.Td>
                <Table.Td>{formatDetailDate(log.timestamp)}</Table.Td>
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
              {log.details && expandedRows.has(log.id) && (
                <Table.Tr key={`${log.id}-details`}>
                  <Table.Td colSpan={7}>
                    <Collapse in={expandedRows.has(log.id)}>
                      {renderDetails(log)}
                    </Collapse>
                  </Table.Td>
                </Table.Tr>
              )}
            </>
          ))}
        </Table.Tbody>
      </Table>

      <Group justify="center" mt="xl">
        <Pagination value={page} onChange={setPage} total={10} />
      </Group>
    </Container>
  );
}
