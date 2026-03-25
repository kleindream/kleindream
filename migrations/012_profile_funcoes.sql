
CREATE TABLE IF NOT EXISTS profile_ratings (
  id SERIAL PRIMARY KEY,
  rated_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rater_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rated_user_id, rater_user_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_ratings_user ON profile_ratings(rated_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_gifts (
  id SERIAL PRIMARY KEY,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_key TEXT NOT NULL,
  gift_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_gifts_to ON profile_gifts(to_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_polls (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_polls_user ON profile_polls(user_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES profile_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES profile_polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES profile_poll_options(id) ON DELETE CASCADE,
  voter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, voter_user_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_poll_votes_poll ON profile_poll_votes(poll_id, created_at DESC);
