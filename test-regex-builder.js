/**
 * Test script for Regex Builder pattern generation
 * Run with: node test-regex-builder.js
 */

// Simulate the pattern generation functions
function detectPatternType(text) {
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
}

function generatePattern(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return '(\\{[\\s\\S]*?\\})';
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return '(\\[[\\s\\S]*?\\])';
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(trimmed)) {
    return '(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)';
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(trimmed)) {
    return '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3})';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return '(\\d{4}-\\d{2}-\\d{2})';
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
  }
  if (/^-?\d+$/.test(trimmed)) {
    return '(-?\\d+)';
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return '(-?\\d+\\.\\d+)';
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    return '(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})';
  }
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})';
  }
  if (/^(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)$/i.test(trimmed)) {
    return '(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL)';
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return '"([^"]*)"';
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return `\\b(${trimmed})\\b`;
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `(${escaped})`;
}

function createBetweenPattern(text) {
  if (!text || text.length === 0) return '';
  if (/^\s+$/.test(text)) return '\\s+';
  if (/[A-Z_]+\s*:\s*$/i.test(text)) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return '.*?';
}

function buildCombinedPattern(captureGroups, sampleText) {
  if (captureGroups.length === 0) return '';

  const sortedGroups = [...captureGroups].sort((a, b) => a.startPos - b.startPos);
  let combinedPattern = '';
  let lastEndPos = 0;

  for (let i = 0; i < sortedGroups.length; i++) {
    const group = sortedGroups[i];

    if (group.startPos > lastEndPos) {
      const betweenText = sampleText.substring(lastEndPos, group.startPos);
      const betweenPattern = createBetweenPattern(betweenText);
      combinedPattern += betweenPattern;
    }

    combinedPattern += group.pattern;
    lastEndPos = group.endPos;
  }

  return combinedPattern;
}

// Test Cases
console.log('🧪 Regex Builder Pattern Generation Tests\n');

const tests = [
  {
    name: 'Timestamp + JSON',
    sampleText: '2024-10-15 10:30:45.123 INFO RIDE_DASHBOARD_RESPONSE : {"userId":123}',
    selections: [
      { start: 0, end: 23, text: '2024-10-15 10:30:45.123' },
      { start: 56, end: 70, text: '{"userId":123}' }
    ],
    expectedPattern: '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}).*?(\\{[\\s\\S]*?\\})'
  },
  {
    name: 'Date + Level + Number',
    sampleText: '[2024-10-15] LEVEL:ERROR ID:12345 Message:Failed',
    selections: [
      { start: 1, end: 11, text: '2024-10-15' },
      { start: 19, end: 24, text: 'ERROR' },
      { start: 28, end: 33, text: '12345' }
    ],
    expectedPattern: '.*?(\\d{4}-\\d{2}-\\d{2})\\] LEVEL:(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|CRITICAL) ID:(-?\\d+)'
  },
  {
    name: 'IP Address',
    sampleText: 'Request from 192.168.1.1 received',
    selections: [
      { start: 13, end: 25, text: '192.168.1.1' }
    ],
    expectedPattern: '.*?(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})'
  },
  {
    name: 'Email',
    sampleText: 'User: user@example.com logged in',
    selections: [
      { start: 6, end: 22, text: 'user@example.com' }
    ],
    expectedPattern: 'User: ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'
  },
  {
    name: 'UUID',
    sampleText: 'ID: 550e8400-e29b-41d4-a716-446655440000 created',
    selections: [
      { start: 4, end: 40, text: '550e8400-e29b-41d4-a716-446655440000' }
    ],
    expectedPattern: 'ID: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
  },
  {
    name: 'ISO Timestamp',
    sampleText: '2024-10-15T10:30:45.123Z Event occurred',
    selections: [
      { start: 0, end: 24, text: '2024-10-15T10:30:45.123Z' }
    ],
    expectedPattern: '(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)'
  }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  console.log(`📋 Test: ${test.name}`);
  console.log(`   Sample: ${test.sampleText}`);

  // Create capture groups
  const captureGroups = test.selections.map((sel, idx) => ({
    id: idx + 1,
    selectedText: sel.text,
    pattern: generatePattern(sel.text),
    startPos: sel.start,
    endPos: sel.end,
    description: detectPatternType(sel.text)
  }));

  // Build combined pattern
  const result = buildCombinedPattern(captureGroups, test.sampleText);

  console.log(`   Groups: ${captureGroups.map((g, i) => `Group ${i+1}=${g.description}`).join(', ')}`);
  console.log(`   Expected: ${test.expectedPattern}`);
  console.log(`   Got:      ${result}`);

  if (result === test.expectedPattern) {
    console.log('   ✅ PASS\n');
    passed++;
  } else {
    console.log('   ❌ FAIL\n');
    failed++;
  }
});

// Test the actual regex matching
console.log('🔍 Testing actual regex matching\n');

const matchTests = [
  {
    name: 'Extract Timestamp and JSON',
    text: '2024-10-15 10:30:45.123 INFO RIDE_DASHBOARD_RESPONSE : {"userId":123,"action":"login"}',
    pattern: '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}).*?(\\{[\\s\\S]*?\\})',
    expectedGroups: ['2024-10-15 10:30:45.123', '{"userId":123,"action":"login"}']
  },
  {
    name: 'Extract Date, Level, ID',
    text: '[2024-10-15] LEVEL:ERROR ID:12345 Message:Failed',
    pattern: '\\[(\\d{4}-\\d{2}-\\d{2})\\].*?LEVEL:\\b(ERROR)\\b.*?ID:(-?\\d+)',
    expectedGroups: ['2024-10-15', 'ERROR', '12345']
  }
];

matchTests.forEach(test => {
  console.log(`📋 Match Test: ${test.name}`);
  console.log(`   Text: ${test.text}`);
  console.log(`   Pattern: ${test.pattern}`);

  const regex = new RegExp(test.pattern);
  const match = regex.exec(test.text);

  if (match) {
    const groups = match.slice(1);
    console.log(`   Captured Groups: ${groups.map((g, i) => `Group ${i+1}="${g}"`).join(', ')}`);

    const allMatch = groups.every((g, i) => g === test.expectedGroups[i]);
    if (allMatch) {
      console.log('   ✅ PASS - All groups match!\n');
      passed++;
    } else {
      console.log(`   ❌ FAIL - Expected: ${test.expectedGroups.map((g, i) => `Group ${i+1}="${g}"`).join(', ')}\n`);
      failed++;
    }
  } else {
    console.log('   ❌ FAIL - No match!\n');
    failed++;
  }
});

console.log('═══════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════\n');

if (failed === 0) {
  console.log('✅ All tests passed! The regex builder logic is working correctly.');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review the implementation.');
  process.exit(1);
}
