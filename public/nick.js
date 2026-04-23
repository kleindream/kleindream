(() => {
  const input = document.getElementById('nickInput');
  const output = document.getElementById('nickOutput');
  const preview = document.getElementById('nickPreview');
  const styleSelect = document.getElementById('nickStyle');
  const generateBtn = document.getElementById('nickGenerate');
  const clearBtn = document.getElementById('nickClear');
  const copyBtn = document.getElementById('nickCopy');
  const presets = Array.from(document.querySelectorAll('.nick-preset'));

  const convertChar = (ch) => {
    switch (ch) {
      case 'A': return 'Å';
      case 'a': return 'å';
      case 'B': case 'b': return 'ß';
      case 'C': return '©';
      case 'c': return '¢';
      case 'D': case 'd': return 'Ð';
      case 'E': return '€';
      case 'e': return 'ë';
      case 'H': case 'h': return '|-|';
      case 'I': return '!';
      case 'i': return 'ï';
      case 'j': return '¡';
      case 'k': return '|<';
      case 'L': case 'l': return '£';
      case 'N': return 'Ñ';
      case 'n': return 'ñ';
      case 'o': return 'ø';
      case 'O': return 'Ø';
      case 'P': case 'p': return 'Þ';
      case 'r': return '®';
      case 'S': case 's': return '§';
      case 'u': return 'µ';
      case 'U': return 'Ü';
      case 'Y': return '¥';
      case 'x': return '×';
      default: return ch;
    }
  };

  const styles = {
    classic: (body) => ` «¤‡ ${body} ‡¤» `,
    stars: (body) => ` ★彡 ${body} 彡★ `,
    waves: (body) => ` ~* ${body} *~ `,
    brackets: (body) => ` [ ${body} ] `,
  };

  let typingTimer = null;

  const setResult = (text) => {
    output.textContent = text;
    preview.textContent = text || 'Seu nick estilizado vai aparecer aqui.';
  };

  const animateResult = (fullText) => {
    window.clearTimeout(typingTimer);
    let index = 0;
    setResult('');
    const tick = () => {
      setResult(fullText.slice(0, index));
      index += 1;
      if (index <= fullText.length) {
        typingTimer = window.setTimeout(tick, 35);
      }
    };
    tick();
  };

  const generateNick = () => {
    const raw = (input.value || '').trim();
    if (!raw) {
      input.focus();
      setResult('Digite seu nick atual para gerar um novo.');
      return;
    }
    const converted = Array.from(raw).map(convertChar).join('');
    const style = styles[styleSelect.value] || styles.classic;
    animateResult(style(converted));
  };

  generateBtn?.addEventListener('click', generateNick);
  input?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      generateNick();
    }
  });
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    setResult('Seu nick estilizado vai aparecer aqui.');
    input.focus();
  });
  copyBtn?.addEventListener('click', async () => {
    const text = output.textContent.trim();
    if (!text || text === 'Seu nick estilizado vai aparecer aqui.' || text === 'Digite seu nick atual para gerar um novo.') return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '✅ Copiado';
      setTimeout(() => { copyBtn.textContent = '📋 Copiar'; }, 1400);
    } catch {
      copyBtn.textContent = '❌ Falhou';
      setTimeout(() => { copyBtn.textContent = '📋 Copiar'; }, 1400);
    }
  });

  presets.forEach((btn) => btn.addEventListener('click', () => {
    input.value = btn.dataset.value || '';
    generateNick();
  }));

  styleSelect?.addEventListener('change', () => {
    if ((input.value || '').trim()) generateNick();
  });

  setResult('Seu nick estilizado vai aparecer aqui.');
})();
