(() => {
  const TYPES = [
    { name: "Terreno", emoji: "⬜", population: 0, money: 0, score: 0 },
    { name: "Casa", emoji: "🏠", population: 5, money: -2, score: 8 },
    { name: "Prédio", emoji: "🏢", population: 15, money: -6, score: 24 },
    { name: "Fábrica", emoji: "🏭", population: 3, money: 12, score: 18 },
    { name: "Parque", emoji: "🌳", population: 1, money: -1, score: 10 }
  ];

  const gridEl = document.getElementById("kcGrid");
  const popEl = document.getElementById("kcPopulation");
  const moneyEl = document.getElementById("kcMoney");
  const scoreEl = document.getElementById("kcScore");
  const statusEl = document.getElementById("kcStatus");
  const restartBtn = document.getElementById("kcRestart");
  const totalTiles = 24;
  let city = [];
  let bestScore = Number(window.__MY_BEST__);

  function makeFreshCity() {
    city = Array.from({ length: totalTiles }, () => 0);
    render();
    setStatus("Sua cidade começou do zero. Clique nos lotes para construir.");
  }

  function computeStats() {
    return city.reduce((acc, typeIndex) => {
      const type = TYPES[typeIndex] || TYPES[0];
      acc.population += type.population;
      acc.money += type.money;
      acc.score += type.score;
      return acc;
    }, { population: 0, money: 100, score: 0 });
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function maybeSaveScore(score) {
    if (!window.KDGameRanking) return;
    if (!Number.isFinite(score) || score <= 0) return;
    if (Number.isFinite(bestScore) && score <= bestScore) return;
    bestScore = score;
    window.KDGameRanking.submitScore("kleincity", score);
  }

  function onTileClick(index) {
    city[index] = (city[index] + 1) % TYPES.length;
    const type = TYPES[city[index]];
    const stats = computeStats();
    render();
    setStatus(`Você transformou o lote em ${type.name}. Desenvolvimento atual: ${stats.score}.`);
    maybeSaveScore(stats.score);
  }

  function render() {
    const stats = computeStats();
    popEl.textContent = String(stats.population);
    moneyEl.textContent = String(stats.money);
    scoreEl.textContent = String(stats.score);
    gridEl.innerHTML = city.map((typeIndex, index) => {
      const type = TYPES[typeIndex] || TYPES[0];
      return `<button class="kc-tile" type="button" data-index="${index}" aria-label="Lote ${index + 1}: ${type.name}"><span>${type.emoji}</span><small>${type.name}</small></button>`;
    }).join("");
    gridEl.querySelectorAll(".kc-tile").forEach((btn) => {
      btn.addEventListener("click", () => onTileClick(Number(btn.dataset.index)));
    });
  }

  restartBtn?.addEventListener("click", makeFreshCity);
  window.KDGameRanking?.setInitialBest(window.__MY_BEST__);
  makeFreshCity();
})();
