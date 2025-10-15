// Pre-load modules for pkg compatibility
require('./pkg-preload');

const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./db/init');
const { startScheduler } = require('./services/scheduler');
const routes = require('./routes');

const app = express();
const BASE_PATH = process.env.BASE_PATH || '';
const PORT = process.env.PORT || 3003;

// Determine the root directory (works for both dev and packaged)
// When packaged with pkg, process.pkg exists and process.execPath points to the executable
const IS_PKG = typeof process.pkg !== 'undefined';
const ROOT_DIR = IS_PKG ? path.dirname(process.execPath) : path.join(__dirname, '..');

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
  // Create logs directory next to executable (or in project root for dev)
  const logsDir = path.join(ROOT_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('✓ Logs folder created at:', logsDir);
  }

  // Initialize file logger with rotation (5MB max, 5 files)
  const { initLogger } = require('./utils/logger');
  const logger = initLogger(logsDir, {
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    maxFiles: 5,
    logFileName: 'application.log'
  });

  logger.info('Application starting...', {
    port: PORT,
    basePath: BASE_PATH,
    nodeVersion: process.version,
    platform: process.platform
  });

  // Initialize database (will be created next to executable)
  await initDatabase(ROOT_DIR);
  logger.info('Database initialized', { path: path.join(ROOT_DIR, 'data.db') });

  console.log('✓ Application bootstrapped');
}

app.use(`${BASE_PATH}/api`, routes);

// Serve frontend (from embedded assets when packaged, or from dist in dev)
// In pkg, assets are in /snapshot/o11yControlCenter/client/dist
const clientPath = IS_PKG
  ? path.join(__dirname, '../client/dist')  // In snapshot, paths are relative to __dirname
  : path.join(__dirname, '../client/dist');

// Cache the modified HTML for better performance
let cachedHtml = null;
function getModifiedHtml() {
  if (!cachedHtml) {
    const indexPath = path.join(clientPath, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    // Replace asset paths to include BASE_PATH
    if (BASE_PATH) {
      html = html
        .replace(/src="\/assets\//g, `src="${BASE_PATH}/assets/`)
        .replace(/href="\/assets\//g, `href="${BASE_PATH}/assets/`);
    }

    cachedHtml = html;
  }
  return cachedHtml;
}

// Serve static assets with BASE_PATH (exclude index.html)
app.use(BASE_PATH || '/', express.static(clientPath, { index: false }));

// SPA fallback - serve modified index.html for all non-API, non-asset routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.includes('.')) {
    res.send(getModifiedHtml());
  } else {
    next();
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

bootstrap().then(() => {
  const { getLogger } = require('./utils/logger');
  const logger = getLogger();

  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}${BASE_PATH}`;
    console.log(`✓ Server running at ${url}`);
    logger.info(`Server started and listening on port ${PORT}`, { url, basePath: BASE_PATH });

    startScheduler();
    logger.info('Job scheduler started');
    console.log('✓ Scheduler started');
  });
}).catch(err => {
  const { getLogger } = require('./utils/logger');
  try {
    const logger = getLogger();
    logger.error('Failed to start application', { error: err.message, stack: err.stack });
  } catch (e) {
    // Logger might not be initialized
    console.error('Failed to start:', err);
  }
  process.exit(1);
});
