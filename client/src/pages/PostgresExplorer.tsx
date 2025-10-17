import { useEffect, useState } from 'react';
import { Container, Title, Paper, Select, Textarea, Button, Table, Text, Group, Alert, Badge, Stack, LoadingOverlay } from '@mantine/core';
import { IconDatabase, IconPlayerPlay, IconTable, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import type { PostgresConfig } from '../types';

export default function PostgresExplorer() {
  const [configs, setConfigs] = useState<PostgresConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<PostgresConfig | null>(null);
  const [query, setQuery] = useState('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20');
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('public');

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfigId) {
      const config = configs.find(c => c.id === Number(selectedConfigId));
      setSelectedConfig(config || null);
      if (config) {
        loadSchemas(config.id);
      }
    }
  }, [selectedConfigId, configs]);

  useEffect(() => {
    if (selectedConfigId && selectedSchema) {
      loadTables(Number(selectedConfigId), selectedSchema);
    }
  }, [selectedConfigId, selectedSchema]);

  async function loadConfigs() {
    try {
      const data = await api.getPostgresConfigs();
      setConfigs(data);
      if (data.length > 0 && !selectedConfigId) {
        setSelectedConfigId(String(data[0].id));
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function loadSchemas(configId: number) {
    try {
      const result = await api.postgresSchemas(configId);
      if (result.success) {
        setSchemas(result.schemas);
      }
    } catch (error: any) {
      console.error('Failed to load schemas:', error);
    }
  }

  async function loadTables(configId: number, schemaName: string) {
    try {
      const result = await api.postgresTables(configId, schemaName);
      if (result.success) {
        setTables(result.tables);
      }
    } catch (error: any) {
      console.error('Failed to load tables:', error);
    }
  }

  async function executeQuery() {
    if (!selectedConfig) {
      notifications.show({ title: 'Error', message: 'Please select a PostgreSQL configuration', color: 'red' });
      return;
    }

    if (!query.trim()) {
      notifications.show({ title: 'Error', message: 'Please enter a query', color: 'red' });
      return;
    }

    setLoading(true);
    setQueryResult(null);

    try {
      const result = await api.postgresQuery(selectedConfig.id, query);

      if (result.success) {
        setQueryResult(result);
        notifications.show({
          title: 'Success',
          message: `Query returned ${result.rowCount} row(s)`,
          color: 'green'
        });
      } else {
        notifications.show({
          title: 'Query Failed',
          message: result.error || 'Failed to execute query',
          color: 'red'
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }

  function setQuickQuery(tableName: string) {
    setQuery(`SELECT * FROM ${selectedSchema}.${tableName} ORDER BY timestamp DESC LIMIT 20`);
  }

  return (
    <Container size="xl">
      <Title order={2} mb="lg">PostgreSQL Explorer</Title>

      <Stack gap="md">
        {/* Configuration Selection */}
        <Paper p="md" withBorder>
          <Group grow>
            <Select
              label="PostgreSQL Configuration"
              placeholder="Select config"
              data={configs.map(c => ({ value: String(c.id), label: `${c.name} (${c.host}:${c.port}/${c.database})` }))}
              value={selectedConfigId}
              onChange={setSelectedConfigId}
            />
            <Select
              label="Schema"
              placeholder="Select schema"
              data={schemas.map(s => ({ value: s, label: s }))}
              value={selectedSchema}
              onChange={(value) => setSelectedSchema(value || 'public')}
            />
          </Group>

          {selectedConfig && (
            <Alert icon={<IconInfoCircle size={16} />} color="blue" mt="md">
              <Text size="sm">
                <strong>Connected to:</strong> {selectedConfig.host}:{selectedConfig.port}/{selectedConfig.database}
              </Text>
            </Alert>
          )}
        </Paper>

        {/* Schema Browser */}
        {tables.length > 0 && (
          <Paper p="md" withBorder>
            <Group mb="xs">
              <IconTable size={20} />
              <Text fw={500}>Tables in {selectedSchema}</Text>
            </Group>
            <Group gap="xs">
              {tables.map(table => (
                <Badge
                  key={table}
                  variant="light"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setQuickQuery(table)}
                >
                  {table}
                </Badge>
              ))}
            </Group>
          </Paper>
        )}

        {/* Query Editor */}
        <Paper p="md" withBorder>
          <Text fw={500} mb="xs">SQL Query</Text>
          <Textarea
            placeholder="Enter your SQL query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minRows={4}
            maxRows={10}
            mb="md"
          />
          <Group>
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              onClick={executeQuery}
              loading={loading}
            >
              Execute Query
            </Button>
            <Button
              variant="light"
              onClick={() => setQuery('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20')}
            >
              Reset to Default
            </Button>
          </Group>
        </Paper>

        {/* Query Results */}
        {queryResult && (
          <Paper p="md" withBorder style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} />

            <Group justify="space-between" mb="md">
              <Group>
                <IconDatabase size={20} />
                <Text fw={500}>Query Results</Text>
              </Group>
              <Badge color="blue">{queryResult.rowCount} rows</Badge>
            </Group>

            {queryResult.rowCount === 0 ? (
              <Alert color="gray">No rows returned</Alert>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {queryResult.fields.map((field: any) => (
                        <Table.Th key={field.name}>{field.name}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {queryResult.rows.map((row: any, idx: number) => (
                      <Table.Tr key={idx}>
                        {queryResult.fields.map((field: any) => {
                          const value = row[field.name];
                          let displayValue;

                          if (value === null) {
                            displayValue = <Text c="dimmed">NULL</Text>;
                          } else if (typeof value === 'object') {
                            // Format objects/arrays as JSON
                            displayValue = JSON.stringify(value, null, 2);
                          } else {
                            displayValue = String(value);
                          }

                          return (
                            <Table.Td key={field.name}>
                              <Text size="sm" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-wrap' }}>
                                {displayValue}
                              </Text>
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
