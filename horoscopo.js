function normalizeBirthDateParts(value) {
  if (!value) return null;
  const raw = String(value).trim();
  let day = 0;
  let month = 0;

  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    day = Number(br[1]);
    month = Number(br[2]);
  } else {
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      month = Number(iso[2]);
      day = Number(iso[3]);
    }
  }

  if (!day || !month) return null;
  return { day, month };
}

function getSign(day, month) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Áries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Touro";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gêmeos";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Câncer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leão";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgem";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Escorpião";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagitário";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricórnio";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquário";
  return "Peixes";
}

const DAILY_MESSAGES = {
  "Áries": {
    icon: "🔥",
    color: "Vermelho",
    lucky: "9",
    text: "Sua coragem está em alta hoje. Uma iniciativa simples pode render um momento muito especial."
  },
  "Touro": {
    icon: "🌿",
    color: "Verde",
    lucky: "6",
    text: "Hoje combina com conforto, afeto e escolhas seguras. O que te traz paz merece mais espaço."
  },
  "Gêmeos": {
    icon: "💬",
    color: "Amarelo",
    lucky: "5",
    text: "Conversa boa, mensagem inesperada e curiosidade em alta. Seu charme está nas palavras."
  },
  "Câncer": {
    icon: "💖",
    color: "Prata",
    lucky: "2",
    text: "Seu coração está sensível, mas forte. Um gesto de carinho pode mudar o ritmo do seu dia."
  },
  "Leão": {
    icon: "✨",
    color: "Dourado",
    lucky: "1",
    text: "Você tende a chamar atenção naturalmente hoje. Aproveite para mostrar sua melhor energia."
  },
  "Virgem": {
    icon: "📋",
    color: "Azul-claro",
    lucky: "4",
    text: "Organizar um detalhe agora pode abrir espaço para algo muito melhor mais tarde."
  },
  "Libra": {
    icon: "🌙",
    color: "Rosa",
    lucky: "7",
    text: "Seu poder hoje está no equilíbrio. Escute seu coração, mas não ignore sua razão."
  },
  "Escorpião": {
    icon: "🦂",
    color: "Vinho",
    lucky: "8",
    text: "Sua intuição está fortíssima. Se algo parecer importante, provavelmente é mesmo."
  },
  "Sagitário": {
    icon: "🌍",
    color: "Laranja",
    lucky: "3",
    text: "Leveza e vontade de descobrir algo novo. Um papo diferente pode animar bastante seu dia."
  },
  "Capricórnio": {
    icon: "🏔️",
    color: "Cinza",
    lucky: "10",
    text: "Disciplina e constância estão ao seu favor. Hoje rende mais quando você confia no seu ritmo."
  },
  "Aquário": {
    icon: "💡",
    color: "Turquesa",
    lucky: "11",
    text: "Uma ideia nova pode nascer de algo simples. Deixe a mente solta e observe as conexões."
  },
  "Peixes": {
    icon: "🌊",
    color: "Lilás",
    lucky: "12",
    text: "Sua sensibilidade está bonita hoje. Música, lembranças boas e afeto combinam com você."
  }
};

function getVibeFromBirthDate(value) {
  const parts = normalizeBirthDateParts(value);
  if (!parts) return null;
  const sign = getSign(parts.day, parts.month);
  const info = DAILY_MESSAGES[sign] || {
    icon: "✨",
    color: "Azul",
    lucky: "7",
    text: "Hoje é um bom dia para espalhar sua melhor energia."
  };
  return {
    sign,
    icon: info.icon,
    color: info.color,
    lucky: info.lucky,
    text: info.text
  };
}

module.exports = { normalizeBirthDateParts, getSign, getVibeFromBirthDate };
