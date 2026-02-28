/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "data", "pool-printer.db");

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Initializing database...");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS supervisors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    is_free_account INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    pages INTEGER NOT NULL DEFAULT 1,
    type TEXT NOT NULL CHECK(type IN ('deposit', 'print_sw', 'print_color')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
    paymentMethod TEXT DEFAULT NULL,
    timestamp DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (userId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

console.log("Tables created.");

// Seed root supervisor (only if not exists)
const existingRoot = db
  .prepare("SELECT id FROM supervisors WHERE username = ?")
  .get("root");
if (!existingRoot) {
  const hash = bcrypt.hashSync("root", 10);
  db.prepare(
    "INSERT INTO supervisors (username, password_hash) VALUES (?, ?)",
  ).run("root", hash);
  console.log("Root supervisor created (username: root, password: root).");
} else {
  console.log("Root supervisor already exists.");
}

// Seed default settings
const upsertSetting = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
);
upsertSetting.run("price_sw", "5");
upsertSetting.run("price_color", "20");
console.log("Default settings ensured (price_sw: 5, price_color: 20).");

db.close();
console.log("Database initialized successfully!");
