
CREATE TABLE IF NOT EXISTS presence (
  user_id INTEGER PRIMARY KEY,
  last_active INTEGER
);

CREATE TABLE IF NOT EXISTS private_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user INTEGER,
  to_user INTEGER,
  message TEXT,
  created_at INTEGER
);
