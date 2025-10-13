import { useEffect, useState } from 'react';
import { Container, Title, Button, Paper, TextInput, Select, Table, ActionIcon, Group, Text, Switch } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { IconPlus, IconTrash, IconArrowLeft } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { TagMapping, LogSource } from '../types';

export default function TagMappings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<TagMapping[]>([]);
  const [logSource, setLogSource] = useState<LogSource | null>(null);

  const form = useForm({
    initialValues: {
      json_path: '',
      influx_tag_name: '',
      is_field: 0,
      data_type: 'string',
    },
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [source, mappingsData] = await Promise.all([
        api.getLogSource(Number(id)),
        api.getTagMappings(Number(id)),
      ]);
      setLogSource(source);
      setMappings(mappingsData);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleCreate(values: typeof form.values) {
    try {
      await api.createTagMapping({
        log_source_id: Number(id),
        ...values,
      } as any);
      notifications.show({ title: 'Success', message: 'Tag mapping created', color: 'green' });
      form.reset();
      loadData();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleDelete(mappingId: number) {
    if (!confirm('Delete this tag mapping?')) return;

    try {
      await api.deleteTagMapping(mappingId);
      notifications.show({ title: 'Success', message: 'Tag mapping deleted', color: 'green' });
      loadData();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <div>
          <Group mb="xs">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/log-sources')}
            >
              Back to Log Sources
            </Button>
          </Group>
          <Title order={2}>Tag Mappings</Title>
          {logSource && <Text c="dimmed" size="sm">For: {logSource.name}</Text>}
        </div>
      </Group>

      <Paper shadow="sm" p="lg" mb="xl">
        <Title order={4} mb="md">Add New Mapping</Title>
        <form onSubmit={form.onSubmit(handleCreate)}>
          <TextInput
            label="JSON Path"
            placeholder="$.userId or $.response.statusCode"
            required
            mb="md"
            {...form.getInputProps('json_path')}
          />
          <TextInput
            label="InfluxDB Tag/Field Name"
            placeholder="user_id"
            required
            mb="md"
            {...form.getInputProps('influx_tag_name')}
          />
          <Select
            label="Data Type"
            data={[
              { value: 'string', label: 'String' },
              { value: 'integer', label: 'Integer' },
              { value: 'float', label: 'Float' },
              { value: 'boolean', label: 'Boolean' },
            ]}
            required
            mb="md"
            {...form.getInputProps('data_type')}
          />
          <Switch
            label="Store as Field (instead of Tag)"
            description="Fields can be used for numeric values and aggregations"
            mb="md"
            checked={form.values.is_field === 1}
            onChange={(e) => form.setFieldValue('is_field', e.currentTarget.checked ? 1 : 0)}
          />
          <Group justify="flex-end">
            <Button type="submit" leftSection={<IconPlus size={16} />}>
              Add Mapping
            </Button>
          </Group>
        </form>
      </Paper>

      <Title order={4} mb="md">Existing Mappings</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>JSON Path</Table.Th>
            <Table.Th>InfluxDB Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Data Type</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {mappings.map((mapping) => (
            <Table.Tr key={mapping.id}>
              <Table.Td><Text ff="monospace">{mapping.json_path}</Text></Table.Td>
              <Table.Td>{mapping.influx_tag_name}</Table.Td>
              <Table.Td>{mapping.is_field ? 'Field' : 'Tag'}</Table.Td>
              <Table.Td>{mapping.data_type}</Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => handleDelete(mapping.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  );
}
