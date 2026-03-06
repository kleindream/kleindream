(() => {
  const questions = [
    {q:'Qual mensageiro ficou famoso pelo som “uh-oh”?', a:['ICQ','MSN Messenger','Skype'], c:0},
    {q:'No Orkut, como eram chamados os recados públicos no perfil?', a:['Posts','Scraps','DMs'], c:1},
    {q:'Qual item era muito usado para salvar arquivos nos anos 90?', a:['Disquete','SSD NVMe','Blu-ray'], c:0},
    {q:'Qual rede social era conhecida pelas comunidades e depoimentos?', a:['LinkedIn','Orkut','TikTok'], c:1},
    {q:'Na internet discada, o que era bem comum acontecer?', a:['A ligação cair ao conectar','Velocidade de fibra','Vídeo 4K instantâneo'], c:0}
  ];
  const qEl = document.getElementById('quizQuestion'); const optsEl = document.getElementById('quizOptions'); const scoreEl = document.getElementById('quizScore'); const statusEl = document.getElementById('quizStatus'); const restartBtn = document.getElementById('quizRestart');
  let idx=0, score=0;

  if (window.KDGameRanking) window.KDGameRanking.setInitialBest(window.__MY_BEST__);

  function render(){ const item=questions[idx]; qEl.textContent = `${idx+1}. ${item.q}`; optsEl.innerHTML=''; statusEl.textContent=''; item.a.forEach((opt,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='quiz-option'; b.textContent=opt; b.addEventListener('click',()=>answer(i)); optsEl.appendChild(b); }); }
  function answer(i){ const item=questions[idx]; if(i===item.c){ score++; scoreEl.textContent=String(score); statusEl.textContent='Acertou!'; } else { statusEl.textContent=`Errou. A resposta certa era: ${item.a[item.c]}.`; } idx++; if(idx>=questions.length){ qEl.textContent=`Fim do quiz! Você fez ${score} de ${questions.length}.`; optsEl.innerHTML=''; restartBtn.style.display='inline-flex'; if (window.KDGameRanking) window.KDGameRanking.submitScore('quiz', score); return; } setTimeout(render, 550); }
  restartBtn.addEventListener('click', ()=>{ idx=0; score=0; scoreEl.textContent='0'; restartBtn.style.display='none'; render(); });
  render();
})();
