const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function createDatabase(filename) {
  fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (id TEXT PRIMARY KEY, keyword TEXT NOT NULL, normalized_keyword TEXT NOT NULL, dm_message TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incoming_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('received', 'processed')), received_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS incoming_events_pending ON incoming_events(status, received_at);
    CREATE TABLE IF NOT EXISTS deleted_comments (comment_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS dm_jobs (
      id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES rules(id), recipient_user_id TEXT NOT NULL, comment_id TEXT NOT NULL, message TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('pending', 'waiting_delivery', 'delivered', 'failed', 'cancelled')), attempt_count INTEGER NOT NULL DEFAULT 0, next_action_at INTEGER NOT NULL,
      remote_dm_id TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(rule_id, recipient_user_id)
    );
    CREATE INDEX IF NOT EXISTS dm_jobs_due ON dm_jobs(status, next_action_at);
    CREATE TABLE IF NOT EXISTS send_attempts (requested_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS send_attempts_time ON send_attempts(requested_at);
    CREATE TABLE IF NOT EXISTS metrics (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO metrics(name, value) VALUES ('duplicates_blocked', 0);
  `);
  return db;
}
module.exports = { createDatabase };
