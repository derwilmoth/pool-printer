import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "pool-printer.db");

let db: Database.Database | null = null;

function cleanupExpiredDeletionRequests(database: Database.Database) {
  database.exec(`
    DELETE FROM transactions
    WHERE userId IN (
      SELECT userId
      FROM users
      WHERE account_state = 'deletion_requested'
        AND deletion_expires_at IS NOT NULL
        AND deletion_expires_at <= datetime('now', 'localtime')
    );

    DELETE FROM users
    WHERE account_state = 'deletion_requested'
      AND deletion_expires_at IS NOT NULL
      AND deletion_expires_at <= datetime('now', 'localtime');
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("case_sensitive_like = ON");
  }
  cleanupExpiredDeletionRequests(db);
  return db;
}

export default getDb;
