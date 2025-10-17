const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const { getLogger } = require('../utils/logger');

class InfluxClient {
  constructor(config) {
    this.logger = getLogger();
    this.configId = config.id;
    this.configName = config.name;
    this.url = config.url;
    this.database = config.database;
    this.measurement = config.measurement_name;
    this.timestampFormat = config.timestamp_format || 'nanoseconds'; // Store timestamp format
    this.auth = config.username ? {
      username: config.username,
      password: config.password
    } : null;

    console.log(`[InfluxClient] Initializing for config "${config.name}" (ID: ${config.id})`);
    console.log(`[InfluxClient] Target: ${this.url}/${this.database}, Measurement: ${this.measurement}, Timestamp Format: ${this.timestampFormat}`);
    this.logger.info('InfluxClient initialized', {
      configId: config.id,
      configName: config.name,
      url: this.url,
      database: this.database,
      measurement: this.measurement,
      timestampFormat: this.timestampFormat,
      hasAuth: !!this.auth
    });

    // Store proxy configuration
    this.proxyConfig = { proxy: false }; // Explicitly disable proxy by default (ignore env vars)
    if (config.proxy_url) {
      const proxyUrl = new URL(config.proxy_url);
      if (config.proxy_username && config.proxy_password) {
        proxyUrl.username = config.proxy_username;
        proxyUrl.password = config.proxy_password;
      }

      // Determine if target is HTTP or HTTPS and use appropriate agent
      const isHttpsTarget = this.url.startsWith('https://');
      if (isHttpsTarget) {
        this.proxyConfig.httpsAgent = new HttpsProxyAgent(proxyUrl.href);
      } else {
        this.proxyConfig.httpAgent = new HttpProxyAgent(proxyUrl.href);
      }
      console.log(`[InfluxClient] Proxy configured: ${proxyUrl.origin} for ${isHttpsTarget ? 'HTTPS' : 'HTTP'} target`);
      this.logger.info('InfluxClient proxy configured', {
        configId: config.id,
        proxyHost: proxyUrl.origin,
        targetProtocol: isHttpsTarget ? 'https' : 'http'
      });
    } else {
      console.log(`[InfluxClient] Direct connection (no proxy)`);
      this.logger.info('InfluxClient direct connection', { configId: config.id });
    }

    this.batch = [];
    this.batchSize = config.batch_size || 100;
    this.batchInterval = (config.batch_interval_seconds || 10) * 1000;

    console.log(`[InfluxClient] Batch settings: size=${this.batchSize}, interval=${this.batchInterval}ms`);
    this.logger.info('InfluxClient batch settings', {
      configId: config.id,
      batchSize: this.batchSize,
      batchIntervalMs: this.batchInterval
    });

    this.startBatchTimer();
  }

  add(point) {
    this.batch.push(point);

    if (this.batch.length >= this.batchSize) {
      console.log(`[InfluxClient] Batch size reached (${this.batch.length}/${this.batchSize}), triggering flush`);
      this.flush();
    }
  }

  toLineProtocol(point) {
    const tagSet = Object.entries(point.tags || {})
      .map(([k, v]) => `${k}=${this.escapeTagValue(v)}`)
      .join(',');

    const fieldSet = Object.entries(point.fields || {})
      .map(([k, v]) => {
        if (typeof v === 'string') {
          return `${k}="${this.escapeFieldValue(v)}"`;
        } else if (Number.isInteger(v)) {
          return `${k}=${v}i`;
        }
        return `${k}=${v}`;
      })
      .join(',');

    if (!fieldSet) {
      throw new Error('At least one field is required');
    }

    const measurement = tagSet ? `${this.measurement},${tagSet}` : this.measurement;

    // Convert timestamp based on configured format
    const timeMs = point.timestamp.getTime();
    let timestamp;
    if (this.timestampFormat === 'milliseconds') {
      timestamp = timeMs;
    } else if (this.timestampFormat === 'seconds') {
      timestamp = Math.floor(timeMs / 1000);
    } else {
      // Default to nanoseconds
      timestamp = Math.floor(timeMs * 1000000);
    }

    return `${measurement} ${fieldSet} ${timestamp}`;
  }

  escapeTagValue(value) {
    return String(value).replace(/[,\s=]/g, '\\$&');
  }

