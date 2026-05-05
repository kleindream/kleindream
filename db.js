// Postgres database layer for KleinDream
// Uses DATABASE_URL (recommended with Neon/Supabase/Render Postgres)
//
// Why: SQLite file storage is ephemeral on many hosts (Render/Vercel/etc.).
// Postgres keeps your users, profiles, messages, etc. persistent across deploys.

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

if (!process.env.DATABASE_URL) {
  console.warn(
    "[KleinDream] DATABASE_URL not set. The app will fail to connect until you set it."
  );
}

// Neon/Supabase commonly require SSL in production.
const needsSSL =
  (process.env.DATABASE_URL || "").includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSSL ? { rejectUnauthorized: false } : false
});

// Convert "?" placeholders (SQLite style) to "$1..$n" (Postgres style)
// It ignores ? inside single-quoted strings.
function convertQMarksToDollars(sql) {
  let out = "";
  let inSingle = false;
  let param = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      // toggle single-quote state, but handle escaped '' inside strings
      if (inSingle && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (!inSingle && ch === "?") {
      param += 1;
      out += `$${param}`;
      continue;
    }
    out += ch;
  }
  return out;
}

async function query(sql, params = []) {
  const text = convertQMarksToDollars(sql);
  return pool.query(text, params);
}

async function get(sql, params = []) {
  const r = await query(sql, params);
  return r.rows[0] || null;
}

async function all(sql, params = []) {
  const r = await query(sql, params);
  return r.rows;
}

async function run(sql, params = []) {
  return query(sql, params);
}


async function migrate() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = await get("SELECT 1 FROM schema_migrations WHERE name=$1", [file]);
    if (already) continue;
    const sqlRaw = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    // Safety fixups for legacy migration typos (Postgres has no "group_id" in group_posts; it uses topic_id)
    let sql = sqlRaw;
    sql = sql.replace(/group_posts\s*\(\s*group_id\s*,/g, "group_posts(topic_id,");
    sql = sql.replace(/group_posts\s*\(\s*group_id\s*\)/g, "group_posts(topic_id)");
    if (sql.trim()) {
      await query(sql);
    }
    await run("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
  }
}

async function init() {
  // Create core tables. Uses Postgres-friendly types.
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name     TEXT,
      bio           TEXT,
      city          TEXT,
      state         TEXT,
      profile_photo TEXT,

      birth_date     TEXT,
      marital_status TEXT,
      favorite_team  TEXT,
      profession     TEXT,
      hobbies        TEXT,
      favorite_music TEXT,
      favorite_movie TEXT,
      favorite_game  TEXT,
      personality    TEXT,
      personality_result TEXT,
      looking_for    TEXT,
      mood           TEXT,
      daily_phrase   TEXT,

      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Mantém bancos antigos compatíveis mesmo se uma migration anterior falhar ou já tiver sido marcada como aplicada.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_result TEXT;

    CREATE TABLE IF NOT EXISTS friend_requests (
      id            SERIAL PRIMARY KEY,
      from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(from_user_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS scraps (
      id          SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Curtidas em recados
    CREATE TABLE IF NOT EXISTS scrap_likes (
      id         SERIAL PRIMARY KEY,
      scrap_id   INTEGER NOT NULL REFERENCES scraps(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(scrap_id, user_id)
    );

    -- Comentários em recados
    CREATE TABLE IF NOT EXISTS scrap_comments (
      id         SERIAL PRIMARY KEY,
      scrap_id   INTEGER NOT NULL REFERENCES scraps(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_scrap_likes_scrap ON scrap_likes(scrap_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_scrap_comments_scrap ON scrap_comments(scrap_id, created_at);

    CREATE TABLE IF NOT EXISTS testimonials (
      id           SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS albums (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS photos (
      id         SERIAL PRIMARY KEY,
      album_id   INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      caption    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS groups (
      id          SERIAL PRIMARY KEY,
      owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      category    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id         SERIAL PRIMARY KEY,
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_topics (
      id         SERIAL PRIMARY KEY,
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS group_posts (
      id         SERIAL PRIMARY KEY,
      topic_id   INTEGER NOT NULL REFERENCES group_topics(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Curtidas em mensagens de tópicos (posts de grupo)
    CREATE TABLE IF NOT EXISTS group_post_likes (
      id         SERIAL PRIMARY KEY,
      post_id    INTEGER NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_group_post_likes_post ON group_post_likes(post_id, created_at);

    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject      TEXT NOT NULL,
      body         TEXT NOT NULL,
      is_read      INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      text       TEXT NOT NULL,
      link       TEXT,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Fãs de perfil
    CREATE TABLE IF NOT EXISTS fans (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fan_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, fan_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_fans_user_created ON fans(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fans_fan_user ON fans(fan_user_id, created_at DESC);

    -- Profile visits (Quem visitou seu perfil)
    CREATE TABLE IF NOT EXISTS profile_visits (
      id         SERIAL PRIMARY KEY,
      visitor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      visited_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_profile_visits_visited ON profile_visits(visited_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_profile_visits_pair_time ON profile_visits(visitor_id, visited_id, created_at);

    -- Compatibilidade com versões antigas do banco
    ALTER TABLE users ADD COLUMN IF NOT EXISTS time_of TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

    -- User privacy/settings
    ALTER TABLE users ADD COLUMN IF NOT EXISTS invisible_visits INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_profile_visits INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_result TEXT;

    CREATE INDEX IF NOT EXISTS idx_scraps_to_user ON scraps(to_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_testimonials_to_user ON testimonials(to_user_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, is_read, created_at);

    -- Rankings dos jogos
    CREATE TABLE IF NOT EXISTS game_scores (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game       TEXT NOT NULL,
      score      INTEGER NOT NULL DEFAULT 0,
      played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game, score DESC, played_at ASC);
    CREATE INDEX IF NOT EXISTS idx_game_scores_user_game ON game_scores(user_id, game, score DESC, played_at ASC);


    -- Caderno de perguntas da Klein Dream
    CREATE TABLE IF NOT EXISTS caderno_questions (
      id           SERIAL PRIMARY KEY,
      question_text TEXT NOT NULL UNIQUE,
      category     TEXT NOT NULL DEFAULT 'Geral',
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS caderno_answers (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id  INTEGER NOT NULL REFERENCES caderno_questions(id) ON DELETE CASCADE,
      answer_text  TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_caderno_questions_active ON caderno_questions(is_active, category, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_caderno_answers_created ON caderno_answers(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_caderno_answers_user ON caderno_answers(user_id, created_at DESC);
  `);
}

const db = { query, get, all, run, pool };

module.exports = { db, init, migrate, pool };