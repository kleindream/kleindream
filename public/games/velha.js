(() => {
  const grid = document.getElementById('velhaGrid'); const statusEl = document.getElementById('velhaStatus'); const restartBtn = document.getElementById('velhaRestart'); const winsEl = document.getElementById('velhaWins');
  let board, finished, wins=0;
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  if (window.KDGameRanking) window.KDGameRanking.setInitialBest(window.__MY_BEST__);

  function start(){ board=Array(9).fill(''); finished=false; statusEl.textContent='Sua vez: X'; render(); }
  function render(){ grid.innerHTML=''; board.forEach((v,i)=>{ const c=document.createElement('button'); c.type='button'; c.className='velha-cell'; c.textContent=v; c.addEventListener('click',()=>play(i)); grid.appendChild(c); }); }
  function winner(sym){ return lines.some(line => line.every(i => board[i]===sym)); }
  function free(){ return board.map((v,i)=>v?null:i).filter(v=>v!==null); }
  function play(i){
    if(finished||board[i]) return;
    board[i]='X';
    if(winner('X')){ finished=true; render(); wins++; if (winsEl) winsEl.textContent=String(wins); statusEl.textContent='Você venceu!'; if (window.KDGameRanking) window.KDGameRanking.submitScore('velha', wins); return; }
    if(free().length===0){ finished=true; render(); statusEl.textContent='Deu velha!'; return; }
    const moves=free(); const pick=moves[Math.floor(Math.random()*moves.length)]; board[pick]='O';
    if(winner('O')){ finished=true; render(); statusEl.textContent='A Klein Dream venceu.'; return; }
    if(free().length===0){ finished=true; render(); statusEl.textContent='Deu velha!'; return; }
    render(); statusEl.textContent='Sua vez: X';
  }
  restartBtn.addEventListener('click', start); start();
})();
