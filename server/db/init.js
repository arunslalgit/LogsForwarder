const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { SCHEMA } = require('./schema');

let db = null;

function initDatabase(rootDir) {
  // If rootDir is provided, use it; otherwise default to dev location
  const dbPath = rootDir
    ? path.join(rootDir, 'data.db')
    : path.join(__dirname, '../../data.db');

  console.log('Database path:', dbPath);

  // Create database (will be created if it doesn't exist)
  db = new Database(dbPath, { verbose: process.env.DEBUG ? console.log : null });
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
    console.log('✓ Database initialized (first run)');
  } else {
    console.log('✓ Database connected (existing)');
  }

  // Ensure default admin user exists
  ensureAdminUser(db);

  console.log('✓ Database ready at', dbPath);
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

function ensureAdminUser(db) {
  try {
    const adminCheck = db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE username = ?').get('admin');

    if (adminCheck.count === 0) {
      // Create default admin user with password GPRIDE2255
      const passwordHash = bcrypt.hashSync('GPRIDE2255', 10);
      db.prepare(`
        INSERT INTO admin_users (username, password_hash)
        VALUES (?, ?)
      `).run('admin', passwordHash);
      console.log('✓ Default admin user created (username: admin, password: GPRIDE2255)');
    }
  } catch (error) {
    console.error('Error ensuring admin user:', error.message);
  }
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
