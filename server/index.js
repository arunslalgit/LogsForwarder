const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./db/init');
const { startScheduler } = require('./services/scheduler');
const routes = require('./routes');

const app = express();
const BASE_PATH = process.env.BASE_PATH || '';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

async function bootstrap() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('✓ Logs folder created');
  }

  await initDatabase();
  console.log('✓ Application bootstrapped');
}

app.use(`${BASE_PATH}/api`, routes);

const clientPath = path.join(__dirname, '../client/dist');
app.use(BASE_PATH || '/', express.static(clientPath));

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.includes('.')) {
    res.sendFile(path.join(clientPath, 'index.html'));
  } else {
    next();
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

bootstrap().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}${BASE_PATH}`);
    startScheduler();
    console.log('✓ Scheduler started');
  });
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