  escapeFieldValue(value) {
    // Escape backslashes first, then double quotes
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  async flush() {
    if (this.batch.length === 0) {
      console.log(`[InfluxClient] Flush called but batch is empty, skipping`);
      return;
    }

    const startTime = Date.now();
    const batchCount = this.batch.length;

    console.log(`[InfluxClient] Starting flush of ${batchCount} points to ${this.configName}`);
    this.logger.info('InfluxDB flush started', {
      configId: this.configId,
      configName: this.configName,
      pointCount: batchCount
    });

    let lines;
    try {
      lines = this.batch.map(p => this.toLineProtocol(p)).join('\n');
      console.log(`[InfluxClient] Converted ${batchCount} points to line protocol (${lines.length} bytes)`);
    } catch (error) {
      console.error(`[InfluxClient] Line protocol conversion error:`, error.message);
      this.logger.error('InfluxDB line protocol conversion failed', {
        configId: this.configId,
        error: error.message,
        pointCount: batchCount
      });
      this.batch = [];
      throw error;
    }

    this.batch = [];

    // Map timestamp format to InfluxDB precision parameter
    let precision = 'ns'; // default nanoseconds
    if (this.timestampFormat === 'milliseconds') {
      precision = 'ms';
    } else if (this.timestampFormat === 'seconds') {
      precision = 's';
    }

    const writeUrl = `${this.url}/write?db=${this.database}&precision=${precision}`;

    try {
      console.log(`[InfluxClient] POST ${writeUrl} (${batchCount} points, ${lines.length} bytes, precision: ${precision})`);

      const response = await axios.post(writeUrl, lines, {
        headers: { 'Content-Type': 'text/plain' },
        auth: this.auth,
        timeout: 60000, // Increased to 60 seconds for proxy connections
        ...this.proxyConfig
      });

      const duration = Date.now() - startTime;
      console.log(`[InfluxClient] ✓ Successfully wrote ${batchCount} points in ${duration}ms (HTTP ${response.status})`);
      this.logger.info('InfluxDB flush successful', {
        configId: this.configId,
        configName: this.configName,
        pointCount: batchCount,
        durationMs: duration,
        httpStatus: response.status,
        bytesWritten: lines.length
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[InfluxClient] ✗ Write failed after ${duration}ms:`, error.message);

      if (error.response) {
        console.error(`[InfluxClient] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        this.logger.error('InfluxDB flush failed with HTTP error', {
          configId: this.configId,
          configName: this.configName,
          pointCount: batchCount,
          durationMs: duration,
          httpStatus: error.response.status,
          responseData: error.response.data,
          error: error.message
        });
      } else if (error.request) {
        console.error(`[InfluxClient] No response received (network/timeout error)`);
        console.error(`[InfluxClient] Request details:`, {
          url: writeUrl,
          timeout: 60000,
          hasProxy: !!this.proxyConfig.httpsAgent || !!this.proxyConfig.httpAgent
        });
        this.logger.error('InfluxDB flush failed - no response', {
          configId: this.configId,
          configName: this.configName,
          pointCount: batchCount,
          durationMs: duration,
          error: error.message,
          errorCode: error.code,
          url: writeUrl
        });
      } else {
        console.error(`[InfluxClient] Request setup error:`, error.message);
        this.logger.error('InfluxDB flush failed - request error', {
          configId: this.configId,
          configName: this.configName,
          pointCount: batchCount,
          error: error.message
        });
      }
      throw error;
    }
  }

  startBatchTimer() {
    // Clear any existing timer to prevent memory leaks
    if (this.timer) {
      console.log(`[InfluxClient] Clearing existing timer before starting new one`);
      clearInterval(this.timer);
    }

    console.log(`[InfluxClient] Starting batch timer (interval: ${this.batchInterval}ms)`);
    this.timer = setInterval(() => {
      if (this.batch.length > 0) {
        console.log(`[InfluxClient] Timer triggered flush (${this.batch.length} points pending)`);
      }
      this.flush().catch(err => {
        console.error(`[InfluxClient] Batch timer flush error:`, err.message);
        this.logger.error('InfluxDB batch timer flush failed', {
          configId: this.configId,
          error: err.message
        });
      });
    }, this.batchInterval);
  }

  stop() {
    console.log(`[InfluxClient] Stopping client for ${this.configName}`);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this.flush();
  }

  // Destructor-like cleanup method
  destroy() {
    console.log(`[InfluxClient] Destroying client for ${this.configName}`);
    this.stop();
  }
}

module.exports = { InfluxClient };
