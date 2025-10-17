const fs = require('fs');
const path = require('path');
const { redactSensitiveFields } = require('./sanitize');

class Logger {
  constructor(logDir, options = {}) {
    this.logDir = logDir;
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5 MB default
    this.maxFiles = options.maxFiles || 5; // 5 files default
    this.logFileName = options.logFileName || 'application.log';
    this.currentLogPath = path.join(this.logDir, this.logFileName);

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get timestamp in ISO format
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  formatMessage(level, message, metadata = null) {
    const timestamp = this.getTimestamp();
    let logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (metadata) {
      // Sanitize sensitive fields before logging
      const sanitizedMetadata = redactSensitiveFields(metadata);
      logLine += ` ${JSON.stringify(sanitizedMetadata)}`;
    }

    return logLine + '\n';
  }

  /**
   * Check if current log file needs rotation
   */
  needsRotation() {
    if (!fs.existsSync(this.currentLogPath)) {
      return false;
    }

    const stats = fs.statSync(this.currentLogPath);
    return stats.size >= this.maxFileSize;
  }

  /**
   * Rotate log files
   * application.log -> application.log.1
   * application.log.1 -> application.log.2
   * ... and so on
   */
  rotateFiles() {
    try {
      // Delete the oldest file if it exists
      const oldestFile = path.join(this.logDir, `${this.logFileName}.${this.maxFiles}`);
      if (fs.existsSync(oldestFile)) {
        fs.unlinkSync(oldestFile);
      }

      // Rotate existing numbered files
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const currentFile = path.join(this.logDir, `${this.logFileName}.${i}`);
        const nextFile = path.join(this.logDir, `${this.logFileName}.${i + 1}`);

        if (fs.existsSync(currentFile)) {
          fs.renameSync(currentFile, nextFile);
        }
      }

      // Rotate current log file to .1
      if (fs.existsSync(this.currentLogPath)) {
        const firstRotated = path.join(this.logDir, `${this.logFileName}.1`);
        fs.renameSync(this.currentLogPath, firstRotated);
      }
    } catch (error) {
      console.error('Error rotating log files:', error.message);
    }
  }

  /**
   * Write log entry to file
   */
  writeLog(level, message, metadata = null) {
    try {
      // Check if rotation is needed
      if (this.needsRotation()) {
        this.rotateFiles();
      }

      // Format and append log message
      const logMessage = this.formatMessage(level, message, metadata);
      fs.appendFileSync(this.currentLogPath, logMessage, 'utf8');

      // Also output to console
      console.log(logMessage.trim());
    } catch (error) {
      console.error('Error writing to log file:', error.message);
    }
  }

  /**
   * Log info level message
   */
  info(message, metadata = null) {
    this.writeLog('info', message, metadata);
  }

  /**
   * Log warning level message
   */
  warn(message, metadata = null) {
    this.writeLog('warn', message, metadata);
  }

  /**
   * Log error level message
   */
  error(message, metadata = null) {
    this.writeLog('error', message, metadata);
  }

  /**
   * Log debug level message (only in development)
   */
  debug(message, metadata = null) {
    if (process.env.DEBUG) {
      this.writeLog('debug', message, metadata);
    }
  }

  /**
   * Get all log files (sorted by modification time, newest first)
   */
  getLogFiles() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith(this.logFileName))
        .map(file => {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      return files;
    } catch (error) {
      console.error('Error getting log files:', error.message);
      return [];
    }
  }

  /**
   * Read last N lines from current log file
   */
  tail(lines = 100) {
    try {
      if (!fs.existsSync(this.currentLogPath)) {
        return [];
      }

      const content = fs.readFileSync(this.currentLogPath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      console.error('Error reading log file:', error.message);
      return [];
    }
  }
}

// Create singleton instance
let loggerInstance = null;

function initLogger(logDir, options) {
  if (!loggerInstance) {
    loggerInstance = new Logger(logDir, options);
  }
  return loggerInstance;
}

function getLogger() {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return loggerInstance;
}

module.exports = { initLogger, getLogger, Logger };
