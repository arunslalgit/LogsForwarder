import { useState, useEffect } from 'react';
import { Modal, Title, Paper, Text, Group, Button, Code, Alert, Stack, Badge, ActionIcon, Divider, TextInput, Textarea } from '@mantine/core';
import { IconWand, IconInfoCircle, IconTrash, IconRefresh, IconEdit, IconCheck, IconX, IconHandClick } from '@tabler/icons-react';

interface RegexHelperProps {
  opened: boolean;
  onClose: () => void;
  sampleText: string;
  onApply: (pattern: string) => void;
}

interface CaptureGroup {
  id: number;
  selectedText: string;
  pattern: string;
  startPos: number;
  endPos: number;
  description: string;
  color: string;
}

const GROUP_COLORS = [
  '#74c0fc', '#a5d8ff', '#91e099', '#ffe066',
  '#ffa8a8', '#e599f7', '#ffc078', '#74e8ca',
];

export function RegexHelper({ opened, onClose, sampleText, onApply }: RegexHelperProps) {
  const [captureGroups, setCaptureGroups] = useState<CaptureGroup[]>([]);
  const [finalPattern, setFinalPattern] = useState('');
  const [nextGroupId, setNextGroupId] = useState(1);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editPattern, setEditPattern] = useState('');

  useEffect(() => {
    if (opened) {
      setCaptureGroups([]);
      setFinalPattern('');
      setNextGroupId(1);
      setEditingGroupId(null);
    }
  }, [opened]);

  useEffect(() => {
    if (captureGroups.length === 0) {
      setFinalPattern('');
      return;
    }

    const sortedGroups = [...captureGroups].sort((a, b) => a.startPos - b.startPos);
    let combinedPattern = '';
    let lastEndPos = 0;

    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      if (group.startPos > lastEndPos) {
        const betweenText = sampleText.substring(lastEndPos, group.startPos);
        combinedPattern += createBetweenPattern(betweenText);
      }
      combinedPattern += group.pattern;
      lastEndPos = group.endPos;
    }

    setFinalPattern(combinedPattern);
  }, [captureGroups, sampleText]);

  const createBetweenPattern = (text: string): string => {
    if (!text || text.length === 0) return '';

    // Only preserve whitespace patterns
    if (/^\s+$/.test(text)) return '\\s+';

    // Everything else: use flexible matcher
    return '.*?';
  };

  const handleAddSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      alert('Please select some text first');
      return;
    }

    // Find the position in the original text
    const start = sampleText.indexOf(selectedText);
    if (start === -1) {
      alert('Could not find selected text in sample. Try selecting again.');
      return;
    }

    const end = start + selectedText.length;

    // Check overlap
    const hasOverlap = captureGroups.some(group =>
      (start < group.endPos && end > group.startPos)
    );

    if (hasOverlap) {
      alert('Selection overlaps with an existing capture group.');
      return;
    }

    addCaptureGroup(selectedText, start, end);

    // Clear selection
    selection.removeAllRanges();
  };

  const addCaptureGroup = (selectedText: string, startPos: number, endPos: number) => {
    const pattern = generatePattern(selectedText);
    const description = detectPatternType(selectedText);
    const color = GROUP_COLORS[(nextGroupId - 1) % GROUP_COLORS.length];

    const newGroup: CaptureGroup = {
      id: nextGroupId,
      selectedText,
      pattern,
      startPos,
      endPos,
      description,
      color
    };

    setCaptureGroups([...captureGroups, newGroup]);
    setNextGroupId(nextGroupId + 1);
  };

  const detectPatternType = (text: string): string => {
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) return 'JSON Object';
    if (text.trim().startsWith('[') && text.trim().endsWith(']')) return 'JSON Array';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)) return 'ISO Timestamp';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(text)) return 'Timestamp';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'Date';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return 'UUID';
    if (/^-?\d+$/.test(text)) return 'Integer';
    if (/^-?\d+\.\d+$/.test(text)) return 'Float';
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(text)) return 'IP Address';
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) return 'Email';
    if (/^(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)$/i.test(text)) return 'Log Level';
    if (text.startsWith('"') && text.endsWith('"')) return 'Quoted String';
    return 'Text';
  };

  const generatePattern = (text: string): string => {
    const trimmed = text.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return '(\\{[\\s\\S]*?\\})';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return '(\\[[\\s\\S]*?\\])';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(trimmed)) return '(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(trimmed)) return '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3})';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '(\\d{4}-\\d{2}-\\d{2})';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
    if (/^-?\d+$/.test(trimmed)) return '(-?\\d+)';
    if (/^-?\d+\.\d+$/.test(trimmed)) return '(-?\\d+\\.\\d+)';
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return '(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})';
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})';
    if (/^(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)$/i.test(trimmed)) return '(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)';
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return '"([^"]*)"';
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return `\\b(${trimmed})\\b`;

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `(${escaped})`;
  };

  const removeGroup = (id: number) => {
    setCaptureGroups(captureGroups.filter(g => g.id !== id));
  };

  const clearAllGroups = () => {
    setCaptureGroups([]);
    setFinalPattern('');
  };

  const startEditPattern = (group: CaptureGroup) => {
    setEditingGroupId(group.id);
    setEditPattern(group.pattern);
  };

  const saveEditPattern = (id: number) => {
    if (!editPattern.trim()) return;
    setCaptureGroups(captureGroups.map(g =>
      g.id === id ? { ...g, pattern: editPattern } : g
    ));
    setEditingGroupId(null);
    setEditPattern('');
  };

  const cancelEditPattern = () => {
    setEditingGroupId(null);
    setEditPattern('');
  };

  const handleApply = () => {
    if (finalPattern) {
      onApply(finalPattern);
      onClose();
    }
  };

  const renderHighlightedText = () => {
    const parts: React.ReactNode[] = [];
    const sortedGroups = [...captureGroups].sort((a, b) => a.startPos - b.startPos);

    let lastPos = 0;
    sortedGroups.forEach((group, idx) => {
      if (group.startPos > lastPos) {
        parts.push(
          <span key={`text-${idx}`}>
            {sampleText.substring(lastPos, group.startPos)}
          </span>
        );
      }

      parts.push(
        <span
          key={`highlight-${idx}`}
          style={{
            backgroundColor: group.color,
            padding: '2px 4px',
            borderRadius: '3px',
            position: 'relative',
            fontWeight: 500
          }}
        >
          <Badge
            size="xs"
            color="dark"
            style={{
              position: 'absolute',
              top: '-8px',
              left: '-8px',
              fontSize: '9px',
              height: '16px',
              padding: '0 4px'
            }}
          >
            {idx + 1}
          </Badge>
          {group.selectedText}
        </span>
      );
      lastPos = group.endPos;
    });

    if (lastPos < sampleText.length) {
      parts.push(
        <span key="text-end">
          {sampleText.substring(lastPos)}
        </span>
      );
    }

    return (
      <Text style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '24px' }}>
        {parts}
      </Text>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Title order={4}>
          <IconWand size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Multi-Group Regex Builder
        </Title>
      }
      size="xl"
    >
      <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
        <Text size="sm" fw={500} mb="xs">
          🎯 Drag-to-Select + Button to Add
        </Text>
        <Text size="sm" component="div">
          <strong>How to use:</strong>
          <ol style={{ marginTop: '4px', marginBottom: 0, paddingLeft: '20px' }}>
            <li><strong>Drag</strong> your mouse to select text (normal text selection)</li>
            <li>Click <strong>"Add as Capture Group"</strong> button</li>
            <li>Repeat for more groups</li>
          </ol>
        </Text>
      </Alert>

      <Text size="sm" fw={500} mb="xs">Sample Log (select text with mouse):</Text>

      <Textarea
        value={sampleText}
        readOnly
        rows={8}
        mb="xs"
        styles={{
          input: {
            fontFamily: 'monospace',
            fontSize: '12px',
            backgroundColor: '#f8f9fa'
          }
        }}
      />

      <Button
        fullWidth
        mb="md"
        color="green"
        leftSection={<IconHandClick size={16} />}
        onClick={handleAddSelection}
      >
        Add Selected Text as Capture Group
      </Button>

      {captureGroups.length > 0 && (
        <>
          <Divider my="md" label={
            <Paper withBorder p="xs" style={{ backgroundColor: '#f8f9fa' }}>
              <Text size="sm" fw={500}>Preview with Highlights:</Text>
            </Paper>
          } />

          <Paper withBorder p="md" mb="md" style={{ backgroundColor: '#f8f9fa', maxHeight: '200px', overflow: 'auto' }}>
            {renderHighlightedText()}
          </Paper>

          <Divider my="md" label="Capture Groups" labelPosition="center" />

          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={500}>Selected Groups ({captureGroups.length}):</Text>
            <Button
              variant="subtle"
              size="xs"
              color="red"
              leftSection={<IconRefresh size={14} />}
              onClick={clearAllGroups}
            >
              Clear All
            </Button>
          </Group>

          <Stack gap="xs" mb="md">
            {captureGroups.sort((a, b) => a.startPos - b.startPos).map((group, index) => (
              <Paper key={group.id} withBorder p="sm" style={{ backgroundColor: group.color + '20' }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <div style={{ width: 20, height: 20, backgroundColor: group.color, borderRadius: 4 }} />
                    <Badge color="blue" size="lg">Group {index + 1}</Badge>
                    <Badge color="gray" variant="light">{group.description}</Badge>
                  </Group>
                  <Group gap={4}>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="blue"
                      onClick={() => startEditPattern(group)}
                      title="Edit pattern"
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => removeGroup(group.id)}
                      title="Remove group"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Group>

                <Text size="xs" c="dimmed" mb={4}>Selected text:</Text>
                <Code block style={{ fontSize: '10px', maxHeight: '60px', overflow: 'auto', marginBottom: '8px' }}>
                  {group.selectedText}
                </Code>

                {editingGroupId === group.id ? (
                  <>
                    <Text size="xs" c="dimmed" mb={4}>Edit pattern:</Text>
                    <Group gap="xs" mb={4}>
                      <TextInput
                        value={editPattern}
                        onChange={(e) => setEditPattern(e.target.value)}
                        style={{ flex: 1 }}
                        size="xs"
                      />
                      <ActionIcon color="green" onClick={() => saveEditPattern(group.id)} size="sm">
                        <IconCheck size={14} />
                      </ActionIcon>
                      <ActionIcon color="gray" onClick={cancelEditPattern} size="sm">
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  </>
                ) : (
                  <>
                    <Text size="xs" c="dimmed" mb={4}>Generated pattern:</Text>
                    <Code block style={{ fontSize: '10px' }}>
                      {group.pattern}
                    </Code>
                  </>
                )}
              </Paper>
            ))}
          </Stack>

          <Divider my="md" label="Final Combined Pattern" labelPosition="center" />

          <Paper withBorder p="md" bg="green.0">
            <Text size="sm" fw={500} mb="xs">
              ✅ Complete Regex Pattern (Ready to Use):
            </Text>
            <Code block style={{ fontSize: '11px', wordBreak: 'break-all' }}>
              {finalPattern}
            </Code>
            <Text size="xs" c="dimmed" mt="xs">
              This pattern will extract {captureGroups.length} capture group{captureGroups.length !== 1 ? 's' : ''}.
            </Text>
          </Paper>
        </>
      )}

      {captureGroups.length === 0 && (
        <Alert color="blue" icon={<IconHandClick size={16} />}>
          <Text size="sm">
            Select some text above with your mouse, then click the button to add it as a capture group.
          </Text>
        </Alert>
      )}

      <Group justify="space-between" mt="lg">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={captureGroups.length === 0}
          color="green"
          leftSection={<IconWand size={16} />}
        >
          Apply Pattern ({captureGroups.length} group{captureGroups.length !== 1 ? 's' : ''})
        </Button>
      </Group>
    </Modal>
  );
}
