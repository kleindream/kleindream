// Cole perto das constantes/helpers do server.js:
const MAX_PAINT_DRAWINGS_PER_USER = 3;
const MAX_PAINT_IMAGE_DATA_LENGTH = 2_500_000;

function isValidPaintDataUrl(value) {
  const v = String(value || "").trim();
  return /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/i.test(v) && v.length <= MAX_PAINT_IMAGE_DATA_LENGTH;
}

// Cole junto das rotas logadas:
app.get("/paint", requireAuth, async (req, res) => {
  const drawings = await db.all(`
    SELECT id, title, image_data, created_at
    FROM paint_drawings
    WHERE user_id=?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `, [req.session.userId, MAX_PAINT_DRAWINGS_PER_USER]);

  for (const drawing of drawings) drawing.created_at = formatDateBR(drawing.created_at);

  res.render("paint", {
    drawings,
    maxDrawings: MAX_PAINT_DRAWINGS_PER_USER
  });
});

app.post("/paint/save", requireAuth, limiterWrite, async (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 60) || "Desenho sem título";
  const imageData = String(req.body.imageData || req.body.image_data || "").trim();

  if (!isValidPaintDataUrl(imageData)) {
    req.flash("error", "Não consegui salvar esse desenho. Tente novamente.");
    return res.redirect("/paint");
  }

  const countRow = await db.get(`SELECT COUNT(*)::int AS total FROM paint_drawings WHERE user_id=?`, [req.session.userId]);
  const total = Number(countRow?.total || 0);

  if (total >= MAX_PAINT_DRAWINGS_PER_USER) {
    req.flash("error", `Cada perfil pode ter até ${MAX_PAINT_DRAWINGS_PER_USER} desenhos salvos. Apague um para criar outro.`);
    return res.redirect("/paint");
  }

  await db.run(`
    INSERT INTO paint_drawings (user_id, title, image_data)
    VALUES (?, ?, ?)
  `, [req.session.userId, title, imageData]);

  req.flash("success", "Desenho salvo no seu perfil 💙");
  return res.redirect("/paint");
});

app.post("/paint/:id/delete", requireAuth, limiterWrite, async (req, res) => {
  await db.run("DELETE FROM paint_drawings WHERE id=? AND user_id=?", [req.params.id, req.session.userId]);
  req.flash("success", "Desenho apagado.");
  return res.redirect("/paint");
});
