Klein Dream — presença online + chat privado leve

O que foi integrado:
- Quem está online na home
- Status online/offline no perfil
- Chat privado flutuante estilo MSN
- Migration PostgreSQL correta (sem SERIAL/IDENTITY)

Arquivos principais:
- migrations/006_presence_private_chat.sql
- public/presence-chat.js
- public/presence-chat.css
- server.js
- views/home.ejs
- views/profile.ejs
- views/layout.ejs

Como funciona:
- presença atualizada por atividade e ping leve
- usuário considerado online por 5 minutos
- chat privado usa fetch/polling leve para celular
- botão flutuante em todas as páginas logadas
