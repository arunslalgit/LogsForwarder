import { useEffect, useState } from 'react';
import { Container, Title, Button, Paper, TextInput, Textarea, Table, ActionIcon, Group, Text, Code } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { IconTrash, IconArrowLeft, IconCheck, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { RegexPattern, LogSource } from '../types';

export default function RegexPatterns() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<RegexPattern[]>([]);
  const [logSource, setLogSource] = useState<LogSource | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

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
        <Title order={4} mb="md">Add New Pattern</Title>
        <form onSubmit={form.onSubmit(handleCreate)}>
          <TextInput
            label="Regex Pattern"
            placeholder='\{"userId".*?\}'
            required
            mb="md"
            {...form.getInputProps('pattern')}
          />
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
    </Container>
  );
}
