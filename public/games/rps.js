(() => {
  const options = ['pedra','papel','tesoura'];
  const winsEl = document.getElementById('rpsWins');
  const drawsEl = document.getElementById('rpsDraws');
  const lossesEl = document.getElementById('rpsLosses');
  const statusEl = document.getElementById('rpsStatus');
  let wins = 0, draws = 0, losses = 0;
  function label(v){ return {pedra:'✊ Pedra', papel:'✋ Papel', tesoura:'✌️ Tesoura'}[v]; }
  function play(player){
    const bot = options[Math.floor(Math.random()*options.length)];
    if (player === bot){ draws += 1; drawsEl.textContent = String(draws); statusEl.textContent = `Empate! Você e a Klein Dream jogaram ${label(player)}.`; return; }
    const won = (player==='pedra'&&bot==='tesoura') || (player==='papel'&&bot==='pedra') || (player==='tesoura'&&bot==='papel');
    if (won){ wins += 1; winsEl.textContent = String(wins); statusEl.textContent = `Você venceu! ${label(player)} bate ${label(bot)}.`; }
    else { losses += 1; lossesEl.textContent = String(losses); statusEl.textContent = `Você perdeu. A Klein Dream jogou ${label(bot)}.`; }
  }
  document.querySelectorAll('.rps-btn').forEach(btn => btn.addEventListener('click', () => play(btn.dataset.choice)));
})();
