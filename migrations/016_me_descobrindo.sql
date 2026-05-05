-- Me descobrindo: resultado do teste de personalidade leve exibido no perfil
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_result TEXT;
