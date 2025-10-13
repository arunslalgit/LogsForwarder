const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class InfluxClient {
  constructor(config) {
    this.url = config.url;
    this.database = config.database;
    this.measurement = config.measurement_name;
    this.auth = config.username ? {
      username: config.username,
      password: config.password
    } : null;

    // Store proxy configuration
    this.proxyConfig = {};
    if (config.proxy_url) {
      const proxyUrl = new URL(config.proxy_url);
      if (config.proxy_username && config.proxy_password) {
        proxyUrl.username = config.proxy_username;
        proxyUrl.password = config.proxy_password;
      }
      this.proxyConfig.httpsAgent = new HttpsProxyAgent(proxyUrl.href);
      this.proxyConfig.proxy = false;
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
    const timestamp = Math.floor(point.timestamp.getTime() * 1000000);

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
      const writeUrl = `${this.url}/write?db=${this.database}&precision=ns`;

      await axios.post(writeUrl, lines, {
        headers: { 'Content-Type': 'text/plain' },
        auth: this.auth,
        timeout: 10000,
        ...this.proxyConfig
      });

      console.log(`✓ Flushed ${batchCount} points to InfluxDB`);
    } catch (error) {
      console.error('InfluxDB write error:', error.message);
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
