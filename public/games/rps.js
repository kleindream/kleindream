(() => {
  const buttons = [...document.querySelectorAll('[data-rps]')];
  const options = ['pedra','papel','tesoura'];
  const statusEl = document.getElementById('rpsStatus'); const youEl = document.getElementById('rpsYou'); const cpuEl = document.getElementById('rpsCpu');
  let you=0,cpu=0;
  function decide(a,b){ if(a===b) return 0; if((a==='pedra'&&b==='tesoura')||(a==='papel'&&b==='pedra')||(a==='tesoura'&&b==='papel')) return 1; return -1; }
  buttons.forEach(btn => btn.addEventListener('click', ()=>{
    const me = btn.dataset.rps; const bot = options[Math.floor(Math.random()*options.length)]; const r = decide(me, bot);
    if(r>0){ you++; youEl.textContent=you; statusEl.textContent=`Você jogou ${me} e a Klein Dream jogou ${bot}. Você venceu!`; }
    else if(r<0){ cpu++; cpuEl.textContent=cpu; statusEl.textContent=`Você jogou ${me} e a Klein Dream jogou ${bot}. A Klein Dream venceu.`; }
    else statusEl.textContent=`Empate! Os dois jogaram ${me}.`;
  }));
})();