import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// Dynamically detect basename from URL path
// If app is at /forwarder/, basename should be /forwarder
// If app is at /, basename should be /
function getBasename() {
  const pathname = window.location.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const knownRoutes = ['log-sources', 'influx-configs', 'jobs', 'regex-patterns', 'tag-mappings', 'sqlite-explorer', 'dashboard', 'influx-explorer', 'activity-logs'];

  if (segments.length > 0 && !knownRoutes.includes(segments[0])) {
    return `/${segments[0]}`;
  }
  return '/';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" />
      <BrowserRouter basename={getBasename()}>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
