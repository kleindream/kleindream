CREATE TABLE IF NOT EXISTS dream_music (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  artist VARCHAR(90) NOT NULL,
  song_name VARCHAR(110) NOT NULL,
  youtube_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_dream_music_user_position
  ON dream_music (user_id, position ASC);
