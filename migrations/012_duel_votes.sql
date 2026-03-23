CREATE TABLE IF NOT EXISTS duel_votes (
  id SERIAL PRIMARY KEY,
  voter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loser_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (winner_user_id <> loser_user_id),
  CHECK (category IN ('friendly','stylish','smart','beautiful','funny','kind'))
);

CREATE INDEX IF NOT EXISTS idx_duel_votes_category_created ON duel_votes(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_votes_winner_category ON duel_votes(winner_user_id, category);
CREATE INDEX IF NOT EXISTS idx_duel_votes_voter_created ON duel_votes(voter_user_id, created_at DESC);
