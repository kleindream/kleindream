CREATE TABLE IF NOT EXISTS presence (
  user_id INTEGER PRIMARY KEY,
  last_active BIGINT
);

CREATE TABLE IF NOT EXISTS private_messages (
  id SERIAL PRIMARY KEY,
  from_user INTEGER,
  to_user INTEGER,
  message TEXT,
  created_at BIGINT
);
