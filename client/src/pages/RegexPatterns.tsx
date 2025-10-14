import { useEffect, useState } from 'react';
import { Container, Title, Button, Paper, TextInput, Textarea, Table, ActionIcon, Group, Text, Code, Stack, Divider, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { IconTrash, IconArrowLeft, IconCheck, IconX, IconWand } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import { RegexHelper } from '../components/RegexHelper';
import type { RegexPattern, LogSource } from '../types';

export default function RegexPatterns() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<RegexPattern[]>([]);
  const [logSource, setLogSource] = useState<LogSource | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [helperOpened, setHelperOpened] = useState(false);

  const form = useForm({
    initialValues: {
      pattern: '',
      description: '',
      test_sample: '',
    },
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [source, patternsData] = await Promise.all([
        api.getLogSource(Number(id)),
        api.getRegexPatterns(Number(id)),
      ]);
      setLogSource(source);
      setPatterns(patternsData);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function loadSampleData() {
    setLoadingSamples(true);
    try {
      const result = await api.testLogSource(Number(id));
      if (result.success && result.samples) {
        setSampleData(result.samples);
        notifications.show({
          title: 'Success',
          message: `Loaded ${result.samples.length} sample log(s)`,
          color: 'green'
        });
      } else {
        notifications.show({
          title: 'No Data',
          message: 'No logs found in the last 5 minutes',
          color: 'yellow'
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoadingSamples(false);
    }
  }

  async function handleCreate(values: typeof form.values) {
    try {
      await api.createRegexPattern({
        log_source_id: Number(id),
        ...values,
      });
      notifications.show({ title: 'Success', message: 'Pattern created', color: 'green' });
      form.reset();
      setTestResult(null);
      loadData();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleDelete(patternId: number) {
    if (!confirm('Delete this regex pattern?')) return;

    try {
      await api.deleteRegexPattern(patternId);
      notifications.show({ title: 'Success', message: 'Pattern deleted', color: 'green' });
      loadData();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleTest() {
    try {
      const result = await api.testRegex({
        pattern: form.values.pattern,
        test_sample: form.values.test_sample,
      });
      setTestResult(result);
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
          <Title order={2}>Regex Patterns</Title>
          {logSource && <Text c="dimmed" size="sm">For: {logSource.name}</Text>}
        </div>
      </Group>

      <Paper shadow="sm" p="lg" mb="xl">
        <Group justify="space-between" mb="md">
          <Title order={4}>Add New Pattern</Title>
          <Button variant="light" size="sm" onClick={loadSampleData} loading={loadingSamples}>
            Load Sample Data
          </Button>
        </Group>

        {sampleData.length > 0 && (
          <>
            <Divider my="md" label="Sample Logs from Source" labelPosition="center" />
            <Text size="sm" c="dimmed" mb="sm">
              Select a sample log to use for testing your regex pattern
            </Text>
            <Select
              placeholder="Select a sample log"
              data={sampleData.map((sample, idx) => ({
                value: String(idx),
                label: `Sample ${idx + 1}: ${JSON.stringify(sample).substring(0, 100)}...`
              }))}
              mb="md"
              onChange={(val) => {
                if (val !== null) {
                  const sample = sampleData[Number(val)];
                  form.setFieldValue('test_sample', JSON.stringify(sample));
                }
              }}
            />
            <Stack gap="xs" mb="md">
              {sampleData.slice(0, 3).map((sample, idx) => (
                <Paper key={idx} withBorder p="xs" style={{ cursor: 'pointer' }} onClick={() => form.setFieldValue('test_sample', JSON.stringify(sample))}>
                  <Text size="xs" c="dimmed" mb={4}>Sample {idx + 1} (click to use)</Text>
                  <Code block style={{ fontSize: '10px', maxHeight: '60px', overflow: 'auto' }}>
                    {JSON.stringify(sample, null, 2)}
                  </Code>
                </Paper>
              ))}
            </Stack>
            <Divider my="md" />
          </>
        )}

        <form onSubmit={form.onSubmit(handleCreate)}>
          <Group align="flex-end" mb="md">
            <TextInput
              label="Regex Pattern"
              placeholder='\{"userId".*?\}'
              required
              style={{ flex: 1 }}
              {...form.getInputProps('pattern')}
            />
            <Button
              variant="light"
              color="violet"
              leftSection={<IconWand size={16} />}
              onClick={() => setHelperOpened(true)}
              disabled={!form.values.test_sample}
            >
              Build
            </Button>
          </Group>
          <TextInput
            label="Description"
            placeholder="Extract user activity JSON"
            mb="md"
            {...form.getInputProps('description')}
          />
          <Textarea
            label="Test Sample Message"
            placeholder='2024-10-12 14:30:00 INFO {"userId":123,"action":"login"}'
            mb="md"
            rows={3}
            {...form.getInputProps('test_sample')}
          />

          <Group justify="space-between" mb="md">
            <Button variant="light" onClick={handleTest} disabled={!form.values.pattern || !form.values.test_sample}>
              Test Pattern
            </Button>
            <Button type="submit">Add Pattern</Button>
          </Group>

          {testResult && (
            <Paper withBorder p="md" bg={testResult.success ? 'green.0' : 'red.0'}>
              <Group mb="xs">
                {testResult.success ? <IconCheck color="green" /> : <IconX color="red" />}
                <Text fw={500}>{testResult.success ? 'Match Found' : 'No Match'}</Text>
              </Group>
              {testResult.extracted && (
                <>
                  <Text size="sm" fw={500} mt="md">Extracted:</Text>
                  <Code block mt="xs">{testResult.extracted}</Code>
                </>
              )}
              {testResult.parsed && (
                <>
                  <Text size="sm" fw={500} mt="md">Parsed JSON:</Text>
                  <Code block mt="xs">{JSON.stringify(testResult.parsed, null, 2)}</Code>
                </>
              )}
              {testResult.message && (
                <Text size="sm" c="dimmed" mt="xs">{testResult.message}</Text>
              )}
            </Paper>
          )}
        </form>
      </Paper>

      <Title order={4} mb="md">Existing Patterns</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Pattern</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {patterns.map((pattern) => (
            <Table.Tr key={pattern.id}>
              <Table.Td><Code>{pattern.pattern}</Code></Table.Td>
              <Table.Td>{pattern.description || 'N/A'}</Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => handleDelete(pattern.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <RegexHelper
        opened={helperOpened}
        onClose={() => setHelperOpened(false)}
        sampleText={form.values.test_sample}
        onApply={(pattern) => {
          form.setFieldValue('pattern', pattern);
          notifications.show({
            title: 'Pattern Applied',
            message: 'Regex pattern has been set. Test it to verify!',
            color: 'green'
          });
        }}
      />
    </Container>
  );
}
