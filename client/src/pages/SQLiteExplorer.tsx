import { useEffect, useState } from 'react';
import { Container, Title, Paper, Textarea, Button, Table, Text, Group, Alert, Tabs, Stack, Code } from '@mantine/core';
import { IconDatabase, IconPlayerPlay, IconHistory, IconInfoCircle, IconTable } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

const QUERY_HISTORY_KEY = 'sqlite_explorer_query_history';
const MAX_HISTORY_SIZE = 10;

interface QueryResult {
  results: any[];
  rowCount: number;
  changes?: number;
  message?: string;
  error?: string;
}

interface TableInfo {
  name: string;
  type: string;
}

export default function SQLiteExplorer() {
  const [query, setQuery] = useState('SELECT * FROM log_sources LIMIT 20');
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  useEffect(() => {
    loadTables();
    loadQueryHistory();
  }, []);

  function loadQueryHistory() {
    try {
      const history = localStorage.getItem(QUERY_HISTORY_KEY);
      if (history) {
        setQueryHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  }

  function saveQueryToHistory(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const newHistory = [trimmedQuery, ...queryHistory.filter(q => q !== trimmedQuery)].slice(0, MAX_HISTORY_SIZE);
    setQueryHistory(newHistory);
    localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(newHistory));
  }

  async function loadTables() {
    try {
      const response = await fetch('/api/sqlite-explorer/tables');
      const data = await response.json();
      setTables(data);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: 'Failed to load tables', color: 'red' });
    }
  }

  async function executeQuery() {
    if (!query.trim()) {
      notifications.show({ title: 'Error', message: 'Please enter a query', color: 'red' });
      return;
    }

    setLoading(true);
    setQueryResult(null);

    try {
      const response = await fetch('/api/sqlite-explorer/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      });

      const data = await response.json();

      if (data.error) {
        notifications.show({ title: 'Query Error', message: data.error, color: 'red' });
        setQueryResult({ results: [], rowCount: 0, error: data.error });
      } else {
        setQueryResult(data);
        saveQueryToHistory(query.trim());

        if (data.message) {
          notifications.show({ title: 'Success', message: data.message, color: 'green' });
        } else {
          notifications.show({ title: 'Success', message: `Query returned ${data.rowCount} rows`, color: 'green' });
        }
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
      setQueryResult({ results: [], rowCount: 0, error: error.message });
    } finally {
      setLoading(false);
    }
  }

  const sampleQueries = [
    {
      label: 'List all tables',
      query: "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
    },
    {
      label: 'View log sources',
      query: 'SELECT * FROM log_sources'
    },
    {
      label: 'View jobs with details',
      query: `SELECT j.id, j.enabled, j.cron_schedule, j.lookback_minutes, j.last_run,
       ls.name as log_source, ls.source_type,
       ic.name as influx_config
FROM jobs j
JOIN log_sources ls ON j.log_source_id = ls.id
JOIN influx_configs ic ON j.influx_config_id = ic.id`
    },
    {
      label: 'Recent activity logs',
      query: 'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50'
    },
    {
      label: 'Count activity logs by level',
      query: 'SELECT level, COUNT(*) as count FROM activity_logs GROUP BY level'
    },
    {
      label: 'View InfluxDB configs',
      query: 'SELECT * FROM influx_configs'
    }
  ];

  function renderResults() {
    if (!queryResult) return null;

    if (queryResult.error) {
      return (
        <Alert color="red" title="Error" icon={<IconInfoCircle />}>
          {queryResult.error}
        </Alert>
      );
    }

    if (queryResult.message) {
      return (
        <Alert color="green" title="Success">
          {queryResult.message}
        </Alert>
      );
    }

    if (queryResult.results.length === 0) {
      return (
        <Alert color="blue" title="No Results">
          Query executed successfully but returned no rows.
        </Alert>
      );
    }

    const columns = Object.keys(queryResult.results[0]);

    return (
      <Stack>
        <Text size="sm" c="dimmed">
          {queryResult.rowCount} rows returned
        </Text>
        <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th key={col}>{col}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {queryResult.results.map((row, idx) => (
                <Table.Tr key={idx}>
                  {columns.map((col) => (
                    <Table.Td key={col}>
                      {row[col] === null ? <Text c="dimmed" fs="italic">NULL</Text> : String(row[col])}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Stack>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Group>
          <IconDatabase size={32} />
          <Title order={2}>SQLite Database Explorer</Title>
        </Group>
      </Group>

      <Tabs defaultValue="query">
        <Tabs.List>
          <Tabs.Tab value="query" leftSection={<IconPlayerPlay size={16} />}>
            Query Editor
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            Query History
          </Tabs.Tab>
          <Tabs.Tab value="schema" leftSection={<IconTable size={16} />}>
            Database Schema
          </Tabs.Tab>
          <Tabs.Tab value="samples" leftSection={<IconInfoCircle size={16} />}>
            Sample Queries
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="query" pt="md">
          <Paper p="md" withBorder>
            <Stack>
              <Textarea
                label="SQL Query"
                placeholder="Enter your SQL query here..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                minRows={6}
                maxRows={15}
                styles={{ input: { fontFamily: 'monospace' } }}
              />
              <Group>
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={executeQuery}
                  loading={loading}
                >
                  Execute Query
                </Button>
              </Group>
            </Stack>
          </Paper>

          {queryResult && (
            <Paper p="md" withBorder mt="md">
              <Title order={4} mb="md">Results</Title>
              {renderResults()}
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <Paper p="md" withBorder>
            <Title order={4} mb="md">Recent Queries</Title>
            {queryHistory.length === 0 ? (
              <Text c="dimmed">No query history yet. Execute some queries to see them here.</Text>
            ) : (
              <Stack gap="sm">
                {queryHistory.map((historyQuery, idx) => (
                  <Paper key={idx} p="sm" withBorder style={{ cursor: 'pointer' }} onClick={() => setQuery(historyQuery)}>
                    <Code block>{historyQuery}</Code>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="schema" pt="md">
          <Paper p="md" withBorder>
            <Title order={4} mb="md">Database Tables</Title>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tables.map((table) => (
                  <Table.Tr key={table.name}>
                    <Table.Td>
                      <Code>{table.name}</Code>
                    </Table.Td>
                    <Table.Td>{table.type}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setQuery(`SELECT * FROM ${table.name} LIMIT 20`)}
                        >
                          View Data
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setQuery(`PRAGMA table_info(${table.name})`)}
                        >
                          View Schema
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="samples" pt="md">
          <Paper p="md" withBorder>
            <Title order={4} mb="md">Sample Queries</Title>
            <Stack gap="md">
              {sampleQueries.map((sample, idx) => (
                <Paper key={idx} p="md" withBorder>
                  <Text fw={600} mb="xs">{sample.label}</Text>
                  <Code block mb="sm">{sample.query}</Code>
                  <Button size="xs" onClick={() => setQuery(sample.query)}>
                    Use This Query
                  </Button>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
