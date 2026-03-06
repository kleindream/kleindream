(() => {
  const boardEl = document.getElementById('velhaBoard');
  const resultEl = document.getElementById('velhaResult');
  const statusEl = document.getElementById('velhaStatus');
  const resetBtn = document.getElementById('velhaReset');
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let board = Array(9).fill(''); let over = false;
  function check(sym){ return wins.some(c => c.every(i => board[i]===sym)); }
  function empty(){ return board.map((v,i)=>v?null:i).filter(v=>v!==null); }
  function aiMove(){ const spots = empty(); if (!spots.length) return; const pick = spots[Math.floor(Math.random()*spots.length)]; board[pick] = 'O'; }
  function paint(){ boardEl.innerHTML=''; board.forEach((v,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='velha-cell'; b.textContent=v || ''; b.addEventListener('click',()=>move(i)); boardEl.appendChild(b); }); }
  function finish(text){ over = true; resultEl.textContent = text; statusEl.textContent = text === 'Vitória' ? 'Você venceu a partida.' : text === 'Derrota' ? 'A Klein Dream venceu desta vez.' : 'Deu velha.'; }
  function move(i){ if (over || board[i]) return; board[i]='X'; if (check('X')){ paint(); finish('Vitória'); return; } if (!empty().length){ paint(); finish('Empate'); return; } aiMove(); paint(); if (check('O')){ finish('Derrota'); return; } if (!empty().length){ finish('Empate'); return; } statusEl.textContent = 'Sua vez de novo.'; }
  function reset(){ board = Array(9).fill(''); over = false; resultEl.textContent='Em andamento'; statusEl.textContent='Escolha uma casa.'; paint(); }
  resetBtn.addEventListener('click', reset); reset();
})();
