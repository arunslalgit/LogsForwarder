const Database = require('better-sqlite3');
const path = require('path');
const { SCHEMA } = require('./schema');

let db = null;

function initDatabase() {
  const dbPath = path.join(__dirname, '../../data.db');

  db = new Database(dbPath, { verbose: console.log });
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  // Run migrations
  runMigrations(db);

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

function runMigrations(db) {
  // Migration: Add details column to activity_logs if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(activity_logs)").all();
    const hasDetailsColumn = tableInfo.some(col => col.name === 'details');

    if (!hasDetailsColumn) {
      console.log('Running migration: Adding details column to activity_logs');
      db.prepare('ALTER TABLE activity_logs ADD COLUMN details TEXT').run();
      console.log('✓ Migration completed');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
