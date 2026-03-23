CREATE TABLE IF NOT EXISTS user_ratings (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beauty INTEGER NOT NULL CHECK (beauty BETWEEN 1 AND 5),
  friendly INTEGER NOT NULL CHECK (friendly BETWEEN 1 AND 5),
  happy INTEGER NOT NULL CHECK (happy BETWEEN 1 AND 5),
  smart INTEGER NOT NULL CHECK (smart BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ratings_to_user ON user_ratings(to_user_id);
