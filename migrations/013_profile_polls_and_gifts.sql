CREATE TABLE IF NOT EXISTS profile_polls (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES profile_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES profile_polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES profile_poll_options(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_polls_user_active ON profile_polls(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_poll_options_poll ON profile_poll_options(poll_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_profile_poll_votes_poll ON profile_poll_votes(poll_id);

CREATE TABLE IF NOT EXISTS profile_gifts (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_key TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_gifts_to_user ON profile_gifts(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_gifts_from_user ON profile_gifts(from_user_id, created_at DESC);
