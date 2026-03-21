CREATE TABLE IF NOT EXISTS radio_comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  station_key TEXT NOT NULL DEFAULT 'disco',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radio_comments_created_at ON radio_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_comments_station_created ON radio_comments(station_key, created_at DESC);
