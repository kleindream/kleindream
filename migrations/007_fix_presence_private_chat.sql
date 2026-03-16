-- Repair/upgrade legacy presence + private chat tables to the PostgreSQL schema
-- expected by server.js. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS presence (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_messages (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'from_user'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'from_user_id'
  ) THEN
    EXECUTE 'ALTER TABLE private_messages RENAME COLUMN from_user TO from_user_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'to_user'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'to_user_id'
  ) THEN
    EXECUTE 'ALTER TABLE private_messages RENAME COLUMN to_user TO to_user_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'message'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'body'
  ) THEN
    EXECUTE 'ALTER TABLE private_messages RENAME COLUMN message TO body';
  END IF;
END $$;

ALTER TABLE presence
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presence' AND column_name = 'last_active'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    EXECUTE 'ALTER TABLE presence ALTER COLUMN last_active TYPE TIMESTAMPTZ USING to_timestamp(last_active::double precision / 1000.0)';
  END IF;
END $$;

ALTER TABLE presence
  ALTER COLUMN last_active SET DEFAULT NOW();

UPDATE presence
SET last_active = NOW()
WHERE last_active IS NULL;

ALTER TABLE presence
  ALTER COLUMN last_active SET NOT NULL;

ALTER TABLE private_messages
  ADD COLUMN IF NOT EXISTS from_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS to_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS is_read INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'private_messages' AND column_name = 'created_at'
      AND data_type IN ('bigint', 'integer', 'smallint')
  ) THEN
    EXECUTE 'ALTER TABLE private_messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING to_timestamp(created_at::double precision / 1000.0)';
  END IF;
END $$;

UPDATE private_messages
SET body = ''
WHERE body IS NULL;

UPDATE private_messages
SET created_at = NOW()
WHERE created_at IS NULL;

ALTER TABLE private_messages
  ALTER COLUMN from_user_id SET NOT NULL,
  ALTER COLUMN to_user_id SET NOT NULL,
  ALTER COLUMN body SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_presence_last_active ON presence(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_pair_created ON private_messages(from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_to_read ON private_messages(to_user_id, is_read, created_at DESC);
