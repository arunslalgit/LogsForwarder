const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

class SplunkClient {
  constructor(url, token, proxyConfig = {}) {
    this.baseURL = url;
    this.token = token;

    const config = {
      baseURL: url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 60000
    };

    // Add proxy support if configured
    if (proxyConfig.proxy_url) {
      const proxyUrl = new URL(proxyConfig.proxy_url);
      if (proxyConfig.proxy_username && proxyConfig.proxy_password) {
        proxyUrl.username = proxyConfig.proxy_username;
        proxyUrl.password = proxyConfig.proxy_password;
      }
      config.httpsAgent = new HttpsProxyAgent(proxyUrl.href, {
        rejectUnauthorized: false
      });
      config.proxy = false;
    } else {
      config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    this.client = axios.create(config);
  }

  async fetchLogs(searchQuery, earliestTime, latestTime, index = null) {
    try {
      let search = index ? `search index=${index} ${searchQuery}` : `search ${searchQuery}`;

      const params = new URLSearchParams({
        search: search,
        earliest_time: this.formatTime(earliestTime),
        latest_time: this.formatTime(latestTime),
        output_mode: 'json',
        max_count: 1000
      });

      const response = await this.client.post('/services/search/jobs/export', params.toString());

      const results = response.data
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(r => r !== null);

      return results.map(r => ({
        timestamp: r.result._time || r.result.timestamp,
        message: r.result._raw || JSON.stringify(r.result),
        raw: r.result
      }));

    } catch (error) {
      throw new Error(`Splunk API Error: ${error.message}`);
    }
  }

  formatTime(date) {
    if (date instanceof Date) {
      return Math.floor(date.getTime() / 1000);
    }
    return date;
  }

  async testConnection() {
    try {
      const response = await this.client.get('/services/authentication/current-context');
      return { success: true, user: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { SplunkClient };
