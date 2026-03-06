(() => {
  const questions = [
    { q: 'Qual rede ficou famosa pelos scraps e comunidades?', a: ['Orkut', 'ICQ', 'Fotolog'], c: 0 },
    { q: 'Antes do WhatsApp, muita gente conversava em qual mensageiro?', a: ['MSN Messenger', 'Napster', 'Winamp'], c: 0 },
    { q: 'O barulho da internet discada acontecia em qual tipo de conexão?', a: ['ADSL', 'Discada', 'Fibra'], c: 1 },
    { q: 'Qual objeto era muito usado para salvar arquivos pequenos?', a: ['Disquete', 'Blu-ray', 'SSD NVMe'], c: 0 },
    { q: 'No Orkut, depoimentos e recados eram sinais de quê?', a: ['Presença no perfil', 'Atualização automática', 'Anúncio patrocinado'], c: 0 }
  ];
  const questionEl = document.getElementById('quizQuestion');
  const optionsEl = document.getElementById('quizOptions');
  const statusEl = document.getElementById('quizStatus');
  const progressEl = document.getElementById('quizProgress');
  const scoreEl = document.getElementById('quizScore');
  const restartBtn = document.getElementById('quizRestart');
  let index = 0, score = 0, locked = false;
  function render(){
    const item = questions[index]; locked = false; progressEl.textContent = `${index+1}/${questions.length}`; scoreEl.textContent = String(score);
    questionEl.textContent = item.q; optionsEl.innerHTML = '';
    item.a.forEach((opt,i) => { const btn = document.createElement('button'); btn.type='button'; btn.className='quiz-option'; btn.textContent=opt; btn.addEventListener('click',()=>answer(i,btn)); optionsEl.appendChild(btn); });
    statusEl.textContent = 'Escolha uma resposta.';
  }
  function answer(choice, btn){ if (locked) return; locked = true; const item = questions[index]; const buttons=[...document.querySelectorAll('.quiz-option')]; buttons[item.c].classList.add('correct');
    if (choice === item.c){ score += 1; scoreEl.textContent = String(score); statusEl.textContent = 'Acertou!'; }
    else { btn.classList.add('wrong'); statusEl.textContent = 'Não foi dessa vez.'; }
    setTimeout(() => { index += 1; if (index >= questions.length){ questionEl.textContent = `Fim do quiz! Você fez ${score} de ${questions.length}.`; optionsEl.innerHTML = ''; statusEl.textContent = score >= 4 ? 'Veterano da internet detectado.' : 'Mandou bem — e ainda dá para melhorar na próxima.'; progressEl.textContent = `${questions.length}/${questions.length}`; return; } render(); }, 900);
  }
  function reset(){ index = 0; score = 0; render(); }
  restartBtn.addEventListener('click', reset); reset();
})();
