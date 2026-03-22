(function(){
  if (!window.KD_ME) return;

  const state = {
    open: false,
    selected: null,
    onlineUsers: [],
    conversations: [],
    messages: [],
    unreadTotal: 0,
    currentUser: null,
    timers: { ping: null, roster: null, chat: null },
    refs: {}
  };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function formatTime(v){ try { return new Date(v).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); } catch(e) { return ''; } }
  function shortText(v, n){ const s = String(v || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  async function api(url, opts){
    const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    const data = await res.json().catch(() => ({ ok: false, error: 'Falha ao ler resposta.' }));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Erro de rede.');
    return data;
  }

  function setStatus(text){ if (state.refs.status) state.refs.status.textContent = text || ''; }

  function setComposeEnabled(enabled){
    if (!state.refs.input || !state.refs.send) return;
    state.refs.input.disabled = !enabled;
    state.refs.send.disabled = !enabled;
    state.refs.input.placeholder = enabled ? 'Digite uma mensagem...' : 'Escolha alguém para conversar';
  }

  function build(){
    const root = document.getElementById('kdPresenceChatRoot');
    const fab = document.getElementById('kdChatFab');
    if (!root || !fab) return false;
    root.innerHTML = `
      <section id="kdMiniChat" class="kd-chat-window" hidden>
        <div class="kd-chat-titlebar">
          <div class="kd-chat-titletext"><span>💬</span><span id="kdMiniChatTitle">Gtalk Klein Dream</span></div>
          <div>
            <button type="button" id="kdMiniChatMin" class="kd-chat-iconbtn" aria-label="Minimizar">—</button>
          </div>
        </div>
        <div class="kd-chat-body">
          <div class="kd-chat-tabs">
            <button type="button" class="kd-chat-tab active" data-pane="people">Pessoas</button>
            <button type="button" class="kd-chat-tab" data-pane="chat">Conversa</button>
          </div>
          <section class="kd-chat-pane active" data-pane="people">
            <div class="kd-chat-scroll" id="kdMiniChatPeople"></div>
          </section>
          <section class="kd-chat-pane" data-pane="chat">
            <div class="kd-chat-main-head" id="kdMiniChatHead">
              <div>
                <div class="kd-chat-main-name">Nenhuma conversa aberta</div>
                <div class="kd-chat-main-sub">Escolha alguém na aba Pessoas</div>
              </div>
            </div>
            <div class="kd-chat-messages" id="kdMiniChatMessages">
              <div class="kd-chat-empty">Clique em alguém para abrir uma conversa.</div>
            </div>
            <form id="kdMiniChatForm" class="kd-chat-compose">
              <input id="kdMiniChatInput" class="kd-chat-input" maxlength="800" autocomplete="off" />
              <button id="kdMiniChatSend" class="kd-chat-send" type="submit">Enviar</button>
            </form>
            <div class="kd-chat-status" id="kdMiniChatStatus">Pronto.</div>
          </section>
        </div>
      </section>`;

    state.refs.root = root;
    state.refs.fab = fab;
    state.refs.window = document.getElementById('kdMiniChat');
    state.refs.people = document.getElementById('kdMiniChatPeople');
    state.refs.messages = document.getElementById('kdMiniChatMessages');
    state.refs.head = document.getElementById('kdMiniChatHead');
    state.refs.input = document.getElementById('kdMiniChatInput');
    state.refs.send = document.getElementById('kdMiniChatSend');
    state.refs.form = document.getElementById('kdMiniChatForm');
    state.refs.status = document.getElementById('kdMiniChatStatus');
    state.refs.title = document.getElementById('kdMiniChatTitle');

    fab.addEventListener('click', toggleWindow);
    document.getElementById('kdMiniChatMin').addEventListener('click', closeWindow);
    state.refs.form.addEventListener('submit', onSubmit);
    root.querySelectorAll('.kd-chat-tab').forEach((tab) => tab.addEventListener('click', () => activatePane(tab.getAttribute('data-pane'))));

    document.addEventListener('click', function(e){
      const btn = e.target.closest('.js-open-private-chat');
      if (!btn) return;
      const user = btn.getAttribute('data-chat-user');
      if (!user) return;
      openWindow();
      selectUser(user);
    });

    updateFab();
    setComposeEnabled(false);
    return true;
  }

  function activatePane(name){
    state.refs.root.querySelectorAll('.kd-chat-tab').forEach((tab) => tab.classList.toggle('active', tab.getAttribute('data-pane') === name));
    state.refs.root.querySelectorAll('.kd-chat-pane').forEach((pane) => pane.classList.toggle('active', pane.getAttribute('data-pane') === name));
  }

  function updateFab(){
    if (!state.refs.fab) return;
    const count = state.unreadTotal > 99 ? '99+' : String(state.unreadTotal || 0);
    state.refs.fab.innerHTML = `<span>💬 Gtalk</span><span class="kd-chat-fab-badge">${count}</span>`;
    state.refs.fab.classList.toggle('open', state.open);
    state.refs.fab.setAttribute('aria-expanded', state.open ? 'true' : 'false');
  }

  function openWindow(){
    state.open = true;
    state.refs.window.hidden = false;
    updateFab();
    refreshRoster();
    if (state.selected) refreshMessages();
    restartTimers();
  }

  function closeWindow(){
    state.open = false;
    state.refs.window.hidden = true;
    updateFab();
  }

  function toggleWindow(){ state.open ? closeWindow() : openWindow(); }

  function mergeContacts(){
    const map = new Map();

    (state.onlineUsers || []).forEach((u) => {
      if (!u || u.username === window.KD_ME.username) return;
      map.set(u.username, {
        username: u.username,
        full_name: u.full_name || u.username,
        is_online: true,
        last_body: '',
        unread_count: 0,
        sort_ts: 0
      });
    });

    (state.conversations || []).forEach((c) => {
      if (!c || !c.username || c.username === window.KD_ME.username) return;
      const prev = map.get(c.username) || { username: c.username, full_name: c.full_name || c.username, is_online: false, last_body: '', unread_count: 0, sort_ts: 0 };
      prev.full_name = c.full_name || prev.full_name;
      prev.is_online = !!c.is_online || !!prev.is_online;
      prev.last_body = c.last_body || prev.last_body || '';
      prev.unread_count = Number(c.unread_count || 0);
      prev.sort_ts = c.last_created_at ? Date.parse(c.last_created_at) || 0 : prev.sort_ts || 0;
      map.set(c.username, prev);
    });

    return Array.from(map.values()).sort((a, b) => {
      if ((b.unread_count || 0) !== (a.unread_count || 0)) return (b.unread_count || 0) - (a.unread_count || 0);
      if ((b.sort_ts || 0) !== (a.sort_ts || 0)) return (b.sort_ts || 0) - (a.sort_ts || 0);
      if ((b.is_online?1:0) !== (a.is_online?1:0)) return (b.is_online?1:0) - (a.is_online?1:0);
      return String(a.username).localeCompare(String(b.username), 'pt-BR');
    });
  }

  function renderPeople(){
    const contacts = mergeContacts();
    if (!contacts.length){
      state.refs.people.innerHTML = '<div class="kd-chat-empty">Ninguém online ou com conversa ainda.</div>';
      return;
    }
    state.refs.people.innerHTML = contacts.map((c) => `
      <button type="button" class="kd-chat-contact ${state.selected === c.username ? 'active' : ''}" data-user="${esc(c.username)}">
        <div class="kd-chat-contact-top">
          <span><span class="kd-live-dot ${c.is_online ? 'on' : 'off'}"></span>${esc(shortText(c.full_name || c.username, 24))}</span>
          ${(c.unread_count || 0) ? `<span class="kd-chat-fab-badge">${c.unread_count > 99 ? '99+' : c.unread_count}</span>` : ''}
        </div>
        <div class="kd-chat-contact-user">@${esc(c.username)}</div>
        <div class="kd-chat-contact-last">${esc(shortText(c.last_body || (c.is_online ? 'Online agora' : 'Sem mensagens ainda'), 34))}</div>
      </button>`).join('');
    state.refs.people.querySelectorAll('.kd-chat-contact').forEach((btn) => btn.addEventListener('click', () => selectUser(btn.getAttribute('data-user'))));
  }

  function renderMessages(){
    const user = state.currentUser;
    if (!user){
      state.refs.head.innerHTML = '<div><div class="kd-chat-main-name">Nenhuma conversa aberta</div><div class="kd-chat-main-sub">Escolha alguém na aba Pessoas</div></div>';
      state.refs.messages.innerHTML = '<div class="kd-chat-empty">Clique em alguém para abrir uma conversa.</div>';
      setComposeEnabled(false);
      return;
    }

    state.refs.head.innerHTML = `
      <div>
        <div class="kd-chat-main-name">${esc(user.full_name || user.username)}</div>
        <div class="kd-chat-main-sub"><span class="kd-live-dot ${user.is_online ? 'on' : 'off'}"></span>@${esc(user.username)}</div>
      </div>
      <a class="kd-chat-main-link" href="/u/${encodeURIComponent(user.username)}">Perfil</a>`;

    if (!state.messages.length){
      state.refs.messages.innerHTML = '<div class="kd-chat-empty">Ainda não há mensagens. Escreva a primeira.</div>';
    } else {
      state.refs.messages.innerHTML = state.messages.map((m) => `
        <div class="kd-chat-bubble ${m.mine ? 'mine' : 'theirs'}">
          ${esc(m.body)}
          <div class="kd-chat-bubble-meta">${m.mine ? 'Você' : esc(m.from_username || user.username)} • ${esc(formatTime(m.created_at))}</div>
        </div>`).join('');
      state.refs.messages.scrollTop = state.refs.messages.scrollHeight;
    }

    setComposeEnabled(true);
  }

  async function ping(){ try { await api('/api/presence/ping', { method: 'POST' }); } catch(e) {} }

  async function refreshRoster(){
    try {
      const [online, convos] = await Promise.all([
        api('/api/presence/online'),
        api('/api/private-chat/conversations')
      ]);
      state.onlineUsers = online.users || [];
      state.conversations = convos.conversations || [];
      state.unreadTotal = state.conversations.reduce((acc, item) => acc + Number(item.unread_count || 0), 0);
      updateFab();
      renderPeople();
    } catch(err) {
      setStatus(err.message || 'Não foi possível atualizar a lista.');
    }
  }

  async function refreshMessages(){
    if (!state.selected) return;
    try {
      const data = await api('/api/private-chat/messages/' + encodeURIComponent(state.selected));
      state.currentUser = data.user || { username: state.selected, full_name: state.selected, is_online: false };
      state.messages = data.messages || [];
      renderMessages();
      await refreshRoster();
      setStatus('Conversa atualizada.');
    } catch(err) {
      setStatus(err.message || 'Não foi possível abrir a conversa.');
      state.messages = [];
      renderMessages();
    }
  }

  async function selectUser(username){
    if (!username) return;
    state.selected = username;
    activatePane('chat');
    renderPeople();
    setStatus('Abrindo conversa...');
    await refreshMessages();
    if (state.refs.input && !state.refs.input.disabled) state.refs.input.focus();
  }

  async function onSubmit(e){
    e.preventDefault();
    if (!state.selected){
      setStatus('Escolha alguém antes de enviar.');
      return;
    }
    const body = String(state.refs.input.value || '').trim();
    if (!body){
      setStatus('Digite uma mensagem.');
      return;
    }
    state.refs.send.disabled = true;
    try {
      await api('/api/private-chat/messages/' + encodeURIComponent(state.selected), { method: 'POST', body: JSON.stringify({ body }) });
      state.refs.input.value = '';
      await refreshMessages();
      setStatus('Mensagem enviada.');
    } catch(err) {
      setStatus(err.message || 'Não foi possível enviar.');
    } finally {
      state.refs.send.disabled = false;
      setComposeEnabled(!!state.selected);
    }
  }

  function restartTimers(){
    clearInterval(state.timers.ping);
    clearInterval(state.timers.roster);
    clearInterval(state.timers.chat);
    state.timers.ping = setInterval(ping, 60 * 1000);
    state.timers.roster = setInterval(refreshRoster, 15 * 1000);
    state.timers.chat = setInterval(() => { if (state.open && state.selected) refreshMessages(); }, 4 * 1000);
  }

  if (!build()) return;
  ping();
  refreshRoster();
  restartTimers();
})();
