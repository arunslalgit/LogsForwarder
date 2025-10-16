import { useEffect, useState } from 'react';
import { Container, Title, Button, Paper, TextInput, Select, Table, ActionIcon, Group, Text, Switch, Code, Divider, Alert, Badge, NumberInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate, useParams } from 'react-router-dom';
import { IconPlus, IconTrash, IconArrowLeft, IconInfoCircle, IconCheck, IconX, IconWand, IconDatabase, IconEdit, IconChevronRight } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../api/client';
import { JsonPathPicker } from '../components/JsonPathPicker';
import type { TagMapping, LogSource } from '../types';

export default function TagMappings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<TagMapping[]>([]);
  const [logSource, setLogSource] = useState<LogSource | null>(null);
  const [extractedJSON, setExtractedJSON] = useState<any>(null);
  const [allExtractedSamples, setAllExtractedSamples] = useState<any[]>([]); // Store all extracted samples
  const [extractedTimestamp, setExtractedTimestamp] = useState<string | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [pickerOpened, setPickerOpened] = useState(false);
  const [influxPreview, setInfluxPreview] = useState<any>(null);
  const [previewSampleCount, setPreviewSampleCount] = useState(1); // How many samples to show in preview
  const [timestampFormat, setTimestampFormat] = useState<'milliseconds' | 'seconds' | 'nanoseconds'>('nanoseconds');
  const [measurementName, setMeasurementName] = useState('application_logs'); // Configurable measurement name
  const [timeWindow, setTimeWindow] = useState(5); // Default to 5 minutes
  const [sampleLimit, setSampleLimit] = useState(50); // Default to 50 samples
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [editingMapping, setEditingMapping] = useState<TagMapping | null>(null);
  const [regexTestResult, setRegexTestResult] = useState<any>(null);

  const form = useForm({
    initialValues: {
      json_path: '',
      influx_tag_name: '',
      is_field: 0,
      data_type: 'string',
      is_static: 0,
      static_value: '',
      transform_regex: '',
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
      if (editingMapping) {
        // Update existing mapping
        await api.updateTagMapping(editingMapping.id, {
          ...values,
        } as any);
        notifications.show({ title: 'Success', message: 'Tag mapping updated', color: 'green' });
        setEditingMapping(null);
      } else {
        // Create new mapping
        await api.createTagMapping({
          log_source_id: Number(id),
          ...values,
        } as any);
        notifications.show({ title: 'Success', message: 'Tag mapping created', color: 'green' });
      }
      form.reset();
      loadData();
      // Auto-refresh preview if we have sample JSON
      if (extractedJSON) {
        loadInfluxPreview();
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleEdit(mapping: TagMapping) {
    setEditingMapping(mapping);
    form.setValues({
      json_path: mapping.json_path || '',
      influx_tag_name: mapping.influx_tag_name,
      is_field: mapping.is_field,
      data_type: mapping.data_type,
      is_static: (mapping as any).is_static || 0,
      static_value: (mapping as any).static_value || '',
      transform_regex: (mapping as any).transform_regex || '',
    });
  }

  function handleCancelEdit() {
    setEditingMapping(null);
    form.reset();
  }

  async function handleTestRegex() {
    if (!testResult || !testResult.result) {
      notifications.show({
        title: 'No Test Result',
        message: 'Please test the JSONPath first to see the extracted value',
        color: 'yellow'
      });
      return;
    }

    if (!form.values.transform_regex) {
      notifications.show({
        title: 'Missing Regex',
        message: 'Please enter a regex pattern to test',
        color: 'yellow'
      });
      return;
    }

    try {
      const regex = new RegExp(form.values.transform_regex, 'g');
      const originalValue = String(testResult.result);
      const transformedValue = originalValue.replace(regex, '');

      setRegexTestResult({
        success: true,
        original: originalValue,
        transformed: transformedValue,
        removed: originalValue.length - transformedValue.length
      });
    } catch (error: any) {
      setRegexTestResult({
        success: false,
        error: error.message
      });
    }
  }

  async function handleDelete(mappingId: number) {
    if (!confirm('Delete this tag mapping?')) return;

    try {
      await api.deleteTagMapping(mappingId);
      notifications.show({ title: 'Success', message: 'Tag mapping deleted', color: 'green' });
      loadData();
      // Auto-refresh preview if we have sample JSON
      if (extractedJSON) {
        loadInfluxPreview();
      }
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

      // Get sample data from the log source with configurable time window
      const result = await api.testLogSource(Number(id), timeWindow, sampleLimit);
      setTotalLogsCount(result.count || 0);
      if (!result.success || !result.samples || result.samples.length === 0) {
        const mins = timeWindow;
        const timeDesc = mins >= 1440
          ? `${Math.floor(mins / 1440)} day(s)`
          : mins >= 60
            ? `${Math.floor(mins / 60)} hour(s)`
            : `${mins} minute(s)`;
        notifications.show({
          title: 'No Data',
          message: `No logs found in the last ${timeDesc}`,
          color: 'yellow'
        });
        setLoadingSamples(false);
        return;
      }

      // Try each regex pattern until we find one that extracts valid JSON
      // Process multiple samples (up to 10)
      const samplesToProcess = result.samples.slice(0, Math.min(10, result.samples.length));
      const extractedSamples: any[] = [];
      let successfulPattern = null;
      let firstTimestamp = null;

      for (const pattern of patterns) {
        let samplesExtracted = 0;

        for (const sample of samplesToProcess) {
          const testResult = await api.testRegex({
            pattern: pattern.pattern,
            test_sample: sample.message
          });

          if (testResult.success && testResult.parsed) {
            const extractedData = testResult.parsed;

            // Check if we have multiple capture groups (timestamp in group1, JSON in group2)
            const captures = (testResult as any).captures;
            if (captures && captures.group1) {
              extractedData._timestamp = captures.group1;
              if (!firstTimestamp) firstTimestamp = captures.group1;
            }

            extractedSamples.push({ ...extractedData });
            samplesExtracted++;
          }
        }

        // If we extracted at least one sample, use this pattern
        if (samplesExtracted > 0) {
          successfulPattern = pattern;
          break;
        }
      }

      if (extractedSamples.length > 0 && successfulPattern) {
        // Store all samples
        setAllExtractedSamples(extractedSamples);

        // Set the first sample as the current one for JSONPath picker
        setExtractedJSON(extractedSamples[0]);

        if (firstTimestamp) {
          setExtractedTimestamp(firstTimestamp);
        }

        const timestampInfo = firstTimestamp ? ` (with timestamp: ${firstTimestamp})` : '';
        notifications.show({
          title: 'Success',
          message: `Extracted ${extractedSamples.length} sample(s) using pattern: "${successfulPattern.description || 'Untitled'}"${timestampInfo}`,
          color: 'green'
        });

        // Load InfluxDB preview with first sample
        await loadInfluxPreview(extractedSamples.slice(0, previewSampleCount));
      } else {
        notifications.show({
          title: 'No JSON Pattern Found',
          message: `Tested ${patterns.length} pattern(s) but none extracted valid JSON. Recommended pattern: (\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}).*?RIDE_DASHBOARD_RESPONSE\\s*:\\s*(\\{[\\s\\S]*?\\})`,
          color: 'red'
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoadingSamples(false);
    }
  }

  async function loadInfluxPreview(jsonDataOrArray?: any | any[], customFormat?: 'milliseconds' | 'seconds' | 'nanoseconds') {
    const dataToUse = jsonDataOrArray || (allExtractedSamples.length > 0 ? allExtractedSamples.slice(0, previewSampleCount) : extractedJSON);
    if (!dataToUse) return;

    try {
      const result = await api.previewInfluxLines({
        log_source_id: Number(id),
        test_json: dataToUse,
        measurement_name: measurementName,
        timestamp: extractedTimestamp || undefined,
        timestamp_format: customFormat || timestampFormat,
        sample_count: Array.isArray(dataToUse) ? dataToUse.length : 1
      });

      setInfluxPreview(result);
      if (!result.success) {
        notifications.show({
          title: 'Preview Failed',
          message: result.error || 'Could not generate InfluxDB preview',
          color: 'yellow'
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleTestJsonPath() {
    if (!extractedJSON) {
      notifications.show({
        title: 'No Sample Data',
        message: 'Please load sample JSON first',
        color: 'yellow'
      });
      return;
    }

    if (!form.values.json_path) {
      notifications.show({
        title: 'Missing JSONPath',
        message: 'Please enter a JSONPath expression',
        color: 'yellow'
      });
      return;
    }

    try {
      const result = await api.testJsonPath({
        json_path: form.values.json_path,
        test_json: extractedJSON
      });
      setTestResult(result);
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  function handleJsonPathSelect(path: string, value: any) {
    form.setFieldValue('json_path', path);

    // Auto-suggest field name from path
    const fieldName = path.split('.').pop()?.replace(/[\[\]$]/g, '') || '';
    if (fieldName && !form.values.influx_tag_name) {
      form.setFieldValue('influx_tag_name', fieldName.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    }

    // Auto-detect data type
    const valueType = typeof value;
    if (valueType === 'number') {
      form.setFieldValue('data_type', Number.isInteger(value) ? 'integer' : 'float');
      form.setFieldValue('is_field', 1); // Numbers are usually fields
    } else if (valueType === 'boolean') {
      form.setFieldValue('data_type', 'boolean');
    } else {
      form.setFieldValue('data_type', 'string');
    }

    setPickerOpened(false);
    setTestResult(null);

    notifications.show({
      title: 'JSONPath Selected',
      message: `Selected: ${path}`,
      color: 'green'
    });
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <div>
          <Group mb="xs" gap="xs">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/log-sources')}
            >
              Log Sources
            </Button>
            <IconChevronRight size={16} color="gray" />
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconWand size={14} />}
              onClick={() => navigate(`/log-sources/${id}/regex`)}
            >
              Regex Patterns
            </Button>
            <IconChevronRight size={16} color="gray" />
            <Text size="sm" fw={500}>Tag Mappings</Text>
            <IconChevronRight size={16} color="gray" />
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => navigate(`/log-sources/${id}/edit`)}
            >
              Edit Source
            </Button>
          </Group>
          <Title order={2}>Tag Mappings</Title>
          {logSource && <Text c="dimmed" size="sm">For: {logSource.name}</Text>}
        </div>
      </Group>

      <Paper shadow="sm" p="lg" mb="xl">
        <Group justify="space-between" mb="md">
          <Title order={4}>{editingMapping ? 'Edit Mapping' : 'Add New Mapping'}</Title>
          <Group>
            <NumberInput
              label="Time Window (min)"
              value={timeWindow}
              onChange={(val) => setTimeWindow(Number(val) || 5)}
              min={1}
              max={43200}
              style={{ width: 150 }}
            />
            <NumberInput
              label="Sample Limit"
              value={sampleLimit}
              onChange={(val) => setSampleLimit(Number(val) || 50)}
              min={1}
              max={1000}
              style={{ width: 130 }}
            />
            <Button variant="light" size="sm" onClick={loadExtractedJSON} loading={loadingSamples} style={{ marginTop: 25 }}>
              Load Sample JSON
            </Button>
          </Group>
        </Group>

        {extractedJSON && (
          <>
            <Alert icon={<IconInfoCircle size={16} />} title="Extracted JSON Sample" color="blue" mb="md">
              <Group justify="space-between">
                <Text size="sm">Use JSONPath expressions to extract values from this JSON structure</Text>
                {totalLogsCount > 1 && (
                  <Text size="sm" c="dimmed">
                    {totalLogsCount} logs available (showing first match)
                  </Text>
                )}
              </Group>
              {extractedTimestamp && (
                <Text size="sm" fw={500} mt="xs" c="teal">
                  🕐 Extracted Timestamp: <Code>{extractedTimestamp}</Code>
                  <Text size="xs" c="dimmed" component="span" ml="xs">
                    (available as $_timestamp for mapping)
                  </Text>
                </Text>
              )}
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
          <Switch
            label="Static Tag/Field"
            description="Use a hardcoded value instead of extracting from log JSON"
            mb="md"
            checked={form.values.is_static === 1}
            onChange={(e) => {
              form.setFieldValue('is_static', e.currentTarget.checked ? 1 : 0);
              // Clear json_path when switching to static
              if (e.currentTarget.checked) {
                form.setFieldValue('json_path', '');
              }
            }}
          />

          {form.values.is_static === 1 ? (
            <TextInput
              label="Static Value"
              placeholder="environment, production, etc."
              required
              mb="md"
              description="This value will be used for all logs"
              {...form.getInputProps('static_value')}
            />
          ) : (
            <>
              <Group align="flex-end" mb="md">
                <TextInput
                  label="JSON Path"
                  placeholder="$.userId or $.response.statusCode"
                  required
                  style={{ flex: 1 }}
                  {...form.getInputProps('json_path')}
                />
                <Button
                  variant="light"
                  color="violet"
                  leftSection={<IconWand size={16} />}
                  onClick={() => setPickerOpened(true)}
                  disabled={!extractedJSON}
                >
                  Pick
                </Button>
                <Button
                  variant="light"
                  onClick={handleTestJsonPath}
                  disabled={!extractedJSON || !form.values.json_path}
                >
                  Test
                </Button>
              </Group>

              <Group align="flex-end" mb="md">
                <TextInput
                  label="Transform Regex (Optional)"
                  placeholder="[0-9a-f]{8}-[0-9a-f]{4}-.* (removes UUIDs)"
                  style={{ flex: 1 }}
                  description="Use regex to remove variable parts (IDs, timestamps) to control cardinality. The matched pattern will be removed from the value."
                  {...form.getInputProps('transform_regex')}
                />
                <Button
                  variant="light"
                  onClick={handleTestRegex}
                  disabled={!testResult || !form.values.transform_regex}
                >
                  Test Regex
                </Button>
              </Group>

              {regexTestResult && (
                <Paper withBorder p="md" mb="md" bg={regexTestResult.success ? 'green.0' : 'red.0'}>
                  <Group mb="xs">
                    {regexTestResult.success ? <IconCheck color="green" /> : <IconX color="red" />}
                    <Text fw={500}>{regexTestResult.success ? 'Regex Transform Result' : 'Regex Error'}</Text>
                  </Group>
                  {regexTestResult.success ? (
                    <>
                      <Text size="sm" fw={500} mt="md">Original Value:</Text>
                      <Code block mt="xs">{regexTestResult.original}</Code>
                      <Text size="sm" fw={500} mt="md">After Transform:</Text>
                      <Code block mt="xs">{regexTestResult.transformed}</Code>
                      <Text size="xs" c="dimmed" mt="xs">
                        Removed {regexTestResult.removed} character(s)
                      </Text>
                    </>
                  ) : (
                    <Text size="sm" c="red" mt="xs">{regexTestResult.error}</Text>
                  )}
                </Paper>
              )}
            </>
          )}

          {testResult && (
            <Paper withBorder p="md" mb="md" bg={testResult.success ? 'green.0' : 'red.0'}>
              <Group mb="xs">
                {testResult.success ? <IconCheck color="green" /> : <IconX color="red" />}
                <Text fw={500}>{testResult.message || (testResult.success ? 'Match Found' : 'No Match')}</Text>
              </Group>
              {testResult.success && testResult.result !== undefined && (
                <>
                  <Text size="sm" fw={500} mt="md">Extracted Value:</Text>
                  <Code block mt="xs">
                    {typeof testResult.result === 'object'
                      ? JSON.stringify(testResult.result, null, 2)
                      : String(testResult.result)
                    }
                  </Code>
                  <Text size="xs" c="dimmed" mt="xs">Type: {testResult.type}</Text>
                </>
              )}
              {testResult.error && (
                <Text size="sm" c="red" mt="xs">{testResult.error}</Text>
              )}
            </Paper>
          )}
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
            {editingMapping && (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            )}
            <Button type="submit" leftSection={<IconPlus size={16} />}>
              {editingMapping ? 'Update Mapping' : 'Add Mapping'}
            </Button>
          </Group>
        </form>
      </Paper>

      <Title order={4} mb="md">Existing Mappings</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Source</Table.Th>
            <Table.Th>InfluxDB Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Data Type</Table.Th>
            <Table.Th>Transform</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {mappings.map((mapping) => (
            <Table.Tr key={mapping.id}>
              <Table.Td>
                {(mapping as any).is_static ? (
                  <Group gap="xs">
                    <Badge size="xs" color="teal" variant="light">Static</Badge>
                    <Text size="sm" c="dimmed">{(mapping as any).static_value}</Text>
                  </Group>
                ) : (
                  <Text ff="monospace" size="sm">{mapping.json_path}</Text>
                )}
              </Table.Td>
              <Table.Td>{mapping.influx_tag_name}</Table.Td>
              <Table.Td>{mapping.is_field ? 'Field' : 'Tag'}</Table.Td>
              <Table.Td>{mapping.data_type}</Table.Td>
              <Table.Td>
                {(mapping as any).transform_regex ? (
                  <Badge size="xs" color="yellow" variant="light" title={(mapping as any).transform_regex}>
                    Regex
                  </Badge>
                ) : (
                  <Text size="sm" c="dimmed">-</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => handleEdit(mapping)}
                    title="Edit mapping"
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => handleDelete(mapping.id)}
                    title="Delete mapping"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {influxPreview && influxPreview.success && (
        <Paper shadow="sm" p="lg" mt="xl" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <IconDatabase size={20} />
              <Title order={4}>InfluxDB Line Protocol Preview</Title>
            </Group>
            <Group>
              <Badge color="blue" variant="light">
                {influxPreview.tags_extracted || 0} Tags
              </Badge>
              <Badge color="green" variant="light">
                {influxPreview.fields_extracted || 0} Fields
              </Badge>
            </Group>
          </Group>

          <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
            This shows how your data will be formatted when sent to InfluxDB
          </Alert>

          <TextInput
            label="Measurement Name"
            description="Configure the measurement name for preview (this is typically set in InfluxDB Config)"
            placeholder="application_logs"
            value={measurementName}
            onChange={(e) => {
              setMeasurementName(e.target.value);
            }}
            onBlur={() => loadInfluxPreview()}
            mb="md"
          />

          {influxPreview.timestamp_info && (
            <Paper withBorder p="md" mb="md" bg="teal.0">
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500} mb="xs">Timestamp Information</Text>
                  <Text size="xs" c="dimmed">
                    Source: <Code>{influxPreview.timestamp_info.source === 'extracted' ? 'Extracted from log' : 'Current time (fallback)'}</Code>
                  </Text>
                  {influxPreview.timestamp_info.original_value !== 'none' && (
                    <Text size="xs" c="dimmed">
                      Original: <Code>{influxPreview.timestamp_info.original_value}</Code>
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    InfluxDB timestamp: <Code>{influxPreview.timestamp_info.influx_timestamp}</Code> ({influxPreview.timestamp_info.format})
                  </Text>
                </div>
                <Select
                  size="xs"
                  label="Timestamp Format"
                  value={timestampFormat}
                  onChange={(value) => {
                    const newFormat = value as 'milliseconds' | 'seconds' | 'nanoseconds';
                    setTimestampFormat(newFormat);
                    // Reload preview with the new format immediately
                    loadInfluxPreview(undefined, newFormat);
                  }}
                  data={[
                    { value: 'nanoseconds', label: 'Nanoseconds' },
                    { value: 'milliseconds', label: 'Milliseconds' },
                    { value: 'seconds', label: 'Seconds' }
                  ]}
                  style={{ minWidth: '150px' }}
                />
              </Group>
            </Paper>
          )}

          {influxPreview.lines && influxPreview.lines.length > 0 && (
            <>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Sample Line Protocol{influxPreview.samples_processed > 1 ? ` (${influxPreview.samples_processed} samples)` : ''}:</Text>
                {allExtractedSamples.length > previewSampleCount && (
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      const newCount = Math.min(previewSampleCount + 3, allExtractedSamples.length, 10);
                      setPreviewSampleCount(newCount);
                      loadInfluxPreview(allExtractedSamples.slice(0, newCount));
                    }}
                  >
                    Load More ({Math.min(allExtractedSamples.length - previewSampleCount, 3)} more available)
                  </Button>
                )}
              </Group>
              {influxPreview.lines.map((line: string, idx: number) => (
                <Paper key={idx} withBorder p="sm" mb="sm" bg="gray.0">
                  <Code block style={{ fontSize: '11px', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                    {line}
                  </Code>
                </Paper>
              ))}
            </>
          )}

          {influxPreview.extraction_errors && influxPreview.extraction_errors.length > 0 && (
            <>
              <Divider my="md" />
              <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Extraction Warnings">
                {influxPreview.extraction_errors.map((error: string, idx: number) => (
                  <Text key={idx} size="sm">{error}</Text>
                ))}
              </Alert>
            </>
          )}
        </Paper>
      )}

      <JsonPathPicker
        opened={pickerOpened}
        onClose={() => setPickerOpened(false)}
        jsonData={extractedJSON}
        onSelect={handleJsonPathSelect}
      />
    </Container>
  );
}
