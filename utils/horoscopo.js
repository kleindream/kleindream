function getSign(day, month) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Áries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Touro';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gêmeos';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Câncer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leão';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgem';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Escorpião';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagitário';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricórnio';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquário';
  return 'Peixes';
}

const frases = {
  'Áries': [
    'Hoje é dia de agir com coragem e acreditar mais em você. 💥',
    'Sua iniciativa pode abrir uma porta boa hoje. ✨'
  ],
  'Touro': [
    'Valorize o que te traz paz e segurança hoje. 🌿',
    'Pequenos confortos podem fazer seu dia render melhor. ☕'
  ],
  'Gêmeos': [
    'Uma conversa pode trazer uma surpresa boa hoje. 💬',
    'Sua leveza vai ajudar a aproximar pessoas. 🌟'
  ],
  'Câncer': [
    'Escute mais o coração, mas sem esquecer da calma. 💖',
    'Seu lado sensível pode iluminar o dia de alguém. 🌙'
  ],
  'Leão': [
    'Seu brilho natural está forte hoje. Aproveite. 🔥',
    'Confiança e generosidade podem abrir caminhos. 👑'
  ],
  'Virgem': [
    'Organizar uma parte da sua rotina vai te fazer bem hoje. 📋',
    'Sua atenção aos detalhes pode render um ótimo resultado. 🌼'
  ],
  'Libra': [
    'Busque equilíbrio e evite pressa nas decisões. ⚖️',
    'Seu charme social pode te aproximar de alguém especial. 💫'
  ],
  'Escorpião': [
    'Sua intuição está afiada hoje. Confie mais nela. 🦂',
    'Um sentimento guardado pode pedir espaço para aparecer. 🌌'
  ],
  'Sagitário': [
    'Um momento leve ou inesperado pode animar seu dia. 🌍',
    'Hoje combina com espontaneidade e boas descobertas. 🏹'
  ],
  'Capricórnio': [
    'Seu foco pode render mais do que imagina hoje. 🏔️',
    'Disciplina e constância vão te favorecer bastante. ✍️'
  ],
  'Aquário': [
    'Uma ideia diferente pode virar algo muito interessante. 💡',
    'Hoje sua originalidade pode chamar atenção. 🌠'
  ],
  'Peixes': [
    'Sua sensibilidade está em alta hoje. Use isso com carinho. 🌊',
    'A intuição e a imaginação podem te fazer muito bem. ✨'
  ]
};

function getFrase(sign) {
  const lista = frases[sign] || ['Hoje é um bom dia para recomeçar com leveza. ✨'];
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return lista[seed % lista.length];
}

module.exports = { getSign, getFrase };
