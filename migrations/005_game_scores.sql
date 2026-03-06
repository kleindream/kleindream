CREATE TABLE IF NOT EXISTS game_scores (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game, score DESC, played_at ASC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user_game ON game_scores(user_id, game, score DESC, played_at ASC);
