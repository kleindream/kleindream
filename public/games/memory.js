(() => {
  const icons = ["💾","💾","📀","📀","🖥️","🖥️","🖱️","🖱️","📼","📼","☎️","☎️","📟","📟","🎧","🎧"];
  const grid = document.getElementById("memoryGrid");
  const movesEl = document.getElementById("memoryMoves");
  const statusEl = document.getElementById("memoryStatus");
  const restartBtn = document.getElementById("memoryRestart");
  let first=null, second=null, lock=false, moves=0, matched=0;
  function shuffle(arr){ return [...arr].sort(() => Math.random()-0.5); }
  function render(){
    first=second=null; lock=false; moves=0; matched=0; movesEl.textContent='0'; statusEl.textContent='';
    grid.innerHTML='';
    shuffle(icons).forEach((icon, idx) => {
      const card = document.createElement('button');
      card.type='button'; card.className='memory-card'; card.dataset.icon=icon; card.dataset.idx=idx; card.textContent='?';
      card.addEventListener('click', () => onCard(card));
      grid.appendChild(card);
    });
  }
  function reveal(card){ card.textContent = card.dataset.icon; card.classList.add('revealed'); }
  function hide(card){ card.textContent = '?'; card.classList.remove('revealed'); }
  function onCard(card){
    if(lock || card.classList.contains('matched') || card===first) return;
    reveal(card);
    if(!first){ first=card; return; }
    second=card; lock=true; moves++; movesEl.textContent=String(moves);
    if(first.dataset.icon === second.dataset.icon){
      first.classList.add('matched'); second.classList.add('matched'); matched += 2; first=second=null; lock=false;
      if(matched === icons.length) statusEl.textContent = `Parabéns! Você fechou tudo em ${moves} jogadas.`;
    } else {
      setTimeout(() => { hide(first); hide(second); first=second=null; lock=false; }, 700);
    }
  }
  restartBtn.addEventListener('click', render); render();
})();