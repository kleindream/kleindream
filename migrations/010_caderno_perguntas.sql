CREATE TABLE IF NOT EXISTS caderno_questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Geral',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caderno_answers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES caderno_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_caderno_questions_active ON caderno_questions(is_active, category, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_caderno_answers_created ON caderno_answers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_caderno_answers_user ON caderno_answers(user_id, created_at DESC);

INSERT INTO caderno_questions (question_text, category, sort_order)
VALUES
('Qual é o seu nome?', 'Sobre você', 1),
('Qual é a sua data de nascimento?', 'Sobre você', 2),
('Qual é o seu estado civil?', 'Sobre você', 3),
('O que você faz da vida?', 'Sobre você', 4),
('Qual é a sua maior qualidade e seu maior defeito?', 'Sobre você', 5),
('Em que cidade e estado você mora?', 'Sobre você', 6),
('Para você, todo ser humano é corruptível?', 'Reflexão', 7),
('Você acredita em destino? Por quê?', 'Reflexão', 8),
('Você acredita em Deus?', 'Reflexão', 9),
('O que faria você arriscar tudo?', 'Reflexão', 10),
('O que você faria hoje se soubesse que morreria amanhã?', 'Reflexão', 11),
('Onde você gostaria de estar agora?', 'Reflexão', 12),
('Em um relacionamento, o que é essencial?', 'Amor', 13),
('Para você, o amor é uma utopia?', 'Amor', 14),
('Quem foi a grande paixão da sua vida?', 'Amor', 15),
('Quem é o(a) dono(a) do seu coração hoje?', 'Amor', 16),
('Qual foi a pior pessoa que você já gostou ou se envolveu? Por quê?', 'Amor', 17),
('Vale tudo no amor e na guerra?', 'Amor', 18),
('Para você, como é o beijo perfeito?', 'Intimidade leve', 19),
('Qual é o seu ponto forte na hora de seduzir alguém?', 'Intimidade leve', 20),
('Qual é a roupa ideal para um encontro?', 'Intimidade leve', 21),
('Qual é a sua música favorita?', 'Gostos', 22),
('Qual é o seu filme favorito?', 'Gostos', 23),
('Qual é o seu livro favorito?', 'Gostos', 24),
('Qual é a sua comida favorita?', 'Gostos', 25),
('Qual é a sua bebida favorita?', 'Gostos', 26),
('Qual é a sua cor favorita?', 'Gostos', 27),
('Você prefere dia ou noite?', 'Gostos', 28),
('Qual é o seu programa de TV favorito?', 'Gostos', 29),
('Qual é o seu desenho animado favorito?', 'Gostos', 30),
('Qual é o seu animal favorito?', 'Gostos', 31),
('Qual é o seu esporte favorito?', 'Estilo de vida', 32),
('Para qual time você torce?', 'Estilo de vida', 33),
('Qual é o programa ideal para o final de semana?', 'Estilo de vida', 34),
('Qual foi a melhor viagem da sua vida?', 'Estilo de vida', 35),
('Qual é a mania mais estranha que você tem?', 'Curiosidades', 36),
('Qual é algo sobre você que ninguém acredita?', 'Curiosidades', 37),
('Qual foi a coisa mais maluca que você já fez?', 'Curiosidades', 38),
('Qual foi a coisa mais esquisita que você já viu?', 'Curiosidades', 39),
('Você já bebeu além da conta e deu vexame?', 'Curiosidades', 40),
('Quem são seus melhores amigos?', 'Pessoas e história', 41),
('Qual foi o melhor professor que você já teve?', 'Pessoas e história', 42),
('Se você ganhasse na Mega Sena, o que faria?', 'Extras', 43),
('Qual é a melhor data comemorativa pra você?', 'Extras', 44),
('Se você fosse um animal, qual seria?', 'Extras', 45),
('Você já bateu no seu PC?', 'Extras', 46),
('Você já teve uma crise de choro incontrolável?', 'Extras', 47),
('Qual era seu MSN ou ICQ?', 'Nostalgia', 48)
ON CONFLICT (question_text) DO NOTHING;
