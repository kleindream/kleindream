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
