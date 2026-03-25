CREATE TABLE IF NOT EXISTS duel_votes (
  id SERIAL PRIMARY KEY,
  voter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  winner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  loser_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS voter_id INTEGER;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS winner_id INTEGER;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS loser_id INTEGER;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_duel_votes_category_created_at ON duel_votes(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_votes_winner_category ON duel_votes(winner_id, category);
