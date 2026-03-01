const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const { db, init, pool } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "kleindream_dev_secret",
    resave: false,
    saveUninitialized: false
  })
);

// Helpers
async function getUserById(id) {
  return await db.get("SELECT id, email, username, full_name, bio, city, state, profile_photo, birth_date, marital_status, favorite_team, profession, hobbies, favorite_music, favorite_movie, favorite_game, personality, looking_for, mood, daily_phrase, created_at FROM users WHERE id=?", [id]);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

async function addNotif(userId, type, text, link = null) {
  await db.run("INSERT INTO notifications (user_id, type, text, link) VALUES (?,?,?,?)", [userId, type, text, link]);
}

app.use(async (req, res, next) => {
  try {
  res.locals.me = req.session.userId ? await getUserById(req.session.userId) : null;
  if (req.session.userId) {
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
app.get("/", async (req, res) => res.render("index"));

app.get("/register", async (req, res) => res.render("register", { error: null }));
app.post("/register", async (req, res) => {
  const { email, username, password, full_name } = req.body;

  if (!email || !username || !password) return res.render("register", { error: "Preencha e-mail, usuário e senha." });
  if (password.length < 4) return res.render("register", { error: "Senha muito curta (mínimo 4)." });

  const exists = await db.get("SELECT 1 FROM users WHERE email=? OR username=?", [email, username]);
  if (exists) return res.render("register", { error: "E-mail ou usuário já existe." });

  const hash = bcrypt.hashSync(password, 10);
  const info = await db.run("INSERT INTO users (email, username, password_hash, full_name) VALUES (?,?,?,?) RETURNING id", [email, username, hash, full_name || null]);

  req.session.userId = info.rows[0].id;
  res.redirect("/home");
});

app.get("/login", async (req, res) => res.render("login", { error: null }));
app.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE email=? OR username=?", [usernameOrEmail, usernameOrEmail]);
  if (!user) return res.render("login", { error: "Usuário não encontrado." });

  const ok = bcrypt.compareSync(password || "", user.password_hash);
  if (!ok) return res.render("login", { error: "Senha incorreta." });

  req.session.userId = user.id;
  res.redirect("/home");
});

app.post("/logout", async (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ===== HOME =====
app.get("/home", requireAuth, async (req, res) => {
  const meId = req.session.userId;

  const incomingRequests = await db.all(`
    SELECT fr.id, u.id AS user_id, u.username, u.full_name
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id=? AND fr.status='pending'
    ORDER BY fr.created_at DESC
  `, [meId]);

  const pendingTestimonials = await db.all(`
    SELECT t.id, u.id AS user_id, u.username, u.full_name, t.created_at
    FROM testimonials t
    JOIN users u ON u.id = t.from_user_id
    WHERE t.to_user_id=? AND t.status='pending'
    ORDER BY t.created_at DESC
  `, [meId]);

  const unreadMessages = await db.all(`
    SELECT m.id, u.username AS from_username, m.subject, m.created_at
    FROM messages m
    JOIN users u ON u.id = m.from_user_id
    WHERE m.to_user_id=? AND m.is_read=0
    ORDER BY m.created_at DESC
    LIMIT 10
  `, [meId]);

  const latestScraps = await db.all(`
    SELECT s.id, s.content, s.created_at, u.username AS from_username, u.id AS from_id
    FROM scraps s
    JOIN users u ON u.id = s.from_user_id
    WHERE s.to_user_id=?
    ORDER BY s.created_at DESC
    LIMIT 10
  `, [meId]);

  res.render("home", { incomingRequests, pendingTestimonials, unreadMessages, latestScraps });
});

// ===== PERFIL =====
app.get("/u/:username", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const user = await db.get("SELECT id, username, full_name, bio, city, state, profile_photo, birth_date, marital_status, favorite_team, profession, hobbies, favorite_music, favorite_movie, favorite_game, personality, looking_for, mood, daily_phrase, invisible_visits, notify_profile_visits, created_at FROM users WHERE username=?", [req.params.username]);
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

  const friendsCount = await db.get("SELECT COUNT(*) AS c FROM friendships WHERE user_id=?", [user.id]).c;

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

  res.render("profile", {
    user, isMe,
    friend: !!friend, reqOut, reqIn,
    scraps, testimonials, friendsCount,
    totalVisits, visitors, canSeeVisitors
  });
});

app.get("/profile/edit", requireAuth, async (req, res) => {
  const me = await getUserById(req.session.userId);
  res.render("profile_edit", { me, error: null, ok: null });
});

app.post("/profile/edit", requireAuth, upload.single("profile_photo"), async (req, res) => {
  const meId = req.session.userId;
  const {
    full_name, bio, city, state,
    birth_date, marital_status, favorite_team, profession,
    hobbies, favorite_music, favorite_movie, favorite_game,
    personality, looking_for, mood, daily_phrase,
    invisible_visits, notify_profile_visits
  } = req.body;

  await db.run(`UPDATE users SET
      full_name=?, bio=?, city=?, state=?,
      birth_date=?, marital_status=?, favorite_team=?, profession=?,
      hobbies=?, favorite_music=?, favorite_movie=?, favorite_game=?,
      personality=?, looking_for=?, mood=?, daily_phrase=?,
      invisible_visits=?, notify_profile_visits=?
    WHERE id=?`, [full_name || null, bio || null, city || null, state || null,
      birth_date || null, marital_status || null, favorite_team || null, profession || null,
      hobbies || null, favorite_music || null, favorite_movie || null, favorite_game || null,
      personality || null, looking_for || null, mood || null, daily_phrase || null,
      (invisible_visits ? 1 : 0), (notify_profile_visits ? 1 : 0),
      meId]);


  // Se enviou foto, salva no Supabase Storage e atualiza profile_photo (URL pública)
  if (req.file) {
    if (!assertSupabase(res)) return;
    try {
      const { publicUrl } = await uploadToSupabaseStorage({ userId: meId, kind: "profile", file: req.file });
      await db.run("UPDATE users SET profile_photo=? WHERE id=?", [publicUrl, meId]);
    } catch (e) {
      console.error("[KleinDream] Upload profile photo error:", e);
      return res.render("profile_edit", { me: await getUserById(meId), error: "Falha ao enviar a foto. Tente outra imagem.", ok: null });
    }
  }

    res.render("profile_edit", { me: await getUserById(meId), error: null, ok: "Perfil atualizado." });
});
// ===== VISITANTES (Histórico) =====
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
app.get("/friends", requireAuth, async (req, res) => {
  const meId = req.session.userId;

  const friends = await db.all(`
    SELECT u.id, u.username, u.full_name
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id=?
    ORDER BY u.username
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

  res.render("friends", { friends, incomingRequests, outgoingRequests });
});

app.post("/friends/request/:userId", requireAuth, async (req, res) => {
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

app.post("/friends/accept/:requestId", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const reqId = Number(req.params.requestId);

  const fr = await db.get("SELECT * FROM friend_requests WHERE id=? AND to_user_id=?", [reqId, meId]);
  if (!fr) return res.redirect("/friends");

  await db.run("UPDATE friend_requests SET status='accepted' WHERE id=?", [reqId]);

  await db.run("INSERT INTO friendships (user_id, friend_id) VALUES (?,?) ON CONFLICT DO NOTHING", [fr.from_user_id, fr.to_user_id]);
  await db.run("INSERT INTO friendships (user_id, friend_id) VALUES (?,?) ON CONFLICT DO NOTHING", [fr.to_user_id, fr.from_user_id]);

  await addNotif(fr.from_user_id, "friend_accept", "Seu pedido de amizade foi aceito.", `/u/${(await getUserById(meId)).username}`);
  res.redirect("/friends");
});

app.post("/friends/reject/:requestId", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const reqId = Number(req.params.requestId);
  await db.run("UPDATE friend_requests SET status='rejected' WHERE id=? AND to_user_id=?", [reqId, meId]);
  res.redirect("/friends");
});

app.post("/friends/remove/:userId", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const otherId = Number(req.params.userId);
  await db.run("DELETE FROM friendships WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)", [meId, otherId, otherId, meId]);
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

app.post("/scraps/:username", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const { content } = req.body;
  const to = await db.get("SELECT id FROM users WHERE username=?", [req.params.username]);
  if (!to) return res.redirect("/home");
  if (!content || !content.trim()) return res.redirect(`/scraps/${req.params.username}`);

  await db.run("INSERT INTO scraps (from_user_id, to_user_id, content) VALUES (?,?,?)", [meId, to.id, content.trim()]);
  await addNotif(to.id, "scrap", "Você recebeu um recado.", `/scraps/${req.params.username}`);
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

app.post("/testimonials/:username", requireAuth, async (req, res) => {
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

app.post("/albums/create", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const title = (req.body.title || "").trim();
  if (!title) return res.redirect(`/photos/${(await getUserById(meId)).username}`);
  await db.run("INSERT INTO albums (user_id, title) VALUES (?,?)", [meId, title]);
  res.redirect(`/photos/${(await getUserById(meId)).username}`);
});

app.post("/photos/upload/:albumId", requireAuth, upload.single("photo"), async (req, res) => {
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

app.post("/groups/create", requireAuth, async (req, res) => {
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

app.post("/groups/:id/join", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.id);
  const group = await db.get("SELECT * FROM groups WHERE id=?", [groupId]);
  if (!group) return res.redirect("/groups");

  await db.run("INSERT INTO group_members (group_id, user_id, role) VALUES (?,?, 'member') ON CONFLICT DO NOTHING", [groupId, meId]);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/leave", requireAuth, async (req, res) => {
  const meId = req.session.userId;
  const groupId = Number(req.params.id);

  const role = await db.get("SELECT role FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);
  if (role && role.role === "owner") return res.redirect(`/groups/${groupId}`);

  await db.run("DELETE FROM group_members WHERE group_id=? AND user_id=?", [groupId, meId]);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/topics/create", requireAuth, async (req, res) => {
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

app.post("/groups/:groupId/topic/:topicId/reply", requireAuth, async (req, res) => {
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

app.post("/messages/send", requireAuth, async (req, res) => {
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

// ===== START =====
async function main() {
  await init();

  app.listen(PORT, () => {
    console.log(`KleinDream rodando em http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[KleinDream] Falha ao iniciar:", err);
  process.exit(1);
});