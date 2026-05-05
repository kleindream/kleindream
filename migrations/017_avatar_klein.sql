-- Avatar Klein 2D salvo como configuração JSON leve
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT '{}'::jsonb;
