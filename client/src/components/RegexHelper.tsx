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
    // Try to detect JSON pattern
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      // JSON object detected - suggest pattern to capture it
      setSuggestedPattern('\\{[^}]+\\}');
      return;
    }

    if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
      // JSON array detected
      setSuggestedPattern('\\[[^\\]]+\\]');
      return;
    }

    // Check if it looks like a quoted string
    if (text.startsWith('"') && text.endsWith('"')) {
      const content = text.slice(1, -1);
      // Escape special regex characters in the content
      const escaped = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      setSuggestedPattern(`"${escaped}".*?\\{[\\s\\S]*?\\}`);
      return;
    }

    // Try to find JSON after the selected text
    const lines = sampleText.split('\n');
    for (const line of lines) {
      if (line.includes(text)) {
        // Look for JSON pattern after this text
        const jsonMatch = line.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          setSuggestedPattern(`${escaped}.*?(\\{[^}]+\\})`);
          return;
        }
      }
    }

    // Default: escape the text and suggest a pattern
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    setSuggestedPattern(escaped);
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
        <Text size="sm">
          Select the text you want to extract from the sample below. The helper will suggest a regex pattern.
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
            <Text size="sm" fw={500} mb="xs">Suggested Regex Pattern:</Text>
            <Code block>{suggestedPattern}</Code>
            <Text size="xs" c="dimmed" mt="xs">
              This pattern will match the selected text or JSON structure.
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
