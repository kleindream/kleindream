
(function(){
  if (!window.KD_ME) return;

  const state = {
    open: false,
    minimized: true,
    selected: null,
    pollListTimer: null,
    pollChatTimer: null,
    pingTimer: null,
    onlineTimer: null,
    panel: null,
    root: null,
    fab: null,
    contacts: [],
    onlineUsers: [],
    messages: []
  };

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function timeLabel(v){
    try { return new Date(v).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); } catch(e){ return ''; }
  }

  function bindHeadButtons(){
    const minBtn = document.querySelector('.kd-chat-minimize');
    const closeBtn = document.querySelector('.kd-chat-close');
    if (minBtn) minBtn.onclick = minimizePanel;
    if (closeBtn) closeBtn.onclick = closePanel;
  }

  function renderIdleHead(){
    const head = document.getElementById('kdChatMainHead');
    if (!head) return;
    head.innerHTML = `<div><strong>Chat</strong><div class="small">leve e rápido</div></div>
      <div class="kd-chat-head-actions">
        <button type="button" class="kd-chat-minimize" aria-label="Minimizar">—</button>
        <button type="button" class="kd-chat-close" aria-label="Fechar">×</button>
      </div>`;
    bindHeadButtons();
  }

  function createUI(){
    state.root = document.getElementById('kdPresenceChatRoot');
    state.fab = document.getElementById('kdChatFab');
    if (!state.root || !state.fab) return;

    state.root.innerHTML = `
      <div class="kd-chat-panel kd-chat-minimized" id="kdChatPanel" hidden>
        <div class="kd-chat-main">
          <div class="kd-chat-main-head kd-chat-compact-head" id="kdChatMainHead">
            <div><strong>Chat</strong><div class="small">leve e rápido</div></div>
            <div class="kd-chat-head-actions">
              <button type="button" class="kd-chat-minimize" aria-label="Minimizar">—</button>
              <button type="button" class="kd-chat-close" aria-label="Fechar">×</button>
            </div>
          </div>
          <div class="kd-chat-mini-prompt" id="kdChatMiniPrompt">Escolha alguém para conversar.</div>
          <div class="kd-chat-sidebar">
            <div class="kd-chat-block">
              <div class="kd-chat-block-title">Conversas</div>
              <div class="kd-chat-list" id="kdChatConversations"></div>
            </div>
            <div class="kd-chat-block">
              <div class="kd-chat-block-title">Online agora</div>
              <div class="kd-chat-list" id="kdOnlineUsers"></div>
            </div>
          </div>
          <div class="kd-chat-messages" id="kdChatMessages">
            <div class="kd-chat-empty">Abra uma conversa pelo perfil de alguém ou por esta lista.</div>
          </div>
          <form class="kd-chat-compose" id="kdChatCompose">
            <input type="text" id="kdChatInput" maxlength="800" placeholder="Digite uma mensagem..." autocomplete="off" />
            <button type="submit" class="btn">Enviar</button>
          </form>
        </div>
      </div>
      `;
    state.panel = document.getElementById('kdChatPanel');
    state.fab.addEventListener('click', togglePanel);
    bindHeadButtons();
    state.panel.querySelector('#kdChatCompose').addEventListener('submit', sendMessage);

    document.addEventListener('click', function(e){
      const btn = e.target.closest('.js-open-private-chat');
      if (!btn) return;
      const u = btn.getAttribute('data-chat-user');
      if (!u) return;
      openPanel();
      selectUser(u);
    });
  }

  async function api(url, opts){
    const res = await fetch(url, Object.assign({headers: {'Content-Type':'application/json'}}, opts || {}));
    const data = await res.json().catch(()=>({ok:false,error:'Falha ao ler resposta.'}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Erro de rede.');
    return data;
  }

  async function pingPresence(){
    try { await api('/api/presence/ping', {method:'POST'}); } catch(e) {}
  }

  async function loadOnline(){
    try {
      const data = await api('/api/presence/online');
      state.onlineUsers = data.users || [];
      renderOnline();
    } catch(e) {}
  }

  async function loadConversations(){
    try {
      const data = await api('/api/private-chat/conversations');
      state.contacts = data.conversations || [];
      renderConversations();
    } catch(e) {}
  }

  async function loadMessages(){
    if (!state.selected) return;
    try {
      const data = await api('/api/private-chat/messages/' + encodeURIComponent(state.selected));
      state.messages = data.messages || [];
      renderMessages(data.user);
      loadConversations();
      loadOnline();
    } catch(e) {
      renderError(e.message || 'Não foi possível abrir a conversa.');
    }
  }

  function renderConversations(){
    const el = document.getElementById('kdChatConversations');
    if (!el) return;
    if (!state.contacts.length) {
      el.innerHTML = '<div class="kd-chat-empty small">Ainda não há conversas.</div>';
      return;
    }
    el.innerHTML = state.contacts.map(c => `
      <button type="button" class="kd-chat-contact ${state.selected === c.username ? 'active' : ''}" data-user="${esc(c.username)}">
        <div class="kd-chat-contact-top">
          <span><span class="kd-live-dot ${c.is_online ? 'on' : 'off'}"></span> ${esc(c.full_name || c.username)}</span>
          ${c.unread_count ? `<span class="badge pulse">${c.unread_count}</span>` : ''}
        </div>
        <div class="kd-chat-contact-sub">@${esc(c.username)}</div>
        ${c.last_body ? `<div class="kd-chat-contact-last">${esc(c.last_body).slice(0,70)}</div>` : ''}
      </button>
    `).join('');
    el.querySelectorAll('.kd-chat-contact').forEach(btn => btn.addEventListener('click', ()=> selectUser(btn.getAttribute('data-user'))));
  }

  function renderOnline(){
    const el = document.getElementById('kdOnlineUsers');
    if (!el) return;
    const users = (state.onlineUsers || []).filter(u => u.username !== window.KD_ME.username).slice(0, 20);
    if (!users.length) {
      el.innerHTML = '<div class="kd-chat-empty small">Só você por aqui agora.</div>';
      return;
    }
    el.innerHTML = users.map(u => `
      <button type="button" class="kd-chat-contact ${state.selected === u.username ? 'active' : ''}" data-user="${esc(u.username)}">
        <div class="kd-chat-contact-top"><span><span class="kd-live-dot on"></span> ${esc(u.full_name || u.username)}</span></div>
        <div class="kd-chat-contact-sub">@${esc(u.username)}</div>
      </button>
    `).join('');
    el.querySelectorAll('.kd-chat-contact').forEach(btn => btn.addEventListener('click', ()=> selectUser(btn.getAttribute('data-user'))));
  }

  function renderMessages(user){
    const head = document.getElementById('kdChatMainHead');
    const box = document.getElementById('kdChatMessages');
    if (!head || !box) return;
    head.innerHTML = `<div><strong>${esc(user.full_name || user.username)}</strong><div class="small"><span class="kd-live-dot ${user.is_online ? 'on' : 'off'}"></span> @${esc(user.username)}</div></div>
      <div class="kd-chat-head-actions">
        <a class="btn secondary mini" href="/u/${encodeURIComponent(user.username)}">Ver perfil</a>
        <button type="button" class="kd-chat-minimize" aria-label="Minimizar">—</button>
        <button type="button" class="kd-chat-close" aria-label="Fechar">×</button>
      </div>`;
    bindHeadButtons();
    if (!state.messages.length) {
      box.innerHTML = '<div class="kd-chat-empty">Ainda não há mensagens. Escreva a primeira. 💙</div>';
      return;
    }
    box.innerHTML = state.messages.map(m => `
      <div class="kd-chat-bubble ${m.mine ? 'mine' : 'theirs'}">
        <div class="kd-chat-bubble-body">${esc(m.body)}</div>
        <div class="kd-chat-bubble-meta">${m.mine ? 'Você' : esc(m.from_username)} • ${timeLabel(m.created_at)}</div>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  }

  function renderError(msg){
    const box = document.getElementById('kdChatMessages');
    if (box) box.innerHTML = `<div class="kd-chat-empty">${esc(msg)}</div>`;
  }

  function openPanel(){
    state.open = true;
    state.minimized = false;
    state.panel.hidden = false;
    state.panel.classList.remove('kd-chat-minimized');
    state.fab.classList.add('open');
    loadConversations();
    loadOnline();
    if (state.selected) loadMessages();
    restartPolling();
  }

  function minimizePanel(){
    state.open = false;
    state.minimized = true;
    state.panel.classList.add('kd-chat-minimized');
    state.panel.hidden = true;
    state.fab.classList.remove('open');
    stopChatPolling();
  }

  function closePanel(){
    state.selected = null;
    minimizePanel();
    const box = document.getElementById('kdChatMessages');
    const head = document.getElementById('kdChatMainHead');
    if (head) head.innerHTML = `<div><strong>Chat</strong><div class="small">leve e rápido</div></div><div class="kd-chat-head-actions"><button type="button" class="kd-chat-minimize" aria-label="Minimizar">—</button><button type="button" class="kd-chat-close" aria-label="Fechar">×</button></div>`;
    if (box) box.innerHTML = '<div class="kd-chat-empty">Abra uma conversa pelo perfil de alguém ou por esta lista.</div>';
    bindHeadButtons();
  }

  function togglePanel(){
    (state.open && !state.minimized) ? minimizePanel() : openPanel();
  }

  function stopChatPolling(){
    if (state.pollListTimer) clearInterval(state.pollListTimer);
    if (state.pollChatTimer) clearInterval(state.pollChatTimer);
    state.pollListTimer = null;
    state.pollChatTimer = null;
  }

  function restartPolling(){
    stopChatPolling();
    state.pollListTimer = setInterval(()=>{ if (state.open) { loadConversations(); loadOnline(); } }, 10000);
    state.pollChatTimer = setInterval(()=>{ if (state.open && state.selected) loadMessages(); }, 4000);
  }

  async function selectUser(username){
    state.selected = username;
    renderConversations();
    renderOnline();
    await loadMessages();
    const input = document.getElementById('kdChatInput');
    if (input) input.focus();
  }

  async function sendMessage(e){
    e.preventDefault();
    if (!state.selected) {
      alert('Escolha alguém primeiro. 💙');
      return;
    }
    const input = document.getElementById('kdChatInput');
    const body = (input.value || '').trim();
    if (!body) return;
    input.value = '';
    try {
      await api('/api/private-chat/messages/' + encodeURIComponent(state.selected), {method:'POST', body: JSON.stringify({body})});
      await loadMessages();
    } catch(err) {
      alert(err.message || 'Não foi possível enviar a mensagem.');
    }
  }

  createUI();
  pingPresence();
  loadOnline();
  loadConversations();
  state.pingTimer = setInterval(pingPresence, 60000);
  state.onlineTimer = setInterval(loadOnline, 30000);
})();
