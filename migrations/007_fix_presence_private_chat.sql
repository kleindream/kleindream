-- Follow-up fixer for presence/private chat schemas
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
  -- Fix old/private_messages schemas from earlier patches
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'private_messages'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='from_user'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='from_user_id'
    ) THEN
      ALTER TABLE private_messages RENAME COLUMN from_user TO from_user_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='to_user'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='to_user_id'
    ) THEN
      ALTER TABLE private_messages RENAME COLUMN to_user TO to_user_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='message'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='body'
    ) THEN
      ALTER TABLE private_messages RENAME COLUMN message TO body;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='is_read'
    ) THEN
      ALTER TABLE private_messages ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages' AND column_name='body'
        AND is_nullable = 'YES'
    ) THEN
      UPDATE private_messages SET body = '' WHERE body IS NULL;
      ALTER TABLE private_messages ALTER COLUMN body SET NOT NULL;
    END IF;

    -- created_at: convert integer/bigint/text epochs to timestamptz when needed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages'
        AND column_name='created_at'
        AND data_type IN ('integer','bigint','smallint')
    ) THEN
      ALTER TABLE private_messages
        ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING CASE
          WHEN created_at IS NULL THEN NOW()
          WHEN created_at > 1000000000000 THEN to_timestamp(created_at / 1000.0)
          ELSE to_timestamp(created_at::double precision)
        END;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='private_messages'
        AND column_name='created_at'
        AND data_type = 'text'
    ) THEN
      ALTER TABLE private_messages
        ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING COALESCE(NULLIF(created_at, '')::timestamptz, NOW());
    END IF;

    UPDATE private_messages SET created_at = NOW() WHERE created_at IS NULL;
    ALTER TABLE private_messages ALTER COLUMN created_at SET DEFAULT NOW();
    ALTER TABLE private_messages ALTER COLUMN created_at SET NOT NULL;

    -- Add foreign keys only if they do not exist yet
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'private_messages_from_user_id_fkey'
    ) THEN
      ALTER TABLE private_messages
        ADD CONSTRAINT private_messages_from_user_id_fkey
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'private_messages_to_user_id_fkey'
    ) THEN
      ALTER TABLE private_messages
        ADD CONSTRAINT private_messages_to_user_id_fkey
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Fix old presence.last_active schemas
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='presence'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='presence'
        AND column_name='last_active'
        AND data_type IN ('integer','bigint','smallint')
    ) THEN
      ALTER TABLE presence
        ALTER COLUMN last_active TYPE TIMESTAMPTZ
        USING CASE
          WHEN last_active IS NULL THEN NOW()
          WHEN last_active > 1000000000000 THEN to_timestamp(last_active / 1000.0)
          ELSE to_timestamp(last_active::double precision)
        END;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='presence'
        AND column_name='last_active'
        AND data_type = 'text'
    ) THEN
      ALTER TABLE presence
        ALTER COLUMN last_active TYPE TIMESTAMPTZ
        USING COALESCE(NULLIF(last_active, '')::timestamptz, NOW());
    END IF;

    UPDATE presence SET last_active = NOW() WHERE last_active IS NULL;
    ALTER TABLE presence ALTER COLUMN last_active SET DEFAULT NOW();
    ALTER TABLE presence ALTER COLUMN last_active SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_presence_last_active ON presence(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_pair_created ON private_messages(from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_to_read ON private_messages(to_user_id, is_read, created_at DESC);
