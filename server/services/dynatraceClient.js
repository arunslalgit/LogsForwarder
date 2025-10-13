const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class DynatraceClient {
  constructor(url, token, proxyConfig = {}) {
    const config = {
      baseURL: url,
      headers: {
        'Authorization': `Api-Token ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    // Add proxy support if configured
    if (proxyConfig.proxy_url) {
      const proxyUrl = new URL(proxyConfig.proxy_url);
      if (proxyConfig.proxy_username && proxyConfig.proxy_password) {
        proxyUrl.username = proxyConfig.proxy_username;
        proxyUrl.password = proxyConfig.proxy_password;
      }
      config.httpsAgent = new HttpsProxyAgent(proxyUrl.href);
      config.proxy = false; // Disable axios built-in proxy
    }

    this.client = axios.create(config);
  }

  async fetchLogs(query, from, to) {
    try {
      const response = await this.client.post('/api/v2/logs/search', {
        query: query || '',
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 1000
      });

      return (response.data.results || []).map(log => ({
        timestamp: log.timestamp,
        message: log.content || log.message || '',
        raw: log
      }));
    } catch (error) {
      throw new Error(`Dynatrace API Error: ${error.message}`);
    }
  }
}

module.exports = { DynatraceClient };
