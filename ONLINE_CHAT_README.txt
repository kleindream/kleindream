
Para ativar:

1. Execute a migration 006_presence_chat.sql

2. No server.js adicione:

app.post('/api/presence/ping', (req,res)=>{
  if(!req.session.user) return res.sendStatus(401);
  db.prepare('INSERT OR REPLACE INTO presence (user_id,last_active) VALUES (?,?)')
    .run(req.session.user.id, Date.now());
  res.sendStatus(200);
});

app.get('/api/presence/online',(req,res)=>{
  const limit = Date.now() - (5*60*1000);
  const rows = db.prepare(`
    SELECT users.username FROM presence
    JOIN users ON users.id = presence.user_id
    WHERE last_active > ?
  `).all(limit);
  res.json(rows);
});

3. Inclua no layout principal:
   <%- include('online_widget') %>

Isso cria o sistema leve de:
• Quem está online
