const fs = require('fs');
const readline = require('readline');

/**
 * FileLogClient - Mock Splunk replacement that reads from local log files
 * Reads log files line by line and filters by timestamp
 */
class FileLogClient {
  constructor(config) {
    this.filePath = config.file_path;
    this.timeFormat = config.time_format || 'iso'; // 'iso' or 'custom'
  }

  /**
   * Parse timestamp from log line
   * Format: "2025-10-14 13:02:10.967  INFO ..."
   */
  parseTimestamp(line) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})/);
    if (match) {
      return new Date(match[1]);
    }
    return null;
  }

  /**
   * Fetch logs from file within time range
   * @param {string} searchQuery - Regex pattern to filter logs (similar to Splunk search)
   * @param {Date} startTime - Start of time window
   * @param {Date} endTime - End of time window
   * @param {string} index - Not used for file source
   */
  async fetchLogs(searchQuery, startTime, endTime, index) {
    return new Promise((resolve, reject) => {
      const logs = [];
      const fileStream = fs.createReadStream(this.filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineCount = 0;
      const maxLines = 10000; // Safety limit

      // Compile search regex if provided
      let searchRegex = null;
      if (searchQuery && searchQuery.trim()) {
        try {
          searchRegex = new RegExp(searchQuery, 'i'); // Case-insensitive search
        } catch (error) {
          console.log(`FileLogClient: Invalid regex pattern: ${searchQuery}`);
          // Continue without search filter if regex is invalid
        }
      }

      rl.on('line', (line) => {
        lineCount++;

        // Safety check to prevent reading too many lines
        if (lineCount > maxLines) {
          rl.close();
          return;
        }

        const timestamp = this.parseTimestamp(line);

        // Check timestamp filter
        if (timestamp && timestamp >= startTime && timestamp <= endTime) {
          // Apply search filter if provided
          if (searchRegex) {
            if (searchRegex.test(line)) {
              logs.push({
                timestamp: timestamp.toISOString(),
                message: line,
                source: this.filePath
              });
            }
          } else {
            // No search filter, include all logs in time range
            logs.push({
              timestamp: timestamp.toISOString(),
              message: line,
              source: this.filePath
            });
          }
        }
      });

      rl.on('close', () => {
        const searchInfo = searchRegex ? ` matching "${searchQuery}"` : '';
        console.log(`FileLogClient: Read ${lineCount} lines, found ${logs.length} within time range${searchInfo}`);
        resolve(logs);
      });

      rl.on('error', (error) => {
        fileStream.destroy();
        reject(error);
      });
    });
  }

  /**
   * Test connection by checking if file exists
   */
  async testConnection() {
    return new Promise((resolve, reject) => {
      fs.access(this.filePath, fs.constants.R_OK, (err) => {
        if (err) {
          reject(new Error(`Cannot read file: ${this.filePath}`));
        } else {
          resolve(true);
        }
      });
    });
  }
}

module.exports = { FileLogClient };
