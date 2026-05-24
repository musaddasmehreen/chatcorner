CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  salt TEXT,
  is_guest INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  is_banned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id),
  username TEXT UNIQUE NOT NULL,
  avatar_color TEXT DEFAULT '#7c3aed',
  is_registered INTEGER DEFAULT 1,
  last_active TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_audio_enabled INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT,
  username TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS private_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'text',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banned_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  banned_by TEXT,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO rooms (id, name, is_audio_enabled) VALUES
  ('room-general', 'general', 0),
  ('room-random', 'random', 0),
  ('room-voice1', 'voice-lounge', 1);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('allow_guest', 'true'),
  ('allow_register', 'true'),
  ('maintenance', 'false'),
  ('max_message_length', '500'),
  ('welcome_message', 'Welcome to ChatCorner!');
