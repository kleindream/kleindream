(() => {
  const icons = ["💾","💾","🖥️","🖥️","📀","📀","📡","📡","📼","📼","☎️","☎️"];
  const board = document.getElementById('memoryBoard');
  const movesEl = document.getElementById('memoryMoves');
  const pairsEl = document.getElementById('memoryPairs');
  const statusEl = document.getElementById('memoryStatus');
  const resetBtn = document.getElementById('memoryReset');
  let first = null, second = null, lock = false, moves = 0, pairs = 0;

  function shuffle(arr){ return arr.map(v => ({v, s: Math.random()})).sort((a,b)=>a.s-b.s).map(x=>x.v); }
  function update(){ movesEl.textContent = String(moves); pairsEl.textContent = `${pairs}/6`; }
  function reset(){
    board.innerHTML = ''; first = null; second = null; lock = false; moves = 0; pairs = 0; update();
    statusEl.textContent = 'Abra duas cartas por vez.';
    shuffle(icons).forEach((icon, index) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'memory-card'; btn.dataset.icon = icon; btn.dataset.index = String(index); btn.textContent = '?';
      btn.addEventListener('click', () => flip(btn));
      board.appendChild(btn);
    });
  }
  function finish(){ statusEl.textContent = `Parabéns! Você fechou o jogo em ${moves} movimentos.`; }
  function flip(card){
    if (lock || card.classList.contains('is-open') || card.classList.contains('is-matched')) return;
    card.classList.add('is-open'); card.textContent = card.dataset.icon;
    if (!first){ first = card; return; }
    second = card; lock = true; moves += 1; update();
    if (first.dataset.icon === second.dataset.icon){
      first.classList.remove('is-open'); second.classList.remove('is-open');
      first.classList.add('is-matched'); second.classList.add('is-matched');
      first = null; second = null; lock = false; pairs += 1; update();
      statusEl.textContent = 'Boa! Você encontrou um par.';
      if (pairs === 6) finish();
      return;
    }
    statusEl.textContent = 'Essas duas não combinam. Tente de novo.';
    setTimeout(() => {
      [first, second].forEach(c => { if (c){ c.classList.remove('is-open'); c.textContent = '?'; } });
      first = null; second = null; lock = false;
    }, 800);
  }
  resetBtn.addEventListener('click', reset);
  reset();
})();
