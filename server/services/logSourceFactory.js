const { DynatraceClient } = require('./dynatraceClient');
const { SplunkClient } = require('./splunkClient');

class LogSourceFactory {
  static createClient(logSource) {
    const proxyConfig = {
      proxy_url: logSource.proxy_url,
      proxy_username: logSource.proxy_username,
      proxy_password: logSource.proxy_password
    };

    switch (logSource.source_type) {
      case 'dynatrace':
        if (!logSource.dynatrace_url || !logSource.dynatrace_token) {
          throw new Error('Dynatrace URL and token required');
        }
        return new DynatraceClient(
          logSource.dynatrace_url,
          logSource.dynatrace_token,
          proxyConfig
        );

      case 'splunk':
        if (!logSource.splunk_url || !logSource.splunk_token) {
          throw new Error('Splunk URL and token required');
        }
        return new SplunkClient(
          logSource.splunk_url,
          logSource.splunk_token,
          proxyConfig
        );

      default:
        throw new Error(`Unsupported source type: ${logSource.source_type}`);
    }
  }

  static getQueryFilter(logSource) {
    switch (logSource.source_type) {
      case 'dynatrace':
        return logSource.dynatrace_query_filter || '';

      case 'splunk':
        return {
          searchQuery: logSource.splunk_search_query || '',
          index: logSource.splunk_index || null
        };

      default:
        return null;
    }
  }
}

module.exports = { LogSourceFactory };
