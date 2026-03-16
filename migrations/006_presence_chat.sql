CREATE TABLE IF NOT EXISTS presence (
  user_id INTEGER PRIMARY KEY,
  last_active BIGINT
);

CREATE TABLE IF NOT EXISTS private_messages (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER,
  to_user_id INTEGER,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_messages_pair
ON private_messages (from_user_id, to_user_id);

CREATE INDEX IF NOT EXISTS idx_private_messages_created_at
ON private_messages (created_at);
