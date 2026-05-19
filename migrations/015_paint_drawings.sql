CREATE TABLE IF NOT EXISTS paint_drawings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Desenho sem título',
  image_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paint_drawings_user_id_created_at
ON paint_drawings(user_id, created_at DESC);
