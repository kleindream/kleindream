const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const flash = require("connect-flash");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const { db, init, migrate, pool } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const BUILTIN_AVATARS = [
  { path: '/avatars/avatar-retro-boy.svg', label: 'Retro Boy' },
  { path: '/avatars/avatar-retro-girl.svg', label: 'Retro Girl' },
  { path: '/avatars/avatar-nerd.svg', label: 'Nerd' },
  { path: '/avatars/avatar-gamer.svg', label: 'Gamer' },
  { path: '/avatars/avatar-dreamer.svg', label: 'Sonhador' },
  { path: '/avatars/avatar-cine.svg', label: 'Cinéfilo' },
  { path: '/avatars/avatar-reader.svg', label: 'Leitor' },
  { path: '/avatars/avatar-music.svg', label: 'Música' },
  { path: '/avatars/avatar-classic-blue.svg', label: 'Klein Blue' },
  { path: '/avatars/avatar-classic-pink.svg', label: 'Klein Pink' },
  { path: '/avatars/avatar-night.svg', label: 'Noturno' },
  { path: '/avatars/avatar-sun.svg', label: 'Estrelinha' }
];

// Supabase Storage (for profile photos & albums)
// Set these env vars in Render/Vercel:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (keep secret)
// Optional:
//   SUPABASE_BUCKET (default: "kleindream")
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "kleindream";

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function assertSupabase(res) {
  if (!supabase) {
    res.status(500).send("Supabase Storage não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    return false;
  }
  return true;
}

async function uploadToSupabaseStorage({ userId, kind, file }) {
  // kind: "profile" | "photo"
  const ext = (path.extname(file.originalname) || "").toLowerCase() || ".jpg";
  const safeExt = [".jpg",".jpeg",".png",".webp",".gif"].includes(ext) ? ext : ".jpg";
  const stamp = Date.now() + "_" + Math.random().toString(16).slice(2);
  const objectPath = `${userId}/${kind}/${stamp}${safeExt}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype || "application/octet-stream",
      upsert: true
    });

  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);
  return { publicUrl: data.publicUrl, objectPath };
}


// Pastas garantidas
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Config EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rate limiting (anti-spam básico)
const limiterAuth = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const limiterActions = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const limiterWrite = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(express.static(path.join(__dirname, "public")));
const sessionMiddleware = session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "kleindream_dev_secret",
    resave: false,
    saveUninitialized: false
  });
app.use(sessionMiddleware);
app.use(flash());

// Helpers
async function getUserById(id) {
  // Use template literal so the SQL can be formatted across lines safely.
  return await db.get(`
    SELECT
      id, email, username, full_name, bio, city, state,
      profile_photo, birth_date, marital_status, favorite_team,
      profession, hobbies, favorite_music, favorite_movie, favorite_game,
      time_of, personality, looking_for, mood, daily_phrase,
      invisible_visits, notify_profile_visits, created_at
    FROM users
    WHERE id=?
  `, [id]);
}

// Datas no fuso do Brasil (GMT-3 / America/Sao_Paulo)
function formatDateBR(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function nowInSaoPaulo() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function photoSrc(value) {
  if (!value) return '/default-avatar.png';
  const v = String(value).trim();
  if (!v) return '/default-avatar.png';
  if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
  return `/uploads/${v.replace(/^\/+/, '')}`;
}

function isBuiltinAvatar(value) {
  return BUILTIN_AVATARS.some(a => a.path === value);
}

function monthDayInSP(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  return String(value).slice(5, 10);
}

function monthDayLabel(value) {
  const md = monthDayInSP(value);
  if (!md) return '';
  const [mm, dd] = md.split('-');
  return `${dd}/${mm}`;
}

function currentMonthDaySP() {
  const d = nowInSaoPaulo();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function getUpcomingMonthDays(daysAhead = 7) {
  const start = nowInSaoPaulo();
  const list = [];
  for (let i = 0; i <= daysAhead; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    list.push(`${mm}-${dd}`);
  }
  return list;
}

function isBirthdayToday(birthDate) {
  const md = monthDayInSP(birthDate);
  return !!md && md === currentMonthDaySP();
}

function formatMemberSince(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' });
}


function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

async function addNotif(userId, type, text, link = null) {
  await db.run("INSERT INTO notifications (user_id, type, text, link) VALUES (?,?,?,?)", [userId, type, text, link]);
}


async function touchPresence(userId) {
  if (!userId) return;
  await db.run(`
    INSERT INTO presence (user_id, last_active)
    VALUES (?, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET last_active = EXCLUDED.last_active
  `, [userId]);
}

async function getOnlineUsers(limit = 12) {
  return db.all(`
    SELECT u.id, u.username, u.full_name, u.profile_photo, p.last_active
    FROM presence p
    JOIN users u ON u.id = p.user_id
    WHERE p.last_active >= NOW() - INTERVAL '5 minutes'
    ORDER BY p.last_active DESC, u.username ASC
    LIMIT ?
  `, [limit]);
}


app.use((req, res, next) => {
  req.requestId = Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
  res.locals.requestId = req.requestId;
  next();
});

app.use(async (req, res, next) => {
  try {
  res.locals.me = req.session.userId ? await getUserById(req.session.userId) : null;
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
    info: req.flash('info')
  };
  res.locals.photoSrc = photoSrc;
  res.locals.builtinAvatars = BUILTIN_AVATARS;
  if (req.session.userId) {
    await touchPresence(req.session.userId);
    const notifs = await db.all("SELECT * FROM notifications WHERE user_id=? AND is_read=0 ORDER BY created_at DESC LIMIT 20", [req.session.userId]);
    res.locals.notifCount = notifs.length;
  } else {
    res.locals.notifCount = 0;
  }
  } catch (err) { return next(err); }
  next();
});

// Upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) return cb(new Error("Apenas imagens."));
    cb(null, true);
  }
});

// ===== ROTAS PÚBLICAS =====

const GAME_META = {
  memory: { label: "Jogo da Memória", icon: "🧠" },
  snake: { label: "Snake", icon: "🐍" },
  rps: { label: "Pedra, Papel e Tesoura", icon: "✊" },
  velha: { label: "Jogo da Velha", icon: "❌" },
  quiz: { label: "Quiz Nostalgia", icon: "📺" }
};

function getGameMeta(game) {
  return GAME_META[game] || { label: game, icon: "🎮" };
}

async function getGameRanking(game, limit = 10) {
  return db.all(`
    SELECT ranked.username, ranked.score, ranked.played_at
    FROM (
      SELECT DISTINCT ON (gs.user_id)
        gs.user_id,
        u.username,
        gs.score,
        gs.played_at
      FROM game_scores gs
      JOIN users u ON u.id = gs.user_id
      WHERE gs.game = ?
      ORDER BY gs.user_id, gs.score DESC, gs.played_at ASC
    ) ranked
    ORDER BY ranked.score DESC, ranked.played_at ASC
    LIMIT ?
  `, [game, limit]);
}

async function getMyBestScore(userId, game) {
  return db.get(`
    SELECT score, played_at
    FROM game_scores
    WHERE user_id = ? AND game = ?
    ORDER BY score DESC, played_at ASC
    LIMIT 1
  `, [userId, game]);
}

async function getGamesOverview(limit = 5) {
  const entries = await Promise.all(
    Object.keys(GAME_META).map(async (game) => ({
      game,
      meta: getGameMeta(game),
      ranking: await getGameRanking(game, limit)
    }))
  );
  return entries;
}

app.get("/", async (req, res) => res.render("index"));

// Sobre (texto fictício para o Digão editar)
app.get("/about", async (req, res) => {
  res.render("about");
});

app.get("/register", async (req, res) => res.render("register", { error: null }));
app.post("/register", limiterAuth, async (req, res) => {
  const { email, username, password, full_name } = req.body;

  if (!email || !username || !password) return res.render("register", { error: "Preencha e-mail, usuário e senha." });
  if (password.length < 4) return res.render("register", { error: "Senha muito curta (mínimo 4)." });

  const exists = await db.get("SELECT 1 FROM users WHERE email=? OR username=?", [email, username]);
  if (exists) return res.render("register", { error: "E-mail ou usuário já existe." });

  const hash = bcrypt.hashSync(password, 10);
  const info = await db.run("INSERT INTO users (email, username, password_hash, full_name) VALUES (?,?,?,?) RETURNING id", [email, username, hash, full_name || null]);

  req.session.userId = info.rows[0].id;
  req.flash("success", "Conta criada! Bem-vindo(a) ao KleinDream 💙");
  res.redirect("/home");
});

app.get("/login", async (req, res) => res.render("login", { error: null }));
app.post("/login", limiterAuth, async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE email=? OR username=?", [usernameOrEmail, usernameOrEmail]);
  if (!user) return res.render("login", { error: "Usuário não encontrado." });

  const ok = bcrypt.compareSync(password || "", user.password_hash);
  if (!ok) return res.render("login", { error: "Senha incorreta." });

  req.session.userId = user.id;
    req.session.username = user.username;
  req.flash("success", "Bem-vindo(a) de volta!");
  res.redirect("/home");
});

app.post("/logout", async (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});


app.get("/games", requireAuth, async (req, res) => {
  const overview = await getGamesOverview(5);
  res.render("games", { overview });
});

async function renderGamePage(req, res, viewName, game) {
  const [ranking, myBest] = await Promise.all([
    getGameRanking(game, 10),
    getMyBestScore(req.session.userId, game)
  ]);
  res.render(viewName, {
    ranking,
    myBest,
    gameKey: game,
    gameMeta: getGameMeta(game)
  });
}

app.get("/games/memory", requireAuth, async (req, res) => {
  await renderGamePage(req, res, "game_memory", "memory");
});

app.get("/games/snake", requireAuth, async (req, res) => {
  await renderGamePage(req, res, "game_snake", "snake");
});

app.get("/games/rps", requireAuth, async (req, res) => {
  await renderGamePage(req, res, "game_rps", "rps");
});

app.get("/games/velha", requireAuth, async (req, res) => {
  await renderGamePage(req, res, "game_velha", "velha");
});

app.get("/games/quiz", requireAuth, async (req, res) => {
  await renderGamePage(req, res, "game_quiz", "quiz");
});

app.post("/api/games/score", requireAuth, async (req, res) => {
  const game = String(req.body.game || "").trim().toLowerCase();
  const score = Number(req.body.score);

  if (!GAME_META[game]) {
    return res.status(400).json({ ok: false, error: "Jogo inválido." });
  }
  if (!Number.isFinite(score) || score < 0) {
    return res.status(400).json({ ok: false, error: "Pontuação inválida." });
  }

  const safeScore = Math.max(0, Math.min(999999, Math.floor(score)));

  await db.run(
    "INSERT INTO game_scores (user_id, game, score) VALUES (?, ?, ?)",
    [req.session.userId, game, safeScore]
  );

  const [ranking, myBest] = await Promise.all([
    getGameRanking(game, 10),
    getMyBestScore(req.session.userId, game)
  ]);

  res.json({ ok: true, ranking, myBest, savedScore: safeScore });
});

// ===== HOME =====
app.get("/home", requireAuth, async (req, res) => {
  const meId = req.session.userId;

  const [
    incomingRequests,
    pendingTestimonials,
    unreadMessages,
    latestScraps,
    birthdaysRaw,
    totalMembersRow,
    recentMembersRow,
    totalScrapsRow,
    totalPhotosRow,
    totalGroupsRow,
    newUsers,
    featuredGroups,
    gameLeaders,
    activeMembers,
    recentMuralPosts,
    onlineMembers
  ] = await Promise.all([
    db.all(`
      SELECT fr.id, u.id AS user_id, u.username, u.full_name
      FROM friend_requests fr
      JOIN users u ON u.id = fr.from_user_id
      WHERE fr.to_user_id=? AND fr.status='pending'
      ORDER BY fr.created_at DESC
    `, [meId]),

    db.all(`
      SELECT t.id, u.id AS user_id, u.username, u.full_name, t.created_at
      FROM testimonials t
      JOIN users u ON u.id = t.from_user_id
      WHERE t.to_user_id=? AND t.status='pending'
      ORDER BY t.created_at DESC
    `, [meId]),

    db.all(`
      SELECT m.id, u.username AS from_username, m.subject, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.from_user_id
      WHERE m.to_user_id=? AND m.is_read=0
      ORDER BY m.created_at DESC
      LIMIT 10
    `, [meId]),

    db.all(`
      SELECT s.id, s.content, s.created_at, u.username AS from_username, u.id AS from_id
      FROM scraps s
      JOIN users u ON u.id = s.from_user_id
      WHERE s.to_user_id=?
      ORDER BY s.created_at DESC
      LIMIT 10
    `, [meId]),

    db.all(`
      SELECT id, username, full_name, profile_photo, birth_date
      FROM users
      WHERE birth_date IS NOT NULL AND TRIM(birth_date) <> ''
      ORDER BY username ASC
    `),

    db.get(`SELECT COUNT(*)::int AS total FROM users`),
    db.get(`SELECT COUNT(*)::int AS total FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`),
    db.get(`SELECT COUNT(*)::int AS total FROM scraps`),
    db.get(`SELECT COUNT(*)::int AS total FROM photos`),
    db.get(`SELECT COUNT(*)::int AS total FROM groups`),

    db.all(`
      SELECT id, username, full_name, profile_photo, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 8
    `),

    db.all(`
      SELECT g.id, g.name, g.category, g.description, COUNT(gm.user_id)::int AS members_count
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      GROUP BY g.id, g.name, g.category, g.description, g.created_at
      ORDER BY members_count DESC, g.created_at DESC
      LIMIT 8
    `),

    db.all(`
      SELECT u.username, MAX(gs.score)::int AS points, gs.game
      FROM game_scores gs
      JOIN users u ON u.id = gs.user_id
      GROUP BY u.username, gs.game
      ORDER BY points DESC, u.username ASC
      LIMIT 8
    `),

    db.all(`
      SELECT u.id, u.username, u.full_name, u.profile_photo,
             (
               COALESCE((SELECT COUNT(*) FROM scraps s WHERE s.from_user_id = u.id AND s.created_at >= NOW() - INTERVAL '7 days'), 0) +
               COALESCE((SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.created_at >= NOW() - INTERVAL '7 days'), 0) +
               COALESCE((SELECT COUNT(*) FROM photos ph WHERE ph.user_id = u.id AND ph.created_at >= NOW() - INTERVAL '7 days'), 0)
             )::int AS activity_score
      FROM users u
      ORDER BY activity_score DESC, u.created_at DESC
      LIMIT 6
    `),

    db.all(`
      SELECT p.id, p.content, p.created_at, u.username, u.full_name, u.profile_photo
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT 5
    `),

    getOnlineUsers(12)
  ]);

  const todayMD = currentMonthDaySP();
  const upcomingWindow = getUpcomingMonthDays(7);
  const orderMap = new Map(upcomingWindow.map((md, idx) => [md, idx]));
  const todayBirthdays = birthdaysRaw
    .filter(u => monthDayInSP(u.birth_date) === todayMD)
    .map(u => ({ ...u, birth_label: monthDayLabel(u.birth_date) }));
  const upcomingBirthdays = birthdaysRaw
    .filter(u => { const md = monthDayInSP(u.birth_date); return md && md !== todayMD && orderMap.has(md); })
    .map(u => ({ ...u, birth_label: monthDayLabel(u.birth_date) }))
    .sort((a, b) => (orderMap.get(monthDayInSP(a.birth_date)) ?? 999) - (orderMap.get(monthDayInSP(b.birth_date)) ?? 999));

  const networkStats = {
    totalMembers: totalMembersRow?.total || 0,
    newMembersWeek: recentMembersRow?.total || 0,
    totalScraps: totalScrapsRow?.total || 0,
    totalPhotos: totalPhotosRow?.total || 0,
    totalGroups: totalGroupsRow?.total || 0
  };

  res.render("home", {
    incomingRequests,
    pendingTestimonials,
    unreadMessages,
    latestScraps,
    todayBirthdays,
    upcomingBirthdays,
    networkStats,
    newUsers,
    featuredGroups,
    gameLeaders,
    activeMembers: activeMembers.filter(u => Number(u.activity_score || 0) > 0),
    recentMuralPosts,
    onlineMembers
  });
});


// ===== MURAL (PÚBLICO) =====
app.get("/mural", requireAuth, async (req, res) => {
  const posts = await db.all(`
    SELECT p.id, p.content, p.created_at,
           u.username, u.full_name, u.profile_photo
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  `);

  res.render("mural", { posts });
});

app.post("/mural", limiterWrite, requireAuth, async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content) return res.redirect("/mural");

  const clipped = content.slice(0, 800);
  await db.run("INSERT INTO posts (user_id, content) VALUES (?,?)", [req.session.userId, clipped]);

  res.redirect("/mural");
});


// ===== NOSSO TEMPO =====
const NOSSO_TEMPO_PROMPTS = [
  "a internet fazia barulho ao conectar?",
  "o MSN avisava que alguém entrou?",
  "a gente escolhia música pro status?",
  "lan house era ponto de encontro?",
  "a foto tinha data amarela no canto?",
  "a gente salvava coisa em disquete?",
  "a fita VHS precisava rebobinar?",
  "a gente esperava a página carregar sem reclamar?",
  "o Orkut era a primeira coisa que abria?",
  "a madrugada parecia infinita?"
];

function promptOfDay() {
  const d = new Date();
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  // hash simples (estável por dia)
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const idx = h % NOSSO_TEMPO_PROMPTS.length;
  return NOSSO_TEMPO_PROMPTS[idx];
}


const RADIO_STATIONS = [
  {
    key: "disco",
    name: "Disco Classics",
    emoji: "🪩",
    subtitle: "clássicos leves pra navegar sem pressa",
    youtubeId: "bHfrdQ8h2Pw"
  },
  {
    key: "dance90",
    name: "Dance 90s",
    emoji: "⚡",
    subtitle: "batidas conhecidas que lembram pista e CD gravado",
    youtubeId: "6M6samPEMpM"
  },
  {
    key: "chill",
    name: "Electronic Chill",
    emoji: "🌌",
    subtitle: "eletrônica suave pra ficar de boa no site",
    youtubeId: "5qap5aO4i9A"
  },
  {
    key: "flash2000",
    name: "Flashback 2000",
    emoji: "✨",
    subtitle: "dance/pop eletrônico do comecinho dos anos 2000",
    youtubeId: "Vx8dQh7I0dQ"
  }
];

function getRadioStation(key) {
  return RADIO_STATIONS.find(s => s.key === key) || RADIO_STATIONS[0];
}

async function safeOnlineCount() {
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS c FROM session WHERE expire > NOW()");
    return r.rows?.[0]?.c || 0;
  } catch (e) {
    return 0;
  }
}

app.get("/nosso-tempo", requireAuth, async (req, res) => {
  const prompt = promptOfDay();

  const totalUsersRow = await db.get("SELECT COUNT(*)::int AS c FROM users");
  const weekRow = await db.get("SELECT COUNT(*)::int AS c FROM users WHERE created_at >= (NOW() - INTERVAL '7 days')");
  const onlineNow = await safeOnlineCount();

  // Conexões: "eu sou do tempo de..."
  const timeOfTop = await db.all(`
    SELECT time_of, COUNT(*)::int AS c
    FROM users
    WHERE time_of IS NOT NULL AND TRIM(time_of) <> ''
    GROUP BY time_of
    ORDER BY c DESC, time_of ASC
    LIMIT 8
  `);

  // Mapa emocional: humor do dia
  const moodTop = await db.all(`
    SELECT mood, COUNT(*)::int AS c
    FROM users
    WHERE mood IS NOT NULL AND TRIM(mood) <> ''
    GROUP BY mood
    ORDER BY c DESC, mood ASC
    LIMIT 8
  `);

  const posts = await db.all(`
    SELECT p.id, p.body, p.created_at, u.username, u.full_name, u.profile_photo
    FROM nosso_tempo_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.kind = 'remember' AND p.prompt_text = ?
    ORDER BY p.created_at DESC
    LIMIT 30
  `, [prompt]);

  for (const p of posts) p.created_at = formatDateBR(p.created_at);

  res.render("nosso_tempo", {
    prompt,
    stats: {
      totalUsers: totalUsersRow?.c || 0,
      onlineNow,
      joinedWeek: weekRow?.c || 0
    },
    timeOfTop,
    moodTop,
    posts
  });
});

app.post("/nosso-tempo/remember", limiterWrite, requireAuth, async (req, res) => {
  const prompt = String(req.body.prompt || "").trim() || promptOfDay();
  const body = String(req.body.body || "").trim();

  if (!body) return res.redirect("/nosso-tempo");

  const clipped = body.slice(0, 280);
  await db.run(
    "INSERT INTO nosso_tempo_posts (user_id, kind, prompt_text, body) VALUES (?,?,?,?)",
    [req.session.userId, "remember", prompt, clipped]
  );

  res.redirect("/nosso-tempo");
});



app.get("/radio", requireAuth, async (req, res) => {
  const station = getRadioStation(String(req.query.station || "").trim());
  const comments = await db.all(`
    SELECT rc.id, rc.station_key, rc.content, rc.created_at, u.username, u.full_name, u.profile_photo
    FROM radio_comments rc
    JOIN users u ON u.id = rc.user_id
    WHERE rc.station_key = ?
    ORDER BY rc.created_at DESC
    LIMIT 40
  `, [station.key]);

  for (const c of comments) c.created_at = formatDateBR(c.created_at);

  res.render("radio", {
    stations: RADIO_STATIONS,
    station,
    comments
  });
});

app.post("/radio/comment", limiterWrite, requireAuth, async (req, res) => {
  const station = getRadioStation(String(req.body.station || "").trim());
  const content = String(req.body.content || "").trim();
  if (!content) return res.redirect(`/radio?station=${encodeURIComponent(station.key)}`);

  await db.run(
    "INSERT INTO radio_comments (user_id, station_key, content) VALUES (?,?,?)",
    [req.session.userId, station.key, content.slice(0, 280)]
  );

  req.flash("success", "Comentário enviado na rádio.");
  res.redirect(`/radio?station=${encodeURIComponent(station.key)}`);
});

// ===== FÃS =====
app.post("/fan/:username", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const user = await db.get("SELECT id, username FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).send("Usuário não encontrado.");
  if (user.id === meId) return res.redirect(`/u/${user.username}`);

  const existing = await db.get("SELECT id FROM fans WHERE user_id=? AND fan_user_id=?", [user.id, meId]);

  if (existing) {
    await db.run("DELETE FROM fans WHERE user_id=? AND fan_user_id=?", [user.id, meId]);
    req.flash("info", `Você deixou de ser fã de ${user.username}.`);
  } else {
    await db.run("INSERT INTO fans (user_id, fan_user_id) VALUES (?,?) ON CONFLICT DO NOTHING", [user.id, meId]);
    const me = await getUserById(meId);
    await addNotif(user.id, "fan", `${me.username} virou seu fã.`, `/fans/${user.username}`);
    req.flash("success", `Agora você é fã de ${user.username}!`);
  }

  res.redirect(`/u/${user.username}`);
});

app.get("/fans/:username", requireAuth, async (req, res) => {
  const user = await db.get("SELECT id, username, full_name FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).send("Usuário não encontrado.");

  const fans = await db.all(`
    SELECT u.id, u.username, u.full_name, u.profile_photo, f.created_at
    FROM fans f
    JOIN users u ON u.id = f.fan_user_id
    WHERE f.user_id=?
    ORDER BY f.created_at DESC, u.username ASC
  `, [user.id]);

  for (const f of fans) f.created_at = formatDateBR(f.created_at);

  res.render("fans", { user, fans });
});

// ===== PERFIL =====
app.get("/u/:username", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const user = await db.get(`
    SELECT
      id, username, full_name, bio, city, state,
      profile_photo, birth_date, marital_status, favorite_team,
      profession, hobbies, favorite_music, favorite_movie, favorite_game,
      time_of, personality, looking_for, mood, daily_phrase,
      invisible_visits, notify_profile_visits, created_at,
      CASE WHEN EXISTS (
        SELECT 1 FROM presence p
        WHERE p.user_id = users.id
          AND p.last_active >= NOW() - INTERVAL '5 minutes'
      ) THEN 1 ELSE 0 END AS is_online
    FROM users
    WHERE username=?
  `, [req.params.username]);
  if (!user) return res.status(404).send("Usuário não encontrado.");

  const isMe = user.id === meId;
  const me = res.locals.me;

  const friend = await db.get("SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?", [meId, user.id]);

  const reqOut = await db.get("SELECT status FROM friend_requests WHERE from_user_id=? AND to_user_id=?", [meId, user.id]);
  const reqIn = await db.get("SELECT status FROM friend_requests WHERE from_user_id=? AND to_user_id=?", [user.id, meId]);

  // Registrar visita ao perfil (se não for eu mesmo e se NÃO estiver em modo invisível)
  if (!isMe && me && Number(me.invisible_visits || 0) === 0) {
    const recent = await db.get(`
      SELECT 1
      FROM profile_visits
      WHERE visitor_id=? AND visited_id=?
        AND created_at > NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `, [meId, user.id]);

    if (!recent) {
      await db.run("INSERT INTO profile_visits (visitor_id, visited_id) VALUES (?,?)", [meId, user.id]);

      // Notificação de visita (se o dono permitir)
      if (Number(user.notify_profile_visits ?? 1) === 1) {
        await addNotif(user.id, "visit", `${me.username} visitou seu perfil.`, "/me/visitors");
      }
    }
  }

  const scraps = await db.all(`
    SELECT s.id, s.content, s.created_at, u.username AS from_username
    FROM scraps s
    JOIN users u ON u.id = s.from_user_id
    WHERE s.to_user_id=?
    ORDER BY s.created_at DESC
    LIMIT 20
  `, [user.id]);

  const testimonials = await db.all(`
    SELECT t.id, t.content, t.created_at, u.username AS from_username
    FROM testimonials t
    JOIN users u ON u.id = t.from_user_id
    WHERE t.to_user_id=? AND t.status='approved'
    ORDER BY t.created_at DESC
    LIMIT 20
  `, [user.id]);

  const memberSince = formatMemberSince(user.created_at);
  // Formatar datas para GMT-3
  user.created_at = formatDateBR(user.created_at);
  for (const s of scraps) s.created_at = formatDateBR(s.created_at);
  for (const t of testimonials) t.created_at = formatDateBR(t.created_at);

  const friendsCount = Number((await db.get("SELECT COUNT(*)::int AS c FROM friendships WHERE user_id=?", [user.id]))?.c || 0);
  const fansCount = Number((await db.get("SELECT COUNT(*)::int AS c FROM fans WHERE user_id=?", [user.id]))?.c || 0);
  const isFan = !isMe && !!(await db.get("SELECT 1 FROM fans WHERE user_id=? AND fan_user_id=?", [user.id, meId]));
  const recentFans = await db.all(`
    SELECT u.username, u.full_name, u.profile_photo
    FROM fans f
    JOIN users u ON u.id = f.fan_user_id
    WHERE f.user_id=?
    ORDER BY f.created_at DESC, u.username ASC
    LIMIT 6
  `, [user.id]);

  const profileFriends = await db.all(`
    SELECT u.username, u.full_name, u.profile_photo
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id=?
    ORDER BY u.username ASC
    LIMIT 9
  `, [user.id]);

  const groupsCount = Number((await db.get(`
    SELECT COUNT(DISTINCT gm.group_id)::int AS c
    FROM group_members gm
    WHERE gm.user_id=?
  `, [user.id]))?.c || 0);

  const profileGroups = await db.all(`
    SELECT g.id, g.name,
           COALESCE(g.category, 'Sem categoria') AS category,
           (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id=g.id) AS members
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id=?
    ORDER BY g.name ASC
    LIMIT 9
  `, [user.id]);

  // Visitas (contador + últimos visitantes)
  const totalVisits = (await db.get("SELECT COUNT(*)::int AS c FROM profile_visits WHERE visited_id=?", [user.id]))?.c || 0;

  const canSeeVisitors = isMe && me && Number(me.invisible_visits || 0) === 0;
  const visitors = canSeeVisitors
    ? await db.all(`
        SELECT u.id, u.username, u.full_name, u.profile_photo, pv.created_at
        FROM profile_visits pv
        JOIN users u ON u.id = pv.visitor_id
        WHERE pv.visited_id=?
        ORDER BY pv.created_at DESC
        LIMIT 10
      `, [user.id])
    : [];

  for (const v of visitors) v.created_at = formatDateBR(v.created_at);

  res.render("profile", {
    user, isMe,
    friend: !!friend, reqOut, reqIn,
    scraps, testimonials, friendsCount, fansCount, isFan, recentFans,
    profileFriends, profileGroups, groupsCount,
    totalVisits, visitors, canSeeVisitors,
    isBirthdayToday: isBirthdayToday(user.birth_date), memberSince
  });
});

app.get("/profile/edit", requireAuth, async (req, res) => {
  const me = await getUserById(req.session.userId);
  const currentPhotoMode = isBuiltinAvatar(me?.profile_photo) ? 'avatar' : (me?.profile_photo ? 'upload' : 'keep');
  res.render("profile_edit", { me, avatars: BUILTIN_AVATARS, currentPhotoMode, error: null, ok: null });
});

app.post("/profile/edit", limiterActions, requireAuth, upload.single("profile_photo"), async (req, res) => {
  const meId = req.session.userId;
  const {
    full_name, bio, city, state,
    birth_date, marital_status, favorite_team, profession,
    hobbies, favorite_music, favorite_movie, favorite_game,
    time_of,
    personality, looking_for, mood, daily_phrase,
    invisible_visits, notify_profile_visits,
    photo_mode, selected_avatar
  } = req.body;

  await db.run(`UPDATE users SET
      full_name=?, bio=?, city=?, state=?,
      birth_date=?, marital_status=?, favorite_team=?, profession=?,
      hobbies=?, favorite_music=?, favorite_movie=?, favorite_game=?,
      time_of=?,
      personality=?, looking_for=?, mood=?, daily_phrase=?,
      invisible_visits=?, notify_profile_visits=?
    WHERE id=?`, [full_name || null, bio || null, city || null, state || null,
      birth_date || null, marital_status || null, favorite_team || null, profession || null,
      hobbies || null, favorite_music || null, favorite_movie || null, favorite_game || null, time_of || null,
      personality || null, looking_for || null, mood || null, daily_phrase || null,
      (invisible_visits ? 1 : 0), (notify_profile_visits ? 1 : 0),
      meId]);


  // Escolha entre avatar pronto ou foto enviada
  if (photo_mode === 'avatar' && isBuiltinAvatar(selected_avatar)) {
    await db.run("UPDATE users SET profile_photo=? WHERE id=?", [selected_avatar, meId]);
  } else if (photo_mode === 'upload' && req.file) {
    if (!assertSupabase(res)) return;
    try {
      const { publicUrl } = await uploadToSupabaseStorage({ userId: meId, kind: "profile", file: req.file });
      await db.run("UPDATE users SET profile_photo=? WHERE id=?", [publicUrl, meId]);
    } catch (e) {
      console.error("[KleinDream] Upload profile photo error:", e);
      const me = await getUserById(meId);
      const currentPhotoMode = isBuiltinAvatar(me?.profile_photo) ? 'avatar' : (me?.profile_photo ? 'upload' : 'keep');
      return res.render("profile_edit", { me, avatars: BUILTIN_AVATARS, currentPhotoMode, error: "Falha ao enviar a foto. Tente outra imagem.", ok: null });
    }
  }

  const me = await getUserById(meId);
  const currentPhotoMode = isBuiltinAvatar(me?.profile_photo) ? 'avatar' : (me?.profile_photo ? 'upload' : 'keep');
  res.render("profile_edit", { me, avatars: BUILTIN_AVATARS, currentPhotoMode, error: null, ok: "Perfil atualizado." });
});
// ===== VISITANTES (Histórico) =====


// ===== BATE-PAPO (1 sala) =====
app.get("/chat", requireAuth, async (req, res, next) => {
  try {
    res.render("chat", { title: "Bate-papo" });
  } catch (err) { return next(err); }
});

app.get("/me/visitors", requireAuth, async (req, res) => {
  const me = await getUserById(req.session.userId);

  // Regra justa: em modo invisível você não vê seus visitantes
  if (Number(me?.invisible_visits || 0) === 1) {
    return res.render("visitors", {
      blocked: true,
      range: "all",
      page: 1,
      pages: 1,
      total: 0,
      visits: []
    });
  }

  const range = (req.query.range || "all").toString();
  const page = Math.max(1, parseInt((req.query.page || "1").toString(), 10) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  let whereRange = "";
  if (range === "24h") whereRange = "AND pv.created_at > NOW() - INTERVAL '24 hours'";
  else if (range === "7d") whereRange = "AND pv.created_at > NOW() - INTERVAL '7 days'";
  else if (range === "30d") whereRange = "AND pv.created_at > NOW() - INTERVAL '30 days'";

  const total = (await db.get(`
    SELECT COUNT(*)::int AS c
    FROM profile_visits pv
    WHERE pv.visited_id=? ${whereRange}
  `, [me.id]))?.c || 0;

  const pages = Math.max(1, Math.ceil(total / limit));

  const visits = await db.all(`
    SELECT u.id, u.username, u.full_name, u.profile_photo, pv.created_at
    FROM profile_visits pv
    JOIN users u ON u.id = pv.visitor_id
    WHERE pv.visited_id=? ${whereRange}
    ORDER BY pv.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `, [me.id]);

  res.render("visitors", { blocked: false, range, page, pages, total, visits });
});


// ===== AMIZADES =====

// ===== CONTA (Excluir) =====
app.get("/account/delete", requireAuth, async (req, res) => {
  res.render("account_delete", { error: null });
});

app.post("/account/delete", limiterActions, requireAuth, async (req, res, next) => {
  try {
    const meId = req.session.userId;
    const password = String(req.body.password || "");
    const confirm = String(req.body.confirm || "").trim().toUpperCase();

    if (confirm !== "EXCLUIR") {
      return res.render("account_delete", { error: "Digite EXCLUIR para confirmar." });
    }

    const me = await db.get("SELECT id, password_hash, username FROM users WHERE id=?", [meId]);
    if (!me) return res.redirect("/logout");

    const ok = await bcrypt.compare(password, me.password_hash);
    if (!ok) {
      return res.render("account_delete", { error: "Senha incorreta." });
    }

    // Capturar arquivos para tentar limpar (se armazenados localmente).
    const photos = await db.all("SELECT filename FROM photos WHERE user_id=?", [meId]);
    const profile = await db.get("SELECT profile_photo FROM users WHERE id=?", [meId]);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Apagar usuário (cascata cuida do resto)
      await client.query("DELETE FROM users WHERE id=$1", [meId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    // Tentativa best-effort de apagar arquivos locais (se existirem)
    const localPaths = [];
    const maybeLocal = (urlOrPath) => {
      if (!urlOrPath) return;
      // Se for URL (Supabase), não dá para apagar aqui.
      if (/^https?:\/\//i.test(urlOrPath)) return;
      localPaths.push(urlOrPath);
    };
    photos.forEach(p => maybeLocal(p.filename));
    maybeLocal(profile && profile.profile_photo);

    for (const p of localPaths) {
      try {
        const abs = path.isAbsolute(p) ? p : path.join(__dirname, "public", p.replace(/^\//, ""));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (_) {}
    }

    req.session.destroy(() => {});
    req.flash("success", "Conta excluída com sucesso.");
    res.redirect("/");
  } catch (err) {
    return next(err);
  }
});


app.get("/friends", requireAuth, async (req, res, next) => {
  try {
  const meId = req.session.userId;

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = 50;
  const offset = (page - 1) * limit;

  const totalRow = await db.get("SELECT COUNT(*)::int AS c FROM friendships WHERE user_id=?", [meId]);
  const total = (totalRow && (totalRow.c ?? totalRow.count ?? 0)) || 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const friends = await db.all(`
    SELECT u.id, u.username, u.full_name
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id=?
    ORDER BY u.username
    LIMIT ${limit} OFFSET ${offset}
  `, [meId]);

  const incomingRequests = await db.all(`
    SELECT fr.id, u.id AS user_id, u.username, u.full_name, fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id=? AND fr.status='pending'
    ORDER BY fr.created_at DESC
  `, [meId]);

  const outgoingRequests = await db.all(`
    SELECT fr.id, u.id AS user_id, u.username, u.full_name, fr.status, fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.to_user_id
    WHERE fr.from_user_id=?
    ORDER BY fr.created_at DESC
  `, [meId]);

  res.render("friends", { friends, incomingRequests, outgoingRequests, page, pages, total });
  } catch (err) { return next(err); }
});

app.post("/friends/request/:userId", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const otherId = Number(req.params.userId);
  if (otherId === meId) return res.redirect("back");

  const already = await db.get("SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?", [meId, otherId]);
  if (already) return res.redirect("back");

  try {
    await db.run("INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?,?)", [meId, otherId]);
    await addNotif(otherId, "friend_request", "Você recebeu um pedido de amizade.", "/friends");
  } catch (e) {}
  res.redirect("back");
});

app.post("/friends/accept/:requestId", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const reqId = Number(req.params.requestId);

  const fr = await db.get("SELECT * FROM friend_requests WHERE id=? AND to_user_id=?", [reqId, meId]);
  if (!fr) return res.redirect("/friends");

  await db.run("UPDATE friend_requests SET status='accepted' WHERE id=?", [reqId]);

  await db.run("INSERT INTO friendships (user_id, friend_id) VALUES (?,?) ON CONFLICT DO NOTHING", [fr.from_user_id, fr.to_user_id]);
  await db.run("INSERT INTO friendships (user_id, friend_id) VALUES (?,?) ON CONFLICT DO NOTHING", [fr.to_user_id, fr.from_user_id]);

  await addNotif(fr.from_user_id, "friend_accept", "Seu pedido de amizade foi aceito.", `/u/${(await getUserById(meId)).username}`);
  req.flash("success", "Amizade aceita!");
  res.redirect("/friends");
});

app.post("/friends/reject/:requestId", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const reqId = Number(req.params.requestId);
  await db.run("UPDATE friend_requests SET status='rejected' WHERE id=? AND to_user_id=?", [reqId, meId]);
  res.redirect("/friends");
});

app.post("/friends/remove/:userId", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const otherId = Number(req.params.userId);
  await db.run("DELETE FROM friendships WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)", [meId, otherId, otherId, meId]);
  req.flash("info", "Amigo removido.");
  res.redirect("/friends");
});

// ===== RECADOS =====
app.get("/scraps/:username", requireAuth, async (req, res) => {
  const user = await db.get("SELECT id, username, full_name FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).send("Usuário não encontrado.");

  const meId = req.session.userId;

  const scraps = await db.all(`
    SELECT
      s.id, s.content, s.created_at,
      u.username AS from_username, u.id AS from_id,
      (SELECT COUNT(*) FROM scrap_likes sl WHERE sl.scrap_id = s.id) AS like_count,
      EXISTS(SELECT 1 FROM scrap_likes sl WHERE sl.scrap_id = s.id AND sl.user_id = ?) AS liked
    FROM scraps s
    JOIN users u ON u.id = s.from_user_id
    WHERE s.to_user_id=?
    ORDER BY s.created_at DESC
    LIMIT 100
  `, [meId, user.id]);

  const scrapIds = scraps.map(s => s.id);
  let commentsByScrap = {};
  if (scrapIds.length) {
    const comments = await db.all(`
      SELECT c.id, c.scrap_id, c.content, c.created_at, u.username AS author
      FROM scrap_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.scrap_id = ANY(?::int[])
      ORDER BY c.created_at ASC
    `, [scrapIds]);
    for (const c of comments) {
      if (!commentsByScrap[c.scrap_id]) commentsByScrap[c.scrap_id] = [];
      commentsByScrap[c.scrap_id].push(c);
    }
  }

  res.render("scraps", { user, scraps, commentsByScrap });
});

app.post("/scraps/:username", limiterWrite, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const { content } = req.body;
  const to = await db.get("SELECT id FROM users WHERE username=?", [req.params.username]);
  if (!to) return res.redirect("/home");
  if (!content || !content.trim()) return res.redirect(`/scraps/${req.params.username}`);

  await db.run("INSERT INTO scraps (from_user_id, to_user_id, content) VALUES (?,?,?)", [meId, to.id, content.trim()]);
  await addNotif(to.id, "scrap", "Você recebeu um recado.", `/scraps/${req.params.username}`);
  req.flash("success", "Recado enviado!");
  res.redirect(`/scraps/${req.params.username}`);
});

// ===== CURTIDAS E COMENTÁRIOS (Reactions) =====
app.post('/scraps/like/:scrapId', requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const scrapId = Number(req.params.scrapId);
  const returnTo = req.body.returnTo || req.get('referer') || '/home';

  const scrap = await db.get('SELECT id, to_user_id FROM scraps WHERE id=?', [scrapId]);
  if (!scrap) return res.redirect(returnTo);

  const existing = await db.get('SELECT 1 FROM scrap_likes WHERE user_id=? AND scrap_id=?', [meId, scrapId]);
  if (existing) {
    await db.run('DELETE FROM scrap_likes WHERE user_id=? AND scrap_id=?', [meId, scrapId]);
  } else {
    await db.run('INSERT INTO scrap_likes (user_id, scrap_id) VALUES (?,?) ON CONFLICT (user_id, scrap_id) DO NOTHING', [meId, scrapId]);
    if (scrap.to_user_id !== meId) {
      await addNotif(scrap.to_user_id, 'like', 'Alguém curtiu um recado seu.', returnTo);
    }
  }
  res.redirect(returnTo);
});

app.post('/scraps/comment/:scrapId', requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const scrapId = Number(req.params.scrapId);
  const content = (req.body.content || '').trim();
  const returnTo = req.body.returnTo || req.get('referer') || '/home';
  if (!content) return res.redirect(returnTo);

  const scrap = await db.get('SELECT id, to_user_id FROM scraps WHERE id=?', [scrapId]);
  if (!scrap) return res.redirect(returnTo);

  await db.run('INSERT INTO scrap_comments (scrap_id, user_id, content) VALUES (?,?,?)', [scrapId, meId, content]);
  if (scrap.to_user_id !== meId) {
    await addNotif(scrap.to_user_id, 'comment', 'Alguém comentou um recado seu.', returnTo);
  }
  res.redirect(returnTo);
});

app.post('/groups/post/like/:postId', requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const postId = Number(req.params.postId);
  const returnTo = req.body.returnTo || req.get('referer') || '/groups';

  const gp = await db.get('SELECT p.id, t.group_id, p.user_id AS owner_id FROM group_posts p JOIN group_topics t ON t.id=p.topic_id WHERE p.id=?', [postId]);
  if (!gp) return res.redirect(returnTo);

  const existing = await db.get('SELECT 1 FROM group_post_likes WHERE user_id=? AND post_id=?', [meId, postId]);
  if (existing) {
    await db.run('DELETE FROM group_post_likes WHERE user_id=? AND post_id=?', [meId, postId]);
  } else {
    await db.run('INSERT INTO group_post_likes (user_id, post_id) VALUES (?,?) ON CONFLICT (user_id, post_id) DO NOTHING', [meId, postId]);
    if (gp.owner_id !== meId) {
      await addNotif(gp.owner_id, 'like', 'Alguém curtiu sua mensagem no grupo.', returnTo);
    }
  }
  res.redirect(returnTo);
});

// ===== DEPOIMENTOS =====
app.get("/testimonials/:username", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const user = await db.get("SELECT id, username, full_name FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).send("Usuário não encontrado.");

  const approved = await db.all(`
    SELECT t.id, t.content, t.created_at, u.username AS from_username
    FROM testimonials t
    JOIN users u ON u.id = t.from_user_id
    WHERE t.to_user_id=? AND t.status='approved'
    ORDER BY t.created_at DESC
  `, [user.id]);

  const pendingMine = (user.id === meId)
    ? await db.all(`
        SELECT t.id, t.content, t.created_at, u.username AS from_username
        FROM testimonials t
        JOIN users u ON u.id = t.from_user_id
        WHERE t.to_user_id=? AND t.status='pending'
        ORDER BY t.created_at DESC
      `, [user.id])
    : [];

  res.render("testimonials", { user, approved, pendingMine });
});

app.post("/testimonials/:username", limiterWrite, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const { content } = req.body;
  const to = await db.get("SELECT id FROM users WHERE username=?", [req.params.username]);
  if (!to) return res.redirect("/home");
  if (!content || !content.trim()) return res.redirect(`/testimonials/${req.params.username}`);

  await db.run("INSERT INTO testimonials (from_user_id, to_user_id, content) VALUES (?,?,?)", [meId, to.id, content.trim()]);

  await addNotif(to.id, "testimonial", "Você recebeu um depoimento para aprovar.", "/testimonials/" + req.params.username);
  res.redirect(`/testimonials/${req.params.username}`);
});

app.post("/testimonials/approve/:id", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const t = await db.get("SELECT * FROM testimonials WHERE id=? AND to_user_id=?", [Number(req.params.id), meId]);
  if (t) {
    await db.run("UPDATE testimonials SET status='approved' WHERE id=?", [t.id]);
    await addNotif(t.from_user_id, "testimonial_approved", "Seu depoimento foi aprovado.", `/u/${(await getUserById(meId)).username}`);
  }
  res.redirect("back");
});

app.post("/testimonials/reject/:id", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  await db.run("UPDATE testimonials SET status='rejected' WHERE id=? AND to_user_id=?", [Number(req.params.id), meId]);
  res.redirect("back");
});

// ===== FOTOS / ÁLBUNS =====
app.get("/photos/:username", requireAuth, async (req, res) => {
  const user = await db.get("SELECT id, username, full_name FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).send("Usuário não encontrado.");

  const albums = await db.all("SELECT * FROM albums WHERE user_id=? ORDER BY created_at DESC", [user.id]);
  const photos = await db.all("SELECT * FROM photos WHERE user_id=? ORDER BY created_at DESC LIMIT 80", [user.id]);

  let error = null;
  if (req.query.err === "limit") error = "Você já atingiu o limite de 6 fotos no álbum.";
  if (req.query.err === "upload") error = "Não consegui enviar sua foto. Tente novamente.";

  res.render("photos", { user, albums, photos, error });
});

app.post("/albums/create", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const title = (req.body.title || "").trim();
  if (!title) return res.redirect(`/photos/${(await getUserById(meId)).username}`);
  await db.run("INSERT INTO albums (user_id, title) VALUES (?,?)", [meId, title]);
  res.redirect(`/photos/${(await getUserById(meId)).username}`);
});

app.post("/photos/upload/:albumId", limiterWrite, requireAuth, upload.single("photo"), async (req, res) => {
  const meId = req.session.userId;
  const albumId = Number(req.params.albumId);

  const me = await getUserById(meId);
  const album = await db.get("SELECT * FROM albums WHERE id=? AND user_id=?", [albumId, meId]);
  if (!album) return res.redirect(`/photos/${me.username}`);

  if (!req.file) return res.redirect(`/photos/${me.username}`);

  // Limite: no máximo 6 fotos por usuário (estilo Orkut)
  const countRow = await db.get("SELECT COUNT(*)::int AS c FROM photos WHERE user_id=?", [meId]);
  const currentCount = (countRow && (countRow.c ?? countRow.count ?? 0)) || 0;
  if (currentCount >= 6) return res.redirect(`/photos/${me.username}?err=limit`);

  if (!assertSupabase(res)) return;

  try {
    const { publicUrl } = await uploadToSupabaseStorage({ userId: meId, kind: "photo", file: req.file });
    const caption = (req.body.caption || "").trim();
    await db.run("INSERT INTO photos (album_id, user_id, filename, caption) VALUES (?,?,?,?)", [albumId, meId, publicUrl, caption || null]);
    res.redirect(`/photos/${me.username}`);
  } catch (e) {
    console.error("[KleinDream] Upload photo error:", e);
    res.redirect(`/photos/${me.username}?err=upload`);
  }
});

// ===== GRUPOS =====
app.get("/groups", requireAuth, async (req, res) => {
  const meId = req.session.userId;

  const groups = await db.all(`
    SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) AS members
    FROM groups g
    ORDER BY g.created_at DESC
    LIMIT 200
  `, []);

  const myGroups = await db.all(`
    SELECT g.*
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id=?
    ORDER BY g.name
  `, [meId]);

  res.render("groups", { groups, myGroups, error: null });
});

app.post("/groups/create", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const name = (req.body.name || "").trim();
  const description = (req.body.description || "").trim();
  const category = (req.body.category || "").trim();

  if (!name) {
    const groups = await db.all("SELECT * FROM groups ORDER BY created_at DESC LIMIT 200", []);
    const myGroups = await db.all(`
      SELECT g.*
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id=?
      ORDER BY g.name
    `, [meId]);
    return res.render("groups", { groups, myGroups, error: "Nome do grupo é obrigatório." });
  }

  const info = await db.run("INSERT INTO groups (owner_id, name, description, category) VALUES (?,?,?,?) RETURNING id", [meId, name, description || null, category || null]);

  const groupId = info.rows[0].id;
  await db.run("INSERT INTO group_members (group_id, user_id, role) VALUES (?,?, 'owner')", [groupId, meId]);

  res.redirect(`/groups/${groupId}`);
});

app.get("/groups/:id", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.id);

  const group = await db.get("SELECT * FROM groups WHERE id=?", [groupId]);
  if (!group) return res.status(404).send("Grupo não encontrado.");

  const membership = await db.get("SELECT * FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);

  const members = await db.all(`
    SELECT u.username, u.full_name, gm.role
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id=?
    ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'mod' THEN 1 ELSE 2 END, u.username
    LIMIT 200
  `, [groupId]);

  const topics = await db.all(`
    SELECT t.*, u.username AS author
    FROM group_topics t
    JOIN users u ON u.id = t.user_id
    WHERE t.group_id=?
    ORDER BY t.created_at DESC
    LIMIT 100
  `, [groupId]);

  res.render("group_view", { group, membership, members, topics });
});

app.post("/groups/:id/join", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.id);
  const group = await db.get("SELECT * FROM groups WHERE id=?", [groupId]);
  if (!group) return res.redirect("/groups");

  await db.run("INSERT INTO group_members (group_id, user_id, role) VALUES (?,?, 'member') ON CONFLICT DO NOTHING", [groupId, meId]);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/leave", limiterActions, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.id);

  const role = await db.get("SELECT role FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);
  if (role && role.role === "owner") return res.redirect(`/groups/${groupId}`);

  await db.run("DELETE FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/topics/create", limiterWrite, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.id);
  const title = (req.body.title || "").trim();
  const content = (req.body.content || "").trim();

  const membership = await db.get("SELECT * FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);
  if (!membership) return res.redirect(`/groups/${groupId}`);

  if (!title || !content) return res.redirect(`/groups/${groupId}`);

  const info = await db.run("INSERT INTO group_topics (group_id, user_id, title) VALUES (?,?,?) RETURNING id", [groupId, meId, title]);
  const topicId = info.rows[0].id;

  await db.run("INSERT INTO group_posts (topic_id, user_id, content) VALUES (?,?,?)", [topicId, meId, content]);
  res.redirect(`/groups/${groupId}/topic/${topicId}`);
});

app.get("/groups/:groupId/topic/:topicId", requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  const topicId = Number(req.params.topicId);
  const meId = req.session.userId;

  const group = await db.get("SELECT * FROM groups WHERE id=?", [groupId]);
  const topic = await db.get(`
    SELECT t.*, u.username AS author
    FROM group_topics t
    JOIN users u ON u.id = t.user_id
    WHERE t.id=? AND t.group_id=?
  `, [topicId, groupId]);

  if (!group || !topic) return res.status(404).send("Tópico não encontrado.");

  const membership = await db.get("SELECT * FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);

  const posts = await db.all(`
    SELECT
      p.*, u.username AS author,
      (SELECT COUNT(*) FROM group_post_likes gpl WHERE gpl.post_id = p.id) AS like_count,
      EXISTS(SELECT 1 FROM group_post_likes gpl WHERE gpl.post_id = p.id AND gpl.user_id = ?) AS liked
    FROM group_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.topic_id=?
    ORDER BY p.created_at ASC
  `, [meId, topicId]);

  res.render("group_topic", { group, topic, posts, membership });
});

app.post("/groups/:groupId/topic/:topicId/reply", limiterWrite, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.groupId);
  const topicId = Number(req.params.topicId);
  const content = (req.body.content || "").trim();

  const membership = await db.get("SELECT * FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);
  if (!membership) return res.redirect(`/groups/${groupId}`);

  if (!content) return res.redirect(`/groups/${groupId}/topic/${topicId}`);

  await db.run("INSERT INTO group_posts (topic_id, user_id, content) VALUES (?,?,?)", [topicId, meId, content]);
  res.redirect(`/groups/${groupId}/topic/${topicId}`);
});

// ===== MENSAGENS =====
app.get("/messages", requireAuth, async (req, res) => {
  const meId = req.session.userId;

  const inbox = await db.all(`
    SELECT m.*, u.username AS from_username
    FROM messages m
    JOIN users u ON u.id = m.from_user_id
    WHERE m.to_user_id=?
    ORDER BY m.created_at DESC
    LIMIT 100
  `, [meId]);

  const outbox = await db.all(`
    SELECT m.*, u.username AS to_username
    FROM messages m
    JOIN users u ON u.id = m.to_user_id
    WHERE m.from_user_id=?
    ORDER BY m.created_at DESC
    LIMIT 100
  `, [meId]);

  res.render("messages", { inbox, outbox, error: null, ok: null });
});

app.post("/messages/send", limiterWrite, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const toUsername = (req.body.to || "").trim();
  const subject = (req.body.subject || "").trim();
  const body = (req.body.body || "").trim();

  const to = await db.get("SELECT id FROM users WHERE username=?", [toUsername]);
  if (!to) {
    return res.render("messages", { inbox: [], outbox: [], error: "Usuário destino não encontrado.", ok: null });
  }
  if (!subject || !body) {
    return res.render("messages", { inbox: [], outbox: [], error: "Assunto e mensagem são obrigatórios.", ok: null });
  }

  await db.run("INSERT INTO messages (from_user_id, to_user_id, subject, body) VALUES (?,?,?,?)", [meId, to.id, subject, body]);

  await addNotif(to.id, "message", "Você recebeu uma mensagem.", "/messages");
  res.redirect("/messages");
});

app.get("/messages/:id", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const id = Number(req.params.id);

  const msg = await db.get(`
    SELECT m.*, u.username AS from_username, u2.username AS to_username
    FROM messages m
    JOIN users u ON u.id = m.from_user_id
    JOIN users u2 ON u2.id = m.to_user_id
    WHERE m.id=? AND (m.to_user_id=? OR m.from_user_id=?)
  `, [id, meId, meId]);

  if (!msg) return res.status(404).send("Mensagem não encontrada.");

  if (msg.to_user_id === meId && msg.is_read === 0) {
    await db.run("UPDATE messages SET is_read=1 WHERE id=?", [id]);
  }

  res.render("message_view", { msg });
});

// ===== BUSCA =====
app.get("/search", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  const type = (req.query.type || "people").trim();

  let people = [];
  let groups = [];

  if (q) {
    if (type === "groups") {
      groups = await db.all(`
        SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) AS members
        FROM groups g
        WHERE g.name LIKE ? OR g.description LIKE ?
        ORDER BY g.name
        LIMIT 100
      `, [`%${q}%`, `%${q}%`]);
    } else {
      people = await db.all(`
        SELECT id, username, full_name, city, state
        FROM users
        WHERE username LIKE ? OR full_name LIKE ? OR city LIKE ?
        ORDER BY username
        LIMIT 100
      `, [`%${q}%`, `%${q}%`, `%${q}%`]);
    }
  }

  res.render("search", { q, type, people, groups });
});


// ===== PRESENÇA + CHAT PRIVADO =====
app.post("/api/presence/ping", requireAuth, async (req, res) => {
  await touchPresence(req.session.userId);
  res.json({ ok: true });
});

app.get("/api/presence/online", requireAuth, async (req, res) => {
  const rows = await getOnlineUsers(30);
  res.json({
    ok: true,
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      profile_photo: photoSrc(u.profile_photo)
    }))
  });
});

app.get("/api/private-chat/conversations", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const rows = await db.all(`
    WITH convo AS (
      SELECT
        CASE WHEN pm.from_user_id = ? THEN pm.to_user_id ELSE pm.from_user_id END AS other_id,
        MAX(pm.created_at) AS last_created_at,
        COUNT(*) FILTER (WHERE pm.to_user_id = ? AND COALESCE(pm.is_read, 0) = 0) AS unread_count
      FROM private_messages pm
      WHERE pm.from_user_id = ? OR pm.to_user_id = ?
      GROUP BY CASE WHEN pm.from_user_id = ? THEN pm.to_user_id ELSE pm.from_user_id END
    )
    SELECT c.other_id, c.last_created_at, c.unread_count,
           u.username, u.full_name, u.profile_photo,
           pm.body AS last_body,
           CASE WHEN p.last_active >= NOW() - INTERVAL '5 minutes' THEN 1 ELSE 0 END AS is_online
    FROM convo c
    JOIN users u ON u.id = c.other_id
    LEFT JOIN presence p ON p.user_id = u.id
    LEFT JOIN private_messages pm
      ON ((pm.from_user_id = ? AND pm.to_user_id = c.other_id) OR (pm.from_user_id = c.other_id AND pm.to_user_id = ?))
     AND pm.created_at = c.last_created_at
    ORDER BY c.last_created_at DESC, u.username ASC
    LIMIT 30
  `, [meId, meId, meId, meId, meId, meId, meId]);

  res.json({
    ok: true,
    conversations: rows.map((r) => ({
      username: r.username,
      full_name: r.full_name,
      profile_photo: photoSrc(r.profile_photo),
      last_body: r.last_body,
      last_created_at: r.last_created_at,
      unread_count: Number(r.unread_count || 0),
      is_online: Number(r.is_online || 0) === 1
    }))
  });
});

app.get("/api/private-chat/messages/:username", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const user = await db.get("SELECT id, username, full_name, profile_photo FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });

  const rows = await db.all(`
    SELECT pm.id, pm.body, pm.created_at, pm.from_user_id, pm.to_user_id,
           uf.username AS from_username
    FROM private_messages pm
    JOIN users uf ON uf.id = pm.from_user_id
    WHERE (pm.from_user_id = ? AND pm.to_user_id = ?)
       OR (pm.from_user_id = ? AND pm.to_user_id = ?)
    ORDER BY pm.created_at DESC, pm.id DESC
    LIMIT 40
  `, [meId, user.id, user.id, meId]);

  await db.run(
    "UPDATE private_messages SET is_read=1 WHERE from_user_id=? AND to_user_id=? AND COALESCE(is_read,0)=0",
    [user.id, meId]
  );

  const onlineRow = await db.get("SELECT CASE WHEN last_active >= NOW() - INTERVAL '5 minutes' THEN 1 ELSE 0 END AS is_online FROM presence WHERE user_id=?", [user.id]);

  res.json({
    ok: true,
    user: {
      username: user.username,
      full_name: user.full_name,
      profile_photo: photoSrc(user.profile_photo),
      is_online: Number(onlineRow?.is_online || 0) === 1
    },
    messages: rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      mine: Number(m.from_user_id) === Number(meId),
      from_username: m.from_username
    }))
  });
});

app.post("/api/private-chat/messages/:username", limiterWrite, requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const body = String(req.body.body || "").trim();
  if (!body) return res.status(400).json({ ok: false, error: "Mensagem vazia." });
  if (body.length > 800) return res.status(400).json({ ok: false, error: "Mensagem longa demais." });

  const user = await db.get("SELECT id, username FROM users WHERE username=?", [req.params.username]);
  if (!user) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
  if (Number(user.id) === Number(meId)) return res.status(400).json({ ok: false, error: "Não dá para conversar consigo mesmo." });

  const result = await db.run(
    "INSERT INTO private_messages (from_user_id, to_user_id, body) VALUES (?,?,?) RETURNING id, body, created_at",
    [meId, user.id, body.slice(0, 800)]
  );

  const me = await getUserById(meId);
  await touchPresence(meId);
  await addNotif(user.id, "private_chat", `${me.username} enviou uma mensagem no chat.`, `/u/${me.username}`);

  res.json({
    ok: true,
    message: {
      id: result.rows[0].id,
      body: result.rows[0].body,
      created_at: result.rows[0].created_at,
      mine: true,
      from_username: me.username
    }
  });
});


// ===== NOTIFICAÇÕES =====
app.get("/notifications", requireAuth, async (req, res) => {
  const meId = req.session.userId;

  const notifs = await db.all(`
    SELECT * FROM notifications
    WHERE user_id=?
    ORDER BY created_at DESC
    LIMIT 200
  `, [meId]);

  res.render("notifications", { notifs });
});

app.post("/notifications/readall", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  await db.run("UPDATE notifications SET is_read=1 WHERE user_id=?", [meId]);
  res.redirect("/notifications");
});


// 404 handler
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Página não encontrada",
    message: "Não achamos essa página.",
    status: 404,
    requestId: req.requestId
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[KleinDream] ERROR", req.requestId, err && err.stack ? err.stack : err);
  const status = err && err.status ? err.status : 500;
  res.status(status).render("error", {
    title: status === 500 ? "Erro interno" : "Ops!",
    message: status === 500
      ? "Aconteceu um erro aqui. Já estamos cuidando disso. 💙"
      : (err.message || "Algo deu errado."),
    status,
    requestId: req.requestId
  });
});


// ===== START =====
async function main() {
  await init();
  await migrate();

  const server = http.createServer(app);

  const io = new Server(server);

  // Compartilhar sessão com Socket.IO
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  const chatHistory = [];
  const CHAT_MAX_HISTORY = 80;

  // Presença (uma sala só)
  // userId -> { username, sockets }
  const online = new Map();

  // Quem está digitando
  // userId -> username
  const typing = new Map();

  // Admin do chat: configure CHAT_ADMIN_USERNAMES="user1,user2"
  const adminUsernames = String(process.env.CHAT_ADMIN_USERNAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function isChatAdmin(sess, username) {
    if (sess && sess.isAdmin === true) return true;
    return adminUsernames.includes(String(username || "").trim());
  }


  function onlineCount() {
    let c = 0;
    for (const v of online.values()) c += v.sockets;
    return c;
  }

  function emitPresence() {
    const users = Array.from(online.values()).map((u) => u.username);
    users.sort((a,b)=> String(a).localeCompare(String(b)));
    io.emit("chat:presence", {
      onlineUsers: onlineCount(),
      users,
    });
  }

  function emitSystem(text) {
    const msg = {
      id: "sys_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      system: true,
      username: "KleinDream",
      text,
      ts: new Date().toISOString(),
    };
    chatHistory.push(msg);
    while (chatHistory.length > CHAT_MAX_HISTORY) chatHistory.shift();
    io.emit("chat:message", msg);
  }

  io.on("connection", (socket) => {
    const sess = socket.request.session;
    if (!sess || !sess.userId) {
      socket.disconnect(true);
      return;
    }

    const userId = sess.userId;
    const username = (sess.username || "membro");
    const chatAdmin = isChatAdmin(sess, username);

    // informa ao cliente
    socket.emit("chat:me", { username, isAdmin: chatAdmin });

    // Presença: contabiliza conexão
    const prev = online.get(userId);
    if (prev) {
      prev.sockets += 1;
    } else {
      online.set(userId, { username, sockets: 1 });
      emitSystem(`${username} entrou no bate-papo.`);
    }
    emitPresence();

    // Anti-spam simples
    let lastMsgAt = 0;

    // Enviar histórico
    socket.emit("history", chatHistory);

    // Digitando...
    socket.on("chat:typing", (payload) => {
      const isTyping = !!(payload && payload.typing);
      if (isTyping) {
        typing.set(userId, username);
      } else {
        typing.delete(userId);
      }
      // Envia para todos (inclui o próprio; o client pode ignorar)
      io.emit("chat:typing", { users: Array.from(new Set(typing.values())).sort((a,b)=>String(a).localeCompare(String(b))) });
    });

    // Limpar chat (somente admin)
    socket.on("chat:clear", () => {
      if (!chatAdmin) return;
      chatHistory.length = 0;
      typing.clear();
      io.emit("chat:cleared");
      io.emit("chat:typing", { users: [] });
      emitSystem(`${username} limpou o bate-papo.`);
    });

    socket.on("chat:message", (payload) => {
      try {
        const now = Date.now();
        if (now - lastMsgAt < 2000) {
          socket.emit("chat:error", { text: "Devagarzinho 😌 espere 2 segundos entre as mensagens." });
          return;
        }

        const text = (payload && payload.text ? String(payload.text) : "").trim();
        if (!text) return;
        if (text.length > 500) return;

        lastMsgAt = now;

        const msg = { id: Date.now() + Math.random().toString(16).slice(2), userId, username, text, ts: new Date().toISOString() };
        chatHistory.push(msg);
        while (chatHistory.length > CHAT_MAX_HISTORY) chatHistory.shift();
        // ao enviar, deixa de "digitando"
        if (typing.has(userId)) {
          typing.delete(userId);
          io.emit("chat:typing", { users: Array.from(new Set(typing.values())).sort((a,b)=>String(a).localeCompare(String(b))) });
        }
        io.emit("chat:message", msg);
      } catch (e) {
        // ignore
      }
    });

    socket.on("disconnect", () => {
      // remove de digitando
      if (typing.has(userId)) {
        typing.delete(userId);
        io.emit("chat:typing", { users: Array.from(new Set(typing.values())).sort((a,b)=>String(a).localeCompare(String(b))) });
      }
      const cur = online.get(userId);
      if (!cur) return;
      cur.sockets -= 1;
      if (cur.sockets <= 0) {
        online.delete(userId);
        emitSystem(`${username} saiu do bate-papo.`);
      }
      emitPresence();
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`KleinDream rodando em http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[KleinDream] Falha ao iniciar:", err);
  process.exit(1);
});