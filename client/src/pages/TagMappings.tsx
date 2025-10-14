import { useEffect, useState } from 'react';
import { Container, Title, Button, Paper, TextInput, Select, Table, ActionIcon, Group, Text, Switch, Code, Divider, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { IconPlus, IconTrash, IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { TagMapping, LogSource } from '../types';

export default function TagMappings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<TagMapping[]>([]);
  const [logSource, setLogSource] = useState<LogSource | null>(null);
  const [extractedJSON, setExtractedJSON] = useState<any>(null);
  const [loadingSamples, setLoadingSamples] = useState(false);

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

  async function loadExtractedJSON() {
    setLoadingSamples(true);
    try {
      // First get the regex pattern for this log source
      const patterns = await api.getRegexPatterns(Number(id));
      if (patterns.length === 0) {
        notifications.show({
          title: 'No Regex Pattern',
          message: 'Please create a regex pattern first to extract JSON from logs',
          color: 'yellow'
        });
        setLoadingSamples(false);
        return;
      }

      // Get sample data from the log source
      const result = await api.testLogSource(Number(id));
      if (!result.success || !result.samples || result.samples.length === 0) {
        notifications.show({
          title: 'No Data',
          message: 'No logs found in the last 5 minutes',
          color: 'yellow'
        });
        setLoadingSamples(false);
        return;
      }

      // Test the regex pattern on the first sample
      const testResult = await api.testRegex({
        pattern: patterns[0].pattern,
        test_sample: JSON.stringify(result.samples[0])
      });

      if (testResult.success && testResult.parsed) {
        setExtractedJSON(testResult.parsed);
        notifications.show({
          title: 'Success',
          message: 'JSON extracted from sample log',
          color: 'green'
        });
      } else {
        notifications.show({
          title: 'Extraction Failed',
          message: 'Could not extract JSON using the regex pattern',
          color: 'red'
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoadingSamples(false);
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
        <Group justify="space-between" mb="md">
          <Title order={4}>Add New Mapping</Title>
          <Button variant="light" size="sm" onClick={loadExtractedJSON} loading={loadingSamples}>
            Load Sample JSON
          </Button>
        </Group>

        {extractedJSON && (
          <>
            <Alert icon={<IconInfoCircle size={16} />} title="Extracted JSON Sample" color="blue" mb="md">
              Use JSONPath expressions to extract values from this JSON structure
            </Alert>
            <Divider my="md" label="Sample Extracted JSON" labelPosition="center" />
            <Paper withBorder p="sm" mb="md" style={{ maxHeight: '300px', overflow: 'auto' }}>
              <Code block style={{ fontSize: '11px' }}>
                {JSON.stringify(extractedJSON, null, 2)}
              </Code>
            </Paper>
            <Text size="sm" c="dimmed" mb="md">
              Example JSONPath expressions: <Code>$.userId</Code>, <Code>$.response.statusCode</Code>, <Code>$.tags[0]</Code>
            </Text>
            <Divider my="md" />
          </>
        )}

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
