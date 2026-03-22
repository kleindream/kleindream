(function(){
  if (!window.KD_ME) return;
  const state = { rosterOpen:false, online:[], windows:new Map(), socket:null, socketReady:false, queuedOpen:null };

  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function el(tag, attrs, html){ const n=document.createElement(tag); if(attrs) Object.entries(attrs).forEach(([k,v])=>{ if(k==='class') n.className=v; else if(k==='dataset') Object.entries(v||{}).forEach(([a,b])=>n.dataset[a]=b); else n.setAttribute(k,v);}); if(html!=null) n.innerHTML=html; return n; }
  function toast(msg){ if(window.kdToast) window.kdToast(msg,'info'); else alert(msg); }
  function timeNow(){ try{return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';} }
  function api(url, opts){ return fetch(url, Object.assign({headers:{'Content-Type':'application/json'}}, opts||{})).then(r=>r.json().catch(()=>({ok:false}))); }

  const dock = el('div',{class:'kd-gtalk-dock',id:'kdGtalkDock'});
  const fab = el('button',{class:'kd-gtalk-fab',id:'kdGtalkFab',type:'button','aria-label':'Abrir Gtalk'},'Gtalk');
  document.body.appendChild(dock); document.body.appendChild(fab);

  function render(){
    dock.innerHTML='';
    if(state.rosterOpen) dock.appendChild(renderRoster());
    Array.from(state.windows.values()).slice(-2).forEach(w=>dock.appendChild(renderWindow(w)));
  }

  function renderRoster(){
    const box = el('div',{class:'kd-gtalk-roster'});
    box.appendChild(el('div',{class:'kd-gtalk-head'},'<span>Gtalk \u2022 online</span><button type="button" data-act="close-roster">−</button>'));
    const body = el('div',{class:'kd-gtalk-roster-body'});
    const users = (state.online||[]).filter(u=>u.username!==window.KD_ME.username).slice(0,30);
    if(!users.length){ body.appendChild(el('div',{class:'kd-gtalk-empty'},'Ninguém online agora.')); }
    users.forEach(u=>{
      const name = esc(u.full_name || u.username);
      const btn = el('button',{class:'kd-gtalk-list-btn',type:'button',dataset:{username:u.username}},`<span class="kd-gtalk-dot"></span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>`);
      btn.addEventListener('click',()=>openChat(u.username));
      body.appendChild(btn);
    });
    box.appendChild(body);
    box.querySelector('[data-act="close-roster"]').addEventListener('click',()=>{state.rosterOpen=false;render();});
    return box;
  }

  function renderWindow(w){
    const userLabel = esc(w.full_name || w.username);
    const wrap = el('div',{class:'kd-gtalk-window'});
    wrap.appendChild(el('div',{class:'kd-gtalk-head'},`<span title="@${esc(w.username)}">${userLabel}</span><span><button type="button" data-act="min">−</button><button type="button" data-act="close">×</button></span>`));
    if(w.minimized){
      wrap.querySelector('[data-act="min"]').addEventListener('click',()=>{w.minimized=false;render();});
      wrap.querySelector('[data-act="close"]').addEventListener('click',()=>{state.windows.delete(w.username);render();});
      return wrap;
    }
    const log = el('div',{class:'kd-gtalk-log'});
    (w.messages||[]).forEach(m=>{
      const row = el('div',{class:'kd-gtalk-msg'+(m.mine?' mine':'')},`<div class="kd-gtalk-meta">${m.mine?'Você':userLabel} • ${esc(m.at||'')}</div><div class="kd-gtalk-bubble">${esc(m.text)}</div>`);
      log.appendChild(row);
    });
    setTimeout(()=>{log.scrollTop=log.scrollHeight;},0);
    wrap.appendChild(log);
    if(!w.online) wrap.appendChild(el('div',{class:'kd-gtalk-note'},'Usuário offline. Neste modo leve, só conversa com quem estiver online.'));
    const form = el('form',{class:'kd-gtalk-form'});
    const input = el('input',{type:'text',maxlength:'400',placeholder:w.online?'Escreva uma mensagem...':'Offline',autocomplete:'off'});
    if(!w.online) input.disabled=true;
    const send = el('button',{type:'submit'},'Enviar');
    if(!w.online) send.disabled=true;
    form.appendChild(input); form.appendChild(send);
    form.addEventListener('submit',function(e){
      e.preventDefault();
      const text=(input.value||'').trim();
      if(!text) return;
      sendMessage(w.username,text);
      input.value='';
      input.focus();
    });
    wrap.appendChild(form);
    wrap.querySelector('[data-act="min"]').addEventListener('click',()=>{w.minimized=true;render();});
    wrap.querySelector('[data-act="close"]').addEventListener('click',()=>{state.windows.delete(w.username);render();});
    return wrap;
  }

  function ensureSocket(){
    if(state.socket) return;
    state.socket = io();
    state.socket.on('connect',()=>{ state.socketReady=true; if(state.queuedOpen){ const u=state.queuedOpen; state.queuedOpen=null; openChat(u); } });
    state.socket.on('disconnect',()=>{ state.socketReady=false; });
    state.socket.on('gtalk:presence', payload=>{
      const list = Array.isArray(payload&&payload.users)?payload.users:[];
      state.online = list;
      state.windows.forEach(w=>{ w.online = !!list.find(u=>u.username===w.username); });
      render();
    });
    state.socket.on('gtalk:dm', payload=>{
      if(!payload || !payload.from) return;
      const username = payload.from.username;
      const w = ensureWindow(payload.from);
      w.messages.push({mine:false,text:String(payload.text||''),at:payload.at||timeNow()});
      w.online = true;
      w.minimized = false;
      render();
      toast('Nova mensagem de ' + (payload.from.full_name || username));
    });
    state.socket.on('gtalk:error', payload=> toast((payload&&payload.error)||'Não foi possível enviar.'));
  }

  function ensureWindow(user){
    const username = user.username;
    let w = state.windows.get(username);
    if(!w){
      w = { username, full_name:user.full_name||username, online:user.online!==false, minimized:false, messages:[{mine:false,text:'Conversa temporária iniciada.',at:timeNow()}] };
      state.windows.set(username,w);
    }
    return w;
  }

  function openChat(username){
    ensureSocket();
    if(!state.socketReady && !state.online.length){ state.queuedOpen=username; }
    const user = (state.online||[]).find(u=>u.username===username) || {username, full_name:username, online:false};
    const w = ensureWindow(user);
    w.online = user.online !== false;
    w.minimized = false;
    render();
  }

  function sendMessage(username, text){
    ensureSocket();
    const w = ensureWindow((state.online||[]).find(u=>u.username===username) || {username, full_name:username, online:false});
    if(!w.online){ toast('Essa conversa leve só funciona com usuário online.'); return; }
    w.messages.push({mine:true,text,at:timeNow()});
    render();
    state.socket.emit('gtalk:dm', { to: username, text });
  }

  async function refreshOnline(){
    try{
      await api('/api/presence/ping',{method:'POST'});
      const data = await api('/api/presence/online');
      const users = Array.isArray(data&&data.users)?data.users:[];
      state.online = users.map(u=>Object.assign({},u,{online:true}));
      state.windows.forEach(w=>{ w.online = !!state.online.find(u=>u.username===w.username); });
      render();
    }catch(e){}
  }

  fab.addEventListener('click',()=>{ state.rosterOpen=!state.rosterOpen; render(); });
  document.addEventListener('click',function(e){
    const btn = e.target.closest('.js-open-private-chat');
    if(!btn) return;
    e.preventDefault();
    const username = btn.getAttribute('data-chat-user');
    if(!username){ toast('Escolha alguém para conversar.'); return; }
    openChat(username);
  });

  window.openMiniChat = openChat;
  ensureSocket();
  refreshOnline();
  setInterval(refreshOnline,30000);
})();
