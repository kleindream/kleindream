window.KDGameRanking = (() => {
  let bestSent = Number.NEGATIVE_INFINITY;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRanking(ranking) {
    const list = document.getElementById("gameRankingList");
    if (!list) return;
    if (!ranking || !ranking.length) {
      list.innerHTML = '<div class="small">Ainda não há pontuações salvas para este jogo.</div>';
      return;
    }
    list.innerHTML = ranking.map((row, idx) => `
      <div class="ranking-row">
        <span class="ranking-pos">${idx + 1}º</span>
        <span class="ranking-name">${escapeHtml(row.username)}</span>
        <span class="ranking-score">${Number(row.score)}</span>
      </div>
    `).join("");
  }

  function updateMyBest(myBest) {
    const best = document.getElementById("gameMyBest");
    if (!best) return;
    best.textContent = myBest && Number.isFinite(Number(myBest.score))
      ? String(Number(myBest.score))
      : "—";
  }

  async function submitScore(game, score) {
    const value = Math.floor(Number(score));
    if (!game || !Number.isFinite(value) || value < 0) return;
    if (value <= bestSent) return;

    const status = document.getElementById("gameSaveStatus");
    try {
      const res = await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, score: value })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error((data && data.error) || "Falha ao salvar a pontuação.");
      }
      bestSent = Math.max(bestSent, value);
      renderRanking(data.ranking || []);
      updateMyBest(data.myBest || null);
      if (status) status.textContent = `Ranking atualizado com ${value} ponto(s).`;
    } catch (err) {
      if (status) status.textContent = err.message || "Não foi possível salvar a pontuação.";
    }
  }

  function setInitialBest(best) {
    const value = Number(best);
    if (Number.isFinite(value)) bestSent = value;
  }

  return { submitScore, renderRanking, updateMyBest, setInitialBest };
})();
