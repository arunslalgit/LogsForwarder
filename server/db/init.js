const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { SCHEMA } = require('./schema');

let db = null;

function initDatabase(rootDir) {
  const dbPath = rootDir
    ? path.join(rootDir, 'data.db')
    : path.join(__dirname, '../../data.db');

  console.log('Database path:', dbPath);

  db = new Database(dbPath, { verbose: process.env.DEBUG ? console.log : null });
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

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

  ensureAdminUser(db);

  console.log('✓ Database ready at', dbPath);
  return db;
}

function runMigrations(db) {
  // Migration: Add details column to activity_logs
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

  // Migration: Add static tag/field and regex transformation columns
  try {
    const tagMappingsInfo = db.prepare("PRAGMA table_info(tag_mappings)").all();
    const hasIsStatic = tagMappingsInfo.some(col => col.name === 'is_static');
    const hasStaticValue = tagMappingsInfo.some(col => col.name === 'static_value');
    const hasTransformRegex = tagMappingsInfo.some(col => col.name === 'transform_regex');

    if (!hasIsStatic) {
      console.log('Running migration: Adding is_static column to tag_mappings');
      db.prepare('ALTER TABLE tag_mappings ADD COLUMN is_static INTEGER DEFAULT 0').run();
    }
    if (!hasStaticValue) {
      console.log('Running migration: Adding static_value column to tag_mappings');
      db.prepare('ALTER TABLE tag_mappings ADD COLUMN static_value TEXT').run();
    }
    if (!hasTransformRegex) {
      console.log('Running migration: Adding transform_regex column to tag_mappings');
      db.prepare('ALTER TABLE tag_mappings ADD COLUMN transform_regex TEXT').run();
    }

    if (!hasIsStatic || !hasStaticValue || !hasTransformRegex) {
      console.log('✓ Tag mappings migration completed');
    }
  } catch (error) {
    console.error('Tag mappings migration error:', error.message);
  }

  // Migration: Add timestamp_format column to log_sources
  try {
    const logSourcesInfo = db.prepare("PRAGMA table_info(log_sources)").all();
    const hasTimestampFormat = logSourcesInfo.some(col => col.name === 'timestamp_format');

    if (!hasTimestampFormat) {
      console.log('Running migration: Adding timestamp_format column to log_sources');
      db.prepare("ALTER TABLE log_sources ADD COLUMN timestamp_format TEXT DEFAULT 'nanoseconds'").run();
      console.log('✓ Timestamp format migration completed');
    }
  } catch (error) {
    console.error('Timestamp format migration error:', error.message);
  }
}

function ensureAdminUser(db) {
  try {
    const adminCheck = db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE username = ?').get('admin');

    if (adminCheck.count === 0) {
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
