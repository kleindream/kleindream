(() => {
  const canvas = document.getElementById('snakeCanvas'); const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('snakeScore'); const restartBtn = document.getElementById('snakeRestart');
  const size = 21; const cells = 20; let timer; let dir = {x:1,y:0}; let nextDir = {x:1,y:0}; let snake, food, score;

  if (window.KDGameRanking) window.KDGameRanking.setInitialBest(window.__MY_BEST__);

  function saveCurrent(){ if (window.KDGameRanking && score > 0) window.KDGameRanking.submitScore('snake', score); }
  function reset(){ saveCurrent(); snake=[{x:10,y:10}]; dir={x:1,y:0}; nextDir={x:1,y:0}; score=0; scoreEl.textContent='0'; spawnFood(); clearInterval(timer); timer=setInterval(tick, 120); draw(); }
  function spawnFood(){ do{ food={x:Math.floor(Math.random()*cells), y:Math.floor(Math.random()*cells)}; }while(snake && snake.some(s=>s.x===food.x && s.y===food.y)); }
  function tick(){ dir = nextDir; const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    if(head.x<0||head.y<0||head.x>=cells||head.y>=cells||snake.some(s=>s.x===head.x&&s.y===head.y)){ reset(); return; }
    snake.unshift(head);
    if(head.x===food.x && head.y===food.y){ score += 10; scoreEl.textContent=String(score); spawnFood(); if (window.KDGameRanking) window.KDGameRanking.submitScore('snake', score); }
    else snake.pop();
    draw();
  }
  function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.strokeRect(0.5,0.5,canvas.width-1,canvas.height-1); snake.forEach((s)=>{ ctx.fillRect(s.x*size+2,s.y*size+2,size-4,size-4); }); ctx.beginPath(); ctx.arc(food.x*size + size/2, food.y*size + size/2, size/2.8, 0, Math.PI*2); ctx.fill(); }
  document.addEventListener('keydown', (e)=>{ const k=e.key; if(k==='ArrowUp'&&dir.y!==1) nextDir={x:0,y:-1}; else if(k==='ArrowDown'&&dir.y!==-1) nextDir={x:0,y:1}; else if(k==='ArrowLeft'&&dir.x!==1) nextDir={x:-1,y:0}; else if(k==='ArrowRight'&&dir.x!==-1) nextDir={x:1,y:0}; });
  restartBtn.addEventListener('click', reset); reset();
})();
