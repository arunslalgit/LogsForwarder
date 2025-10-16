const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

class InfluxClient {
  constructor(config) {
    this.url = config.url;
    this.database = config.database;
    this.measurement = config.measurement_name;
    this.timestampFormat = config.timestamp_format || 'nanoseconds'; // Store timestamp format
    this.auth = config.username ? {
      username: config.username,
      password: config.password
    } : null;

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
      console.log(`InfluxDB client configured with proxy: ${proxyUrl.href}`);
    } else {
      console.log(`InfluxDB client configured WITHOUT proxy (direct connection)`);
    }

    this.batch = [];
    this.batchSize = config.batch_size || 100;
    this.batchInterval = (config.batch_interval_seconds || 10) * 1000;

    this.startBatchTimer();
  }

  add(point) {
    this.batch.push(point);

    if (this.batch.length >= this.batchSize) {
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
    return String(value).replace(/"/g, '\\"');
  }

  async flush() {
    if (this.batch.length === 0) return;

    const lines = this.batch.map(p => this.toLineProtocol(p)).join('\n');
    const batchCount = this.batch.length;
    this.batch = [];

    try {
      // Map timestamp format to InfluxDB precision parameter
      let precision = 'ns'; // default nanoseconds
      if (this.timestampFormat === 'milliseconds') {
        precision = 'ms';
      } else if (this.timestampFormat === 'seconds') {
        precision = 's';
      }

      const writeUrl = `${this.url}/write?db=${this.database}&precision=${precision}`;

      console.log(`Writing to InfluxDB: ${writeUrl} (${batchCount} points, precision: ${precision})`);

      await axios.post(writeUrl, lines, {
        headers: { 'Content-Type': 'text/plain' },
        auth: this.auth,
        timeout: 60000, // Increased to 60 seconds for proxy connections
        ...this.proxyConfig
      });

      console.log(`✓ Flushed ${batchCount} points to InfluxDB (precision: ${precision})`);
    } catch (error) {
      console.error('InfluxDB write error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  startBatchTimer() {
    this.timer = setInterval(() => {
      this.flush().catch(err => console.error('Batch flush error:', err));
    }, this.batchInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    return this.flush();
  }
}

module.exports = { InfluxClient };
