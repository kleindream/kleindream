const letras = {
  A: ["  A  ", " A A ", "AAAAA", "A   A"],
  B: ["BBBB ", "B   B", "BBBB ", "B   B", "BBBB "],
  C: [" CCC ", "C    ", "C    ", " CCC "],
  D: ["DDD  ", "D  D ", "D   D", "DDD  "],
  E: ["EEEE", "E   ", "EEE ", "E   ", "EEEE"],
  G: [" GGG ", "G    ", "G  GG", "G   G", " GGG "],
  I: ["III", " I ", " I ", "III"],
  O: [" OOO ", "O   O", "O   O", " OOO "],
  default: ["?"]
};

function gerarASCII() {
  const texto = document.getElementById("ascii-input").value.toUpperCase();
  let linhas = ["", "", "", "", ""];

  for (let char of texto) {
    let letra = letras[char] || letras.default;

    for (let i = 0; i < letra.length; i++) {
      linhas[i] += letra[i] + "  ";
    }
  }

  document.getElementById("ascii-output").textContent = linhas.join("\\n");
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
