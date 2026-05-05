-- Avatar Klein: configuração 2D leve em JSON/TEXT para montar o avatar no perfil
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config TEXT;
