-- Nosso Tempo + Lembra quando...
ALTER TABLE users ADD COLUMN IF NOT EXISTS time_of TEXT;

CREATE TABLE IF NOT EXISTS nosso_tempo_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'remember', -- remember | belonging | other
  prompt_text TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nosso_tempo_posts_created_at ON nosso_tempo_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nosso_tempo_posts_prompt ON nosso_tempo_posts(kind, prompt_text);
