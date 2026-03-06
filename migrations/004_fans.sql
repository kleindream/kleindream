CREATE TABLE IF NOT EXISTS fans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, fan_user_id)
);

CREATE INDEX IF NOT EXISTS idx_fans_user_created ON fans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fans_fan_user ON fans(fan_user_id, created_at DESC);
