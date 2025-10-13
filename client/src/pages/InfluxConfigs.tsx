import { useEffect, useState } from 'react';
import { Container, Title, Button, Table, Badge, ActionIcon, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { InfluxConfig } from '../types';

export default function InfluxConfigs() {
  const [configs, setConfigs] = useState<InfluxConfig[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      const data = await api.getInfluxConfigs();
      setConfigs(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this InfluxDB config?')) return;

    try {
      await api.deleteInfluxConfig(id);
      notifications.show({ title: 'Success', message: 'Config deleted', color: 'green' });
      loadConfigs();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>InfluxDB Configurations</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/influx-configs/new')}>
          Add InfluxDB Config
        </Button>
      </Group>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>URL</Table.Th>
            <Table.Th>Database</Table.Th>
            <Table.Th>Measurement</Table.Th>
            <Table.Th>Batch Size</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {configs.map((config) => (
            <Table.Tr key={config.id}>
              <Table.Td>{config.name}</Table.Td>
              <Table.Td>{config.url}</Table.Td>
              <Table.Td>{config.database}</Table.Td>
              <Table.Td>{config.measurement_name}</Table.Td>
              <Table.Td>{config.batch_size}</Table.Td>
              <Table.Td>
                <Badge color={config.enabled ? 'green' : 'gray'}>
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => navigate(`/influx-configs/${config.id}/edit`)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => handleDelete(config.id)}
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
