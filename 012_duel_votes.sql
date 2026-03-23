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
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS voter_user_id INTEGER;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS winner_user_id INTEGER;
ALTER TABLE duel_votes ADD COLUMN IF NOT EXISTS loser_user_id INTEGER;

UPDATE duel_votes SET voter_id = COALESCE(voter_id, voter_user_id);
UPDATE duel_votes SET winner_id = COALESCE(winner_id, winner_user_id);
UPDATE duel_votes SET loser_id = COALESCE(loser_id, loser_user_id);
UPDATE duel_votes SET voter_user_id = COALESCE(voter_user_id, voter_id);
UPDATE duel_votes SET winner_user_id = COALESCE(winner_user_id, winner_id);
UPDATE duel_votes SET loser_user_id = COALESCE(loser_user_id, loser_id);

CREATE INDEX IF NOT EXISTS idx_duel_votes_category_created ON duel_votes(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_votes_winner_category_compat ON duel_votes(winner_id, category);
CREATE INDEX IF NOT EXISTS idx_duel_votes_voter_created_compat ON duel_votes(voter_id, created_at DESC);
