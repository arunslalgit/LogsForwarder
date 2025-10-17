import { useEffect, useState } from 'react';
import { Container, Title, Paper, Select, Textarea, Button, Table, Code, Text, Group, Alert, Badge, Tabs, Stack, LoadingOverlay, Switch } from '@mantine/core';
import { IconDatabase, IconPlayerPlay, IconRefresh, IconInfoCircle, IconTable, IconChartLine, IconPencil, IconHistory, IconClock } from '@tabler/icons-react';
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
  const [writeData, setWriteData] = useState('test_measurement,tag1=value1 field1=123,field2="test" 1697463600000');
  const [writeResult, setWriteResult] = useState<any>(null);
  const [writePrecision, setWritePrecision] = useState('ms');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showEpochTime, setShowEpochTime] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadQueryHistory();
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

  function loadQueryHistory() {
    try {
      const saved = localStorage.getItem('influx_query_history');
      if (saved) {
        setQueryHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  }

  function saveToHistory(query: string) {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 5) return; // Don't save very short queries

    const newHistory = [trimmed, ...queryHistory.filter(q => q !== trimmed)].slice(0, 20); // Keep last 20
    setQueryHistory(newHistory);
    localStorage.setItem('influx_query_history', JSON.stringify(newHistory));
  }

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
        saveToHistory(query); // Save successful query to history
        notifications.show({ title: 'Success', message: 'Query executed successfully', color: 'green' });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
      setQueryResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function executeWrite() {
    if (!selectedConfig) {
      notifications.show({ title: 'Error', message: 'Please select an InfluxDB configuration', color: 'red' });
      return;
    }

    if (!writeData.trim()) {
      notifications.show({ title: 'Error', message: 'Please enter line protocol data to write', color: 'red' });
      return;
    }

    setLoading(true);
    setWriteResult(null);

    try {
      const writeUrl = `${selectedConfig.url}/write?db=${selectedConfig.database}&precision=${writePrecision}`;
      console.log('Writing to:', writeUrl);

      const response = await fetch(writeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: writeData
      });

      if (response.ok) {
        setWriteResult({ success: true, message: 'Data written successfully!' });
        notifications.show({ title: 'Success', message: 'Data written to InfluxDB', color: 'green' });
      } else {
        const errorText = await response.text();
        setWriteResult({ success: false, error: `HTTP ${response.status}: ${errorText}` });
        notifications.show({ title: 'Write Error', message: `HTTP ${response.status}`, color: 'red' });
      }
    } catch (error: any) {
      console.error('Write error:', error);
      setWriteResult({ success: false, error: error.message });
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(ts: number | string, showEpoch: boolean) {
    if (!ts) return '';

    const timestamp = typeof ts === 'string' ? parseInt(ts) : ts;

    // If showing epoch time, just return the raw timestamp
    if (showEpoch) {
      return String(timestamp);
    }

    // Otherwise show human-readable with milliseconds
    const date = new Date(timestamp);

    // Format: DD/MM/YYYY, HH:mm:ss.SSS
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}.${milliseconds}`;
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
      <>
        <Group justify="space-between" mt="md" mb="sm">
          <Text size="sm" fw={500}>Query Results</Text>
          <Group gap="xs">
            <IconClock size={16} />
            <Switch
              label="Show Epoch Time"
              checked={showEpochTime}
              onChange={(event) => setShowEpochTime(event.currentTarget.checked)}
              size="sm"
            />
          </Group>
        </Group>
        <Paper withBorder p="md">
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
                                ? formatTimestamp(cell, showEpochTime)
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
      </>
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
            <Tabs.Tab value="write" leftSection={<IconPencil size={14} />}>
              Write Test
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
              Query History
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

          <Tabs.Panel value="write" pt="md">
            <Alert color="blue" icon={<IconInfoCircle size={16} />} mb="md">
              <Text size="sm" fw={500} mb="xs">Test Write Endpoint</Text>
              <Text size="xs">
                This sends a POST request directly from your browser to test if the write endpoint is accessible.
                If this works but jobs fail, it means the Node.js server is being blocked by Zscaler/firewall.
              </Text>
            </Alert>

            <Select
              label="Timestamp Precision"
              description="Choose the precision for your timestamp values"
              data={[
                { value: 'ns', label: 'Nanoseconds (ns)' },
                { value: 'ms', label: 'Milliseconds (ms)' },
                { value: 's', label: 'Seconds (s)' }
              ]}
              value={writePrecision}
              onChange={(val) => setWritePrecision(val || 'ms')}
              mb="md"
              style={{ maxWidth: '300px' }}
            />

            <Textarea
              label="Line Protocol Data"
              description="Enter data in InfluxDB line protocol format"
              placeholder="measurement_name,tag1=value1 field1=123,field2='text' timestamp"
              value={writeData}
              onChange={(e) => setWriteData(e.target.value)}
              minRows={6}
              autosize
              styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
              mb="md"
            />

            <Code block mb="md" style={{ fontSize: '11px' }}>
              {`Example format:\n` +
               `test_measurement,tag1=value1,tag2=value2 field1=123,field2="text" ${Date.now()}\n\n` +
               `- measurement_name: Name of your measurement\n` +
               `- tags (optional): comma-separated key=value pairs\n` +
               `- fields (required): comma-separated key=value pairs\n` +
               `- timestamp (optional): numeric timestamp in chosen precision`}
            </Code>

            <Group>
              <Button
                leftSection={<IconPencil size={16} />}
                onClick={executeWrite}
                loading={loading}
                disabled={!selectedConfig || !writeData}
              >
                Write Data
              </Button>
              <Button
                variant="light"
                onClick={() => setWriteData(`test_measurement,tag1=testValue field1=123,field2="hello" ${Date.now()}`)}
              >
                Generate Sample
              </Button>
            </Group>

            {writeResult && (
              <Alert
                color={writeResult.success ? 'green' : 'red'}
                icon={<IconInfoCircle size={16} />}
                mt="md"
              >
                <Text size="sm" fw={500}>
                  {writeResult.success ? 'Write Successful!' : 'Write Failed'}
                </Text>
                {writeResult.message && <Text size="xs" mt="xs">{writeResult.message}</Text>}
                {writeResult.error && (
                  <Code block mt="xs" style={{ fontSize: '11px' }}>
                    {writeResult.error}
                  </Code>
                )}
              </Alert>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            {queryHistory.length > 0 ? (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Click a query to load it:</Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => {
                      setQueryHistory([]);
                      localStorage.removeItem('influx_query_history');
                      notifications.show({ title: 'Cleared', message: 'Query history cleared', color: 'green' });
                    }}
                  >
                    Clear History
                  </Button>
                </Group>
                {queryHistory.map((q, idx) => (
                  <Paper key={idx} withBorder p="sm" style={{ cursor: 'pointer' }} onClick={() => setQuery(q)}>
                    <Code block style={{ fontSize: '11px' }}>{q}</Code>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                No query history yet. Execute queries from the Query Editor to see them here.
              </Alert>
            )}
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
