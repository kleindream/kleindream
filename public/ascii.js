const letras = {
  A: ["  A  ", " A A ", "AAAAA", "A   A", "A   A"],
  B: ["BBBB ", "B   B", "BBBB ", "B   B", "BBBB "],
  C: [" CCC ", "C    ", "C    ", "C    ", " CCC "],
  D: ["DDD  ", "D  D ", "D   D", "D  D ", "DDD  "],
  E: ["EEEE", "E   ", "EEE ", "E   ", "EEEE"],
  F: ["FFFF", "F   ", "FFF ", "F   ", "F   "],
  G: [" GGG ", "G    ", "G  GG", "G   G", " GGG "],
  H: ["H   H", "H   H", "HHHHH", "H   H", "H   H"],
  I: ["III", " I ", " I ", " I ", "III"],
  J: [" JJJ", "   J", "   J", "J  J", " JJ "],
  K: ["K  K", "K K ", "KK  ", "K K ", "K  K"],
  L: ["L   ", "L   ", "L   ", "L   ", "LLLL"],
  M: ["M   M", "MM MM", "M M M", "M   M", "M   M"],
  N: ["N   N", "NN  N", "N N N", "N  NN", "N   N"],
  O: [" OOO ", "O   O", "O   O", "O   O", " OOO "],
  P: ["PPPP ", "P   P", "PPPP ", "P    ", "P    "],
  Q: [" QQQ ", "Q   Q", "Q   Q", "Q  Q ", " QQ Q"],
  R: ["RRRR ", "R   R", "RRRR ", "R R  ", "R  RR"],
  S: [" SSS ", "S    ", " SS  ", "   S ", "SSS  "],
  T: ["TTTTT", "  T  ", "  T  ", "  T  ", "  T  "],
  U: ["U   U", "U   U", "U   U", "U   U", " UUU "],
  V: ["V   V", "V   V", "V   V", " V V ", "  V  "],
  W: ["W   W", "W   W", "W W W", "WW WW", "W   W"],
  X: ["X   X", " X X ", "  X  ", " X X ", "X   X"],
  Y: ["Y   Y", " Y Y ", "  Y  ", "  Y  ", "  Y  "],
  Z: ["ZZZZZ", "   Z ", "  Z  ", " Z   ", "ZZZZZ"],
  "0": [" 000 ", "0   0", "0   0", "0   0", " 000 "],
  "1": [" 1 ", "11 ", " 1 ", " 1 ", "111"],
  "2": ["222 ", "   2", " 22 ", "2   ", "2222"],
  "3": ["333 ", "   3", " 33 ", "   3", "333 "],
  "4": ["4  4", "4  4", "4444", "   4", "   4"],
  "5": ["5555", "5   ", "555 ", "   5", "555 "],
  "6": [" 666", "6   ", "666 ", "6  6", " 66 "],
  "7": ["7777", "   7", "  7 ", " 7  ", "7   "],
  "8": [" 88 ", "8  8", " 88 ", "8  8", " 88 "],
  "9": [" 99 ", "9  9", " 999", "   9", "999 "],
  " ": ["   ", "   ", "   ", "   ", "   "],
  default: ["????", "?  ?", " ?? ", "    ", " ?? "]
};

function normalizarLetra(letra) {
  const saida = letra.slice(0, 5);
  while (saida.length < 5) saida.push(" ".repeat(saida[0]?.length || 4));
  return saida;
}

function gerarASCII() {
  const input = document.getElementById("ascii-input");
  const output = document.getElementById("ascii-output");
  if (!input || !output) return;

  const texto = input.value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const linhas = ["", "", "", "", ""];

  for (const char of texto) {
    const letra = normalizarLetra(letras[char] || letras.default);
    for (let i = 0; i < 5; i++) {
      linhas[i] += letra[i] + "  ";
    }
  }

  output.textContent = linhas.join("\n");
}

async function copiarASCII() {
  const output = document.getElementById("ascii-output");
  if (!output || !output.textContent) return;

  try {
    await navigator.clipboard.writeText(output.textContent);
  } catch (err) {
    const range = document.createRange();
    range.selectNodeContents(output);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
  }
}

function limparASCII() {
  const input = document.getElementById("ascii-input");
  const output = document.getElementById("ascii-output");
  if (input) input.value = "";
  if (output) output.textContent = "";
}

document.addEventListener("DOMContentLoaded", function () {
  const el = document.getElementById("ascii-output");
  if (el) {
    el.classList.add("ascii-output");
    el.style.fontFamily = '"Courier New", Courier, monospace';
    el.style.whiteSpace = "pre";
    el.style.fontSize = "13px";
    el.style.lineHeight = "1.05";
    el.style.letterSpacing = "0";
  }
});
