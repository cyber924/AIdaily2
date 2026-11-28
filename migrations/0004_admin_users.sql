PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
