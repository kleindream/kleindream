CREATE TABLE IF NOT EXISTS duel_votes (
  id SERIAL PRIMARY KEY,
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duel_votes_category_created_at ON duel_votes(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_votes_winner_category ON duel_votes(winner_id, category);
