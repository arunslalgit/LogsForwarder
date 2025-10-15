import { useEffect, useState } from 'react';
import { Container, Title, Paper, Select, Textarea, Button, Table, Code, Text, Group, Alert, Badge, Tabs, Stack, LoadingOverlay } from '@mantine/core';
import { IconDatabase, IconPlayerPlay, IconRefresh, IconInfoCircle, IconTable, IconChartLine } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { InfluxConfig } from '../types';

export default function InfluxExplorer() {
  const [configs, setConfigs] = useState<InfluxConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<InfluxConfig | null>(null);
  const [query, setQuery] = useState('SELECT * FROM application_logs ORDER BY time DESC LIMIT 20');
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [measurements, setMeasurements] = useState<string[]>([]);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfigId) {
      const config = configs.find(c => c.id === Number(selectedConfigId));
      setSelectedConfig(config || null);
      if (config) {
        loadDatabases(config);
        loadMeasurements(config);
      }
    }
  }, [selectedConfigId, configs]);

  async function loadConfigs() {
    try {
      const data = await api.getInfluxConfigs();
      setConfigs(data);
      if (data.length > 0 && !selectedConfigId) {
        setSelectedConfigId(String(data[0].id));
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function loadDatabases(config: InfluxConfig) {
    try {
      const response = await fetch(`${config.url}/query?q=SHOW DATABASES`);
      const data = await response.json();
      if (data.results?.[0]?.series?.[0]?.values) {
        const dbs = data.results[0].series[0].values.map((v: any) => v[0]);
        setDatabases(dbs);
      }
    } catch (error: any) {
      console.error('Failed to load databases:', error);
    }
  }

  async function loadMeasurements(config: InfluxConfig) {
    try {
      const response = await fetch(`${config.url}/query?db=${config.database}&q=SHOW MEASUREMENTS`);
      const data = await response.json();
      if (data.results?.[0]?.series?.[0]?.values) {
        const measurements = data.results[0].series[0].values.map((v: any) => v[0]);
        setMeasurements(measurements);
      }
    } catch (error: any) {
      console.error('Failed to load measurements:', error);
    }
  }

  async function executeQuery() {
    if (!selectedConfig) {
      notifications.show({ title: 'Error', message: 'Please select an InfluxDB configuration', color: 'red' });
      return;
    }

    setLoading(true);
    setQueryResult(null);

    try {
      const response = await fetch(`${selectedConfig.url}/query?db=${selectedConfig.database}&q=${encodeURIComponent(query)}&epoch=ms`);
      const data = await response.json();

      if (data.error) {
        notifications.show({ title: 'Query Error', message: data.error, color: 'red' });
        setQueryResult({ error: data.error });
      } else {
        setQueryResult(data);
        notifications.show({ title: 'Success', message: 'Query executed successfully', color: 'green' });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
      setQueryResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(ts: number | string) {
    if (!ts) return '';
    const date = new Date(typeof ts === 'string' ? parseInt(ts) : ts);
    return date.toLocaleString();
  }

  function renderResults() {
    if (!queryResult) return null;

    if (queryResult.error) {
      return (
        <Alert color="red" icon={<IconInfoCircle size={16} />} mt="md">
          <Text size="sm" fw={500}>Query Error</Text>
          <Code block mt="xs">{queryResult.error}</Code>
        </Alert>
      );
    }

    if (!queryResult.results || queryResult.results.length === 0) {
      return (
        <Alert color="yellow" icon={<IconInfoCircle size={16} />} mt="md">
          No results returned
        </Alert>
      );
    }

    return (
      <Paper withBorder p="md" mt="md">
        {queryResult.results.map((result: any, resultIdx: number) => {
          if (!result.series || result.series.length === 0) {
            return (
              <Alert key={resultIdx} color="blue" icon={<IconInfoCircle size={16} />}>
                Query executed successfully but returned no data
              </Alert>
            );
          }

          return result.series.map((series: any, seriesIdx: number) => (
            <div key={`${resultIdx}-${seriesIdx}`} style={{ marginBottom: '20px' }}>
              <Group mb="md">
                <Badge color="blue" leftSection={<IconTable size={12} />}>
                  {series.name}
                </Badge>
                {series.tags && Object.keys(series.tags).length > 0 && (
                  <Text size="xs" c="dimmed">
                    Tags: {Object.entries(series.tags).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </Text>
                )}
              </Group>

              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      {series.columns.map((col: string, colIdx: number) => (
                        <Table.Th key={colIdx}>
                          <Text size="sm" fw={600}>{col}</Text>
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {series.values.map((row: any[], rowIdx: number) => (
                      <Table.Tr key={rowIdx}>
                        {row.map((cell: any, cellIdx: number) => (
                          <Table.Td key={cellIdx}>
                            <Text size="sm" ff={series.columns[cellIdx] === 'time' ? 'monospace' : undefined}>
                              {series.columns[cellIdx] === 'time'
                                ? formatTimestamp(cell)
                                : cell === null
                                  ? <Text c="dimmed" fs="italic">null</Text>
                                  : String(cell)}
                            </Text>
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              <Text size="xs" c="dimmed" mt="xs">
                {series.values.length} row(s) returned
              </Text>
            </div>
          ));
        })}
      </Paper>
    );
  }

  const sampleQueries = [
    { label: 'Recent Data (Last 20)', query: 'SELECT * FROM application_logs ORDER BY time DESC LIMIT 20' },
    { label: 'Count All Records', query: 'SELECT COUNT(*) FROM application_logs' },
    { label: 'Last Hour', query: `SELECT * FROM application_logs WHERE time > now() - 1h` },
    { label: 'Group by Tag', query: 'SELECT COUNT(*) FROM application_logs GROUP BY countrycode' },
    { label: 'Show Series', query: 'SHOW SERIES FROM application_logs LIMIT 10' },
    { label: 'Show Tag Keys', query: 'SHOW TAG KEYS FROM application_logs' },
    { label: 'Show Field Keys', query: 'SHOW FIELD KEYS FROM application_logs' },
  ];

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>InfluxDB Explorer</Title>
          <Text c="dimmed" size="sm">Query and validate your InfluxDB data</Text>
        </div>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={() => {
            loadConfigs();
            if (selectedConfig) {
              loadDatabases(selectedConfig);
              loadMeasurements(selectedConfig);
            }
          }}
        >
          Refresh
        </Button>
      </Group>

      <Paper shadow="sm" p="lg" mb="md" withBorder>
        <Group mb="md" align="flex-start">
          <Select
            label="InfluxDB Instance"
            placeholder="Select instance"
            data={configs.map(c => ({ value: String(c.id), label: c.name }))}
            value={selectedConfigId}
            onChange={setSelectedConfigId}
            style={{ flex: 1 }}
            leftSection={<IconDatabase size={16} />}
          />
          {selectedConfig && (
            <Paper withBorder p="sm" style={{ flex: 2 }}>
              <Text size="xs" fw={500} c="dimmed">Connection Details:</Text>
              <Text size="xs" mt={4}><strong>URL:</strong> {selectedConfig.url}</Text>
              <Text size="xs"><strong>Database:</strong> {selectedConfig.database}</Text>
              <Text size="xs"><strong>Measurement:</strong> {selectedConfig.measurement_name}</Text>
            </Paper>
          )}
        </Group>

        {selectedConfig && databases.length > 0 && (
          <Group mb="md">
            <Badge color="teal" variant="light">
              {databases.length} Database(s)
            </Badge>
            {measurements.length > 0 && (
              <Badge color="blue" variant="light">
                {measurements.length} Measurement(s)
              </Badge>
            )}
          </Group>
        )}

        <Tabs defaultValue="query" mb="md">
          <Tabs.List>
            <Tabs.Tab value="query" leftSection={<IconPlayerPlay size={14} />}>
              Query Editor
            </Tabs.Tab>
            <Tabs.Tab value="samples" leftSection={<IconChartLine size={14} />}>
              Sample Queries
            </Tabs.Tab>
            <Tabs.Tab value="schema" leftSection={<IconTable size={14} />}>
              Schema Info
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="query" pt="md">
            <Textarea
              label="InfluxQL Query"
              placeholder="SELECT * FROM application_logs ORDER BY time DESC LIMIT 20"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              minRows={4}
              autosize
              styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
            />
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              onClick={executeQuery}
              mt="md"
              loading={loading}
              disabled={!selectedConfig || !query}
            >
              Execute Query
            </Button>
          </Tabs.Panel>

          <Tabs.Panel value="samples" pt="md">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Click a query to load it into the editor:</Text>
              {sampleQueries.map((sq, idx) => (
                <Paper key={idx} withBorder p="sm" style={{ cursor: 'pointer' }} onClick={() => setQuery(sq.query)}>
                  <Text size="sm" fw={500} mb={4}>{sq.label}</Text>
                  <Code block style={{ fontSize: '11px' }}>{sq.query}</Code>
                </Paper>
              ))}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="schema" pt="md">
            {measurements.length > 0 ? (
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={500} mb="xs">Measurements in "{selectedConfig?.database}":</Text>
                  <Group gap="xs">
                    {measurements.map((m, idx) => (
                      <Badge key={idx} variant="light" color="blue">{m}</Badge>
                    ))}
                  </Group>
                </div>
                <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                  <Text size="xs">
                    Use sample queries to explore tag keys, field keys, and series information for each measurement.
                  </Text>
                </Alert>
              </Stack>
            ) : (
              <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
                No measurements found. Data may not have been written yet.
              </Alert>
            )}
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <LoadingOverlay visible={loading} overlayProps={{ radius: 'sm', blur: 2 }} />

      {renderResults()}
    </Container>
  );
}
