const express = require('express');
const router = express.Router();
const db = require('../db/queries');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

router.get('/', (req, res) => {
  try {
    const configs = db.getAllInfluxConfigs();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const config = db.getInfluxConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const id = db.createInfluxConfig(req.body);
    res.status(201).json({ id, message: 'InfluxDB config created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    db.updateInfluxConfig(req.params.id, req.body);
    res.json({ message: 'InfluxDB config updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.deleteInfluxConfig(req.params.id);
    res.json({ message: 'InfluxDB config deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test InfluxDB connection
router.post('/test-connection', async (req, res) => {
  try {
    const { url, database, username, password, proxy_url, proxy_username, proxy_password } = req.body;

    if (!url || !database) {
      return res.status(400).json({
        success: false,
        error: 'URL and database are required'
      });
    }

    // Build proxy configuration if provided
    const axiosConfig = { timeout: 10000 };
    if (proxy_url) {
      try {
        const proxyUrl = new URL(proxy_url);
        if (proxy_username && proxy_password) {
          proxyUrl.username = proxy_username;
          proxyUrl.password = proxy_password;
        }
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl.href);
        axiosConfig.proxy = false;
      } catch (proxyError) {
        return res.json({
          success: false,
          error: 'Invalid proxy URL: ' + proxyError.message
        });
      }
    }

    // Add authentication if provided
    if (username) {
      axiosConfig.auth = { username, password: password || '' };
    }

    // Test connection by pinging InfluxDB
    const pingUrl = `${url}/ping`;
    try {
      const pingResponse = await axios.get(pingUrl, axiosConfig);

      // Check if database exists by querying it
      const queryUrl = `${url}/query?db=${database}&q=SHOW+DATABASES`;
      const queryResponse = await axios.get(queryUrl, axiosConfig);

      // Check if the specified database exists in the response
      const databases = queryResponse.data?.results?.[0]?.series?.[0]?.values?.flat() || [];
      const dbExists = databases.includes(database);

      if (!dbExists) {
        return res.json({
          success: false,
          warning: true,
          message: `Connected to InfluxDB, but database "${database}" does not exist. You may need to create it first.`,
          influxVersion: pingResponse.headers['x-influxdb-version'] || 'Unknown'
        });
      }

      res.json({
        success: true,
        message: 'Successfully connected to InfluxDB',
        influxVersion: pingResponse.headers['x-influxdb-version'] || 'Unknown',
        databaseExists: true
      });

    } catch (testError) {
      if (testError.code === 'ECONNREFUSED') {
        return res.json({
          success: false,
          error: 'Connection refused. Check if InfluxDB is running at the specified URL.'
        });
      } else if (testError.code === 'ETIMEDOUT' || testError.code === 'ENOTFOUND') {
        return res.json({
          success: false,
          error: 'Connection timeout. Check the URL and network connectivity.'
        });
      } else if (testError.response?.status === 401) {
        return res.json({
          success: false,
          error: 'Authentication failed. Check username and password.'
        });
      } else {
        return res.json({
          success: false,
          error: testError.message || 'Failed to connect to InfluxDB'
        });
      }
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
