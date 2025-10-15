import { useState } from 'react';
import { Modal, Title, Paper, Text, Group, Button, Textarea, Code, Alert } from '@mantine/core';
import { IconWand, IconInfoCircle } from '@tabler/icons-react';

interface RegexHelperProps {
  opened: boolean;
  onClose: () => void;
  sampleText: string;
  onApply: (pattern: string) => void;
}

export function RegexHelper({ opened, onClose, sampleText, onApply }: RegexHelperProps) {
  const [selectedText, setSelectedText] = useState('');
  const [suggestedPattern, setSuggestedPattern] = useState('');

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const selection = target.value.substring(target.selectionStart, target.selectionEnd);
    if (selection) {
      setSelectedText(selection);
      generatePattern(selection);
    }
  };

  const generatePattern = (text: string) => {
    // BEST PRACTICE: Include context boundaries for safe extraction
    // Pattern structure: [left-boundary][capture-group][optional-right-boundary]

    // Find where this text appears in the sample to get context
    const textIndex = sampleText.indexOf(text);
    if (textIndex === -1) {
      setSuggestedPattern('Pattern not found in sample');
      return;
    }

    // Extract context before the selection (up to 100 chars)
    const beforeText = sampleText.substring(Math.max(0, textIndex - 100), textIndex);

    // 1. JSON object - WITH CONTEXT BOUNDARIES (BEST PRACTICE!)
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      // Look for a clear left boundary marker (e.g., "RESPONSE : ", "data: ", etc.)
      const leftBoundaryMatch = beforeText.match(/([A-Z_]+\s*:\s*)$/i) ||
                                beforeText.match(/([a-z]+\s*[:=]\s*)$/i) ||
                                beforeText.match(/(\w+\s+)$/);

      if (leftBoundaryMatch) {
        const boundary = leftBoundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        setSuggestedPattern(`${boundary}(\\{[\\s\\S]*?\\})`);
      } else {
        // No clear boundary, but still better than nothing - use word boundary
        setSuggestedPattern('\\s+(\\{[\\s\\S]*?\\})');
      }
      return;
    }

    // 2. JSON array - WITH CONTEXT
    if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
      const leftBoundaryMatch = beforeText.match(/([A-Z_]+\s*:\s*)$/i) ||
                                beforeText.match(/([a-z]+\s*[:=]\s*)$/i);
      if (leftBoundaryMatch) {
        const boundary = leftBoundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        setSuggestedPattern(`${boundary}(\\[[\\s\\S]*?\\])`);
      } else {
        setSuggestedPattern('\\s+(\\[[\\s\\S]*?\\])');
      }
      return;
    }

    // 3. ISO 8601 Timestamp (e.g., 2025-10-14T11:02:11.636Z)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)) {
      setSuggestedPattern('(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)');
      return;
    }

    // 4. Standard Timestamp (e.g., 2025-10-14 13:02:10.967)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(text)) {
      setSuggestedPattern('(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3})');
      return;
    }

    // 5. Date only (e.g., 2025-10-14)
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      setSuggestedPattern('(\\d{4}-\\d{2}-\\d{2})');
      return;
    }

    // 6. UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
      setSuggestedPattern('([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})');
      return;
    }

    // 7. Integer number
    if (/^-?\d+$/.test(text)) {
      setSuggestedPattern('(-?\\d+)');
      return;
    }

    // 8. Float number (e.g., 123.456, -45.67)
    if (/^-?\d+\.\d+$/.test(text)) {
      setSuggestedPattern('(-?\\d+\\.\\d+)');
      return;
    }

    // 9. IP Address (e.g., 192.168.1.1)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(text)) {
      setSuggestedPattern('(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})');
      return;
    }

    // 10. Email address
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) {
      setSuggestedPattern('([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})');
      return;
    }

    // 11. Log Level (INFO, ERROR, WARN, DEBUG, etc.)
    if (/^(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)$/i.test(text)) {
      setSuggestedPattern('(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)');
      return;
    }

    // 12. Quoted string - generalize to any quoted content
    if (text.startsWith('"') && text.endsWith('"')) {
      setSuggestedPattern('"([^"]*)"');
      return;
    }

    // 13. Default: check if it's a word/identifier pattern
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
      setSuggestedPattern(`\\b(${text})\\b`);
      return;
    }

    // 14. Last resort: escape special chars and wrap in capture group
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    setSuggestedPattern(`(${escaped})`);
  };

  const handleApply = () => {
    if (suggestedPattern) {
      onApply(suggestedPattern);
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={4}><IconWand size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />Regex Pattern Helper</Title>}
      size="lg"
    >
      <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
        <Text size="sm" fw={500} mb="xs">
          📍 Best Practice: Select the exact data you want to extract
        </Text>
        <Text size="sm">
          The helper uses <strong>context-aware extraction</strong> by analyzing text around your selection to create safe, reliable patterns.
        </Text>
        <Text size="xs" mt="xs" component="ul" style={{ marginLeft: '1rem' }}>
          <li><strong>For JSON:</strong> Automatically includes left boundary markers (e.g., "RESPONSE : ")</li>
          <li><strong>For timestamps/UUIDs:</strong> Creates generalized patterns that work across all logs</li>
          <li><strong>For numbers/emails:</strong> Detects type and adds proper capture groups</li>
        </Text>
      </Alert>

      <Text size="sm" fw={500} mb="xs">Sample Log:</Text>
      <Textarea
        value={sampleText}
        onSelect={handleTextSelect}
        readOnly
        rows={8}
        mb="md"
        styles={{
          input: {
            fontFamily: 'monospace',
            fontSize: '12px'
          }
        }}
      />

      {selectedText && (
        <>
          <Paper withBorder p="md" mb="md" bg="yellow.0">
            <Text size="sm" fw={500} mb="xs">Selected Text:</Text>
            <Code block>{selectedText}</Code>
          </Paper>

          <Paper withBorder p="md" mb="md" bg="green.0">
            <Text size="sm" fw={500} mb="xs">✅ Suggested Regex Pattern (Context-Aware):</Text>
            <Code block>{suggestedPattern}</Code>
            <Text size="xs" c="dimmed" mt="xs">
              {suggestedPattern.includes(':') || suggestedPattern.includes('=')
                ? '🎯 Includes left boundary marker for safe extraction. Only captures the target after specific context.'
                : '📦 Captures the target data with proper grouping for extraction.'}
            </Text>
          </Paper>
        </>
      )}

      <Group justify="space-between" mt="lg">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={!suggestedPattern}
          color="green"
        >
          Apply Pattern
        </Button>
      </Group>
    </Modal>
  );
}
