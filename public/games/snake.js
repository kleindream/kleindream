(() => {
  const canvas = document.getElementById('snakeCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('snakeScore');
  const bestEl = document.getElementById('snakeBest');
  const statusEl = document.getElementById('snakeStatus');
  const startBtn = document.getElementById('snakeStart');
  const restartBtn = document.getElementById('snakeRestart');
  const size = 18; const tiles = canvas.width / size;
  let timer = null, speed = 150, score = 0, dir = {x:1,y:0}, nextDir = {x:1,y:0};
  let snake = [{x:9,y:9},{x:8,y:9},{x:7,y:9}], food = {x:13,y:9}, started = false;
  const bestKey = 'kd_snake_best';
  function best(){ return Number(localStorage.getItem(bestKey) || 0); }
  function setBest(v){ localStorage.setItem(bestKey, String(v)); bestEl.textContent = String(v); }
  bestEl.textContent = String(best());
  function randCell(){ return {x: Math.floor(Math.random()*tiles), y: Math.floor(Math.random()*tiles)}; }
  function placeFood(){ do { food = randCell(); } while (snake.some(s => s.x===food.x && s.y===food.y)); }
  function reset(){ clearInterval(timer); timer = null; speed = 150; score = 0; started = false; dir = {x:1,y:0}; nextDir = {x:1,y:0}; snake = [{x:9,y:9},{x:8,y:9},{x:7,y:9}]; placeFood(); scoreEl.textContent='0'; statusEl.textContent='Aperte Jogar para começar.'; draw(); }
  function drawCell(x,y,fill){ ctx.fillStyle = fill; ctx.fillRect(x*size+1,y*size+1,size-2,size-2); }
  function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#111827'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<tiles;i++){ for(let j=0;j<tiles;j++){ ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.strokeRect(i*size,j*size,size,size); } }
    snake.forEach((s,idx)=>drawCell(s.x,s.y, idx===0 ? '#93c5fd' : '#60a5fa'));
    drawCell(food.x, food.y, '#fbbf24');
  }
  function gameOver(){ clearInterval(timer); timer=null; started=false; statusEl.textContent=`Fim de jogo. Você fez ${score} ponto(s).`; if (score > best()) setBest(score); }
  function tick(){ dir = nextDir; const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    if (head.x < 0 || head.y < 0 || head.x >= tiles || head.y >= tiles || snake.some(s=>s.x===head.x && s.y===head.y)){ gameOver(); draw(); return; }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y){ score += 1; scoreEl.textContent = String(score); statusEl.textContent = 'Boa! Pegou um disco.'; placeFood(); if (speed > 75){ speed -= 5; clearInterval(timer); timer = setInterval(tick, speed); } } else { snake.pop(); }
    draw();
  }
  document.addEventListener('keydown', (e) => { const m = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}}[e.key]; if (!m) return; e.preventDefault(); if (m.x === -dir.x && m.y === -dir.y) return; nextDir = m; if (!started) start(); });
  function start(){ if (timer) return; started = true; statusEl.textContent='Em jogo. Use as setas do teclado.'; timer = setInterval(tick, speed); }
  startBtn.addEventListener('click', start); restartBtn.addEventListener('click', reset); reset();
})();
