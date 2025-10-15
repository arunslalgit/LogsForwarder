#!/usr/bin/env node

/**
 * Test script to verify log rotation functionality
 * This will write enough logs to trigger rotation
 */

const path = require('path');
const { Logger } = require('./server/utils/logger');

const logsDir = path.join(__dirname, 'dist', 'logs');
const logger = new Logger(logsDir, {
  maxFileSize: 1024, // 1 KB for testing (very small)
  maxFiles: 5,
  logFileName: 'test-rotation.log'
});

console.log('Testing log rotation...');
console.log(`Logs directory: ${logsDir}`);
console.log(`Max file size: 1 KB`);
console.log(`Max files: 5`);
console.log('');

// Write lots of log entries to trigger rotation
for (let i = 1; i <= 100; i++) {
  logger.info(`Test log entry #${i}`, {
    iteration: i,
    timestamp: new Date().toISOString(),
    randomData: Math.random().toString(36).substring(7),
    moreData: 'This is additional data to make the log entry larger and trigger rotation faster'
  });

  if (i % 10 === 0) {
    console.log(`✓ Wrote ${i} log entries`);
  }
}

console.log('');
console.log('Log files created:');
const logFiles = logger.getLogFiles();
logFiles.forEach((file, index) => {
  const sizeMB = (file.size / 1024).toFixed(2);
  console.log(`  ${index + 1}. ${file.name} - ${sizeMB} KB`);
});

console.log('');
console.log('✓ Log rotation test completed!');
console.log(`  Total files: ${logFiles.length}`);
console.log('  Check dist/logs/test-rotation.log* to verify rotation');
