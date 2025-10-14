import { useState } from 'react';
import { Modal, Title, Paper, Text, Group, Button, Stack, Badge, Code } from '@mantine/core';
import { IconChevronRight, IconChevronDown } from '@tabler/icons-react';

interface JsonPathPickerProps {
  opened: boolean;
  onClose: () => void;
  jsonData: any;
  onSelect: (path: string, value: any) => void;
}

export function JsonPathPicker({ opened, onClose, jsonData, onSelect }: JsonPathPickerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['$']));

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const getValueType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'string': return 'blue';
      case 'number': return 'green';
      case 'boolean': return 'yellow';
      case 'array': return 'grape';
      case 'object': return 'violet';
      case 'null': return 'gray';
      default: return 'gray';
    }
  };

  const renderValue = (value: any, path: string, depth: number = 0) => {
    const type = getValueType(value);
    const isExpanded = expandedPaths.has(path);
    const paddingLeft = depth * 20;

    // Primitive value (leaf node)
    if (type !== 'object' && type !== 'array') {
      return (
        <Paper
          key={path}
          withBorder
          p="xs"
          mb="xs"
          style={{ paddingLeft, cursor: 'pointer' }}
          onClick={() => onSelect(path, value)}
          bg="gray.0"
        >
          <Group justify="space-between">
            <Group gap="xs">
              <Code>{path}</Code>
              <Badge size="xs" color={getTypeColor(type)}>{type}</Badge>
            </Group>
            <Text size="sm" c="dimmed" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {String(value)}
            </Text>
          </Group>
        </Paper>
      );
    }

    // Object or Array (branch node)
    const entries = Array.isArray(value)
      ? value.map((item, idx) => [String(idx), item])
      : Object.entries(value);

    return (
      <div key={path}>
        <Paper
          withBorder
          p="xs"
          mb="xs"
          style={{ paddingLeft, cursor: 'pointer' }}
          onClick={() => toggleExpand(path)}
          bg={isExpanded ? 'blue.0' : 'white'}
        >
          <Group justify="space-between">
            <Group gap="xs">
              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              <Code>{path}</Code>
              <Badge size="xs" color={getTypeColor(type)}>
                {type} {Array.isArray(value) && `[${value.length}]`}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {entries.length} {entries.length === 1 ? 'item' : 'items'}
            </Text>
          </Group>
        </Paper>

        {isExpanded && (
          <div>
            {entries.map(([key, val]) => {
              const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
              return renderValue(val, childPath, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={4}>JSONPath Picker</Title>}
      size="lg"
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Text size="sm" c="dimmed" mb="md">
        Click on any field to select its JSONPath expression. Primitive values (strings, numbers, booleans) can be used as tags or fields.
      </Text>

      <Stack gap="xs">
        {jsonData ? renderValue(jsonData, '$') : (
          <Text c="dimmed">No JSON data available</Text>
        )}
      </Stack>

      <Group justify="flex-end" mt="lg">
        <Button variant="subtle" onClick={onClose}>
          Close
        </Button>
      </Group>
    </Modal>
  );
}
