import { useEffect, useState } from 'react';
import { Container, Title, Button, Table, Badge, ActionIcon, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconEdit, IconTrash, IconWand, IconTag } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { LogSource } from '../types';

export default function LogSources() {
  const [sources, setSources] = useState<LogSource[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    try {
      const data = await api.getLogSources();
      setSources(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this log source? This will also delete associated regex patterns and tag mappings.')) return;

    try {
      await api.deleteLogSource(id);
      notifications.show({ title: 'Success', message: 'Log source deleted', color: 'green' });
      loadSources();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  const getSourceBadge = (type: string) => {
    const colors: Record<string, string> = { dynatrace: 'blue', splunk: 'green' };
    return <Badge color={colors[type]}>{type}</Badge>;
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Log Sources</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/log-sources/new')}>
          Add Log Source
        </Button>
      </Group>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>URL</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sources.map((source) => (
            <Table.Tr key={source.id}>
              <Table.Td>{source.name}</Table.Td>
              <Table.Td>{getSourceBadge(source.source_type)}</Table.Td>
              <Table.Td>{source.dynatrace_url || source.splunk_url}</Table.Td>
              <Table.Td>
                <Badge color={source.enabled ? 'green' : 'gray'}>
                  {source.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => navigate(`/log-sources/${source.id}/edit`)}
                    title="Edit"
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="violet"
                    onClick={() => navigate(`/log-sources/${source.id}/regex`)}
                    title="Regex Patterns"
                  >
                    <IconWand size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="teal"
                    onClick={() => navigate(`/log-sources/${source.id}/tags`)}
                    title="Tag Mappings"
                  >
                    <IconTag size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => handleDelete(source.id)}
                    title="Delete"
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
