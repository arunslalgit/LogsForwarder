const Database = require('better-sqlite3');
const path = require('path');
const { SCHEMA } = require('./schema');

let db = null;

function initDatabase() {
  const dbPath = path.join(__dirname, '../../data.db');

  db = new Database(dbPath, { verbose: console.log });
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const settingsCheck = db.prepare('SELECT COUNT(*) as count FROM app_settings').get();
  if (settingsCheck.count === 0) {
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES
      ('version', '3.0'),
      ('initialized_at', datetime('now'))
    `).run();
  }

  console.log('✓ Database initialized at', dbPath);
  return db;
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
