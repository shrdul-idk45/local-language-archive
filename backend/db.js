// db.js (Promise-based SQLite wrapper)
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function initDB() {
  const db = await open({
    filename: path.join(__dirname, 'data.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      language TEXT,
      word TEXT,
      meaning TEXT,
      example TEXT,
      tags TEXT,
      category TEXT,
      audio_filename TEXT,
      votes INTEGER DEFAULT 0,
      avg_rating REAL DEFAULT 0,
      share_token TEXT,
      region_name TEXT,
      region_lat REAL,
      region_lng REAL,
      sample_sentences TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER,
      user_id INTEGER,
      rating INTEGER
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      entry_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS recent_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      entry_id INTEGER,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER,
      user_id INTEGER,
      text TEXT,
      upvotes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

module.exports = initDB;
