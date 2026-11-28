PRAGMA foreign_keys = ON;

-- Preserve all existing articles and scheduled jobs; ownership is nullable for legacy rows.
ALTER TABLE articles ADD COLUMN owner_user_id TEXT;
ALTER TABLE publish_queue ADD COLUMN owner_user_id TEXT;
-- If the installation has exactly one account, safely attach legacy records to it.
-- Multi-account installations are left untouched because historical ownership cannot be inferred.
UPDATE articles SET owner_user_id=(SELECT id FROM users ORDER BY created_at LIMIT 1) WHERE owner_user_id IS NULL AND (SELECT COUNT(*) FROM users)=1;
UPDATE publish_queue SET owner_user_id=(SELECT id FROM users ORDER BY created_at LIMIT 1) WHERE owner_user_id IS NULL AND (SELECT COUNT(*) FROM users)=1;
CREATE INDEX IF NOT EXISTS idx_articles_owner_date ON articles(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_owner_date ON publish_queue(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  location TEXT NOT NULL DEFAULT 'Seoul',
  zodiac_sign TEXT NOT NULL DEFAULT '',
  chinese_zodiac_sign TEXT NOT NULL DEFAULT '',
  mbti_type TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_contents (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('fortune','diet','exercise','music','history','quiz','shopping','recommendation','weather')),
  content_date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(owner_key, content_type, content_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_contents_owner_date
  ON daily_contents(owner_key, content_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_contents_type_date
  ON daily_contents(content_type, content_date DESC);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  user_answer TEXT NOT NULL CHECK(user_answer IN ('O','X')),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
  attempted_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(content_id) REFERENCES daily_contents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_date
  ON quiz_attempts(user_id, attempted_at DESC);

-- Prevent duplicate Gemini requests from multiple tabs or rapid parallel requests.
CREATE TABLE IF NOT EXISTS daily_generation_locks (
  lock_key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
