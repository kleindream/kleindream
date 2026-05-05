const letras = {
  A: ["  A  ", " A A ", "AAAAA", "A   A"],
  B: ["BBBB ", "B   B", "BBBB ", "B   B", "BBBB "],
  C: [" CCC ", "C    ", "C    ", " CCC "],
  D: ["DDD  ", "D  D ", "D   D", "DDD  "],
  E: ["EEEE", "E   ", "EEE ", "E   ", "EEEE"],
  G: [" GGG ", "G    ", "G  GG", "G   G", " GGG "],
  I: ["III", " I ", " I ", "III"],
  O: [" OOO ", "O   O", "O   O", " OOO "],
  default: ["????"]
};

function gerarASCII() {
  const texto = document.getElementById("ascii-input").value.toUpperCase();

  let linhas = [];

  for (let char of texto) {
    let letra = letras[char] || letras.default;

    for (let i = 0; i < letra.length; i++) {
      if (!linhas[i]) linhas[i] = "";
      linhas[i] += letra[i] + "  ";
    }
  }

  document.getElementById("ascii-output").textContent = linhas.join("\n");
}

function copiarASCII() {
  const texto = document.getElementById("ascii-output").textContent;
  if (!texto) return;

  navigator.clipboard.writeText(texto);
}

function limparASCII() {
  document.getElementById("ascii-input").value = "";
  document.getElementById("ascii-output").textContent = "";
}

// 🎯 Visual estilo DOS corrigido
document.addEventListener("DOMContentLoaded", function () {
  const el = document.getElementById("ascii-output");

  if (el) {
    el.style.fontFamily = '"Courier New", Courier, monospace';
    el.style.whiteSpace = "pre";
    el.style.fontSize = "13px";
    el.style.lineHeight = "1.05";
    el.style.letterSpacing = "0";
    el.style.color = "#00ff00";
    el.style.background = "#000";
    el.style.padding = "10px";
    el.style.borderRadius = "6px";
  }
});