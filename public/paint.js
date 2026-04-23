(function(){
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) {
    console.error('Paint Brush: canvas 2D não disponível');
    return;
  }

  const saveForm = document.getElementById('paintSaveForm');
  const imageDataInput = document.getElementById('paintImageData');
  const titleInput = document.getElementById('paintTitle');
  const brushSize = document.getElementById('paintBrushSize');
  const brushSizeValue = document.getElementById('paintBrushSizeValue');
  const undoBtn = document.getElementById('paintUndo');
  const clearBtn = document.getElementById('paintClear');
  const fillWhiteBtn = document.getElementById('paintFillWhite');
  const downloadBtn = document.getElementById('paintDownloadBtn');
  const toolButtons = Array.from(document.querySelectorAll('.paint-tool'));
  const colorButtons = Array.from(document.querySelectorAll('.paint-color'));

  let drawing = false;
  let tool = 'pen';
  let color = '#000000';
  let size = Number((brushSize && brushSize.value) || 3);
  const history = [];

  function syncSize(){
    size = Number((brushSize && brushSize.value) || 3);
    if (brushSizeValue) brushSizeValue.textContent = size + ' px';
  }

  function pushHistory(){
    try {
      history.push(canvas.toDataURL('image/png'));
      if (history.length > 25) history.shift();
    } catch (err) {
      console.warn('Paint Brush: falha ao guardar histórico', err);
    }
  }

  function restoreFrom(dataUrl){
    const img = new Image();
    img.onload = function(){
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  }

  function fillBackground(){
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function startFresh(){
    fillBackground();
    pushHistory();
  }

  function pointFromEvent(ev){
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.clientX;
    const clientY = ev.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function begin(ev){
    ev.preventDefault();
    drawing = true;
    pushHistory();

    if (canvas.setPointerCapture && ev.pointerId !== undefined) {
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    }

    const p = pointFromEvent(ev);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;

    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(ev){
    if (!drawing) return;
    ev.preventDefault();

    const p = pointFromEvent(ev);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function end(ev){
    if (!drawing) return;
    if (ev && ev.preventDefault) ev.preventDefault();
    drawing = false;
    ctx.beginPath();
  }

  toolButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      tool = btn.dataset.tool || 'pen';
      toolButtons.forEach(function(b){ b.classList.toggle('active', b === btn); });
    });
  });

  colorButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      color = btn.dataset.color || '#000000';
      colorButtons.forEach(function(b){ b.classList.toggle('active', b === btn); });
      tool = 'pen';
      toolButtons.forEach(function(b){ b.classList.toggle('active', b.dataset.tool === 'pen'); });
    });
  });

  if (brushSize) brushSize.addEventListener('input', syncSize);
  syncSize();

  if (undoBtn) undoBtn.addEventListener('click', function(){
    if (history.length <= 1) return;
    history.pop();
    restoreFrom(history[history.length - 1]);
  });

  if (clearBtn) clearBtn.addEventListener('click', function(){
    if (!confirm('Limpar a tela inteira?')) return;
    pushHistory();
    fillBackground();
  });

  if (fillWhiteBtn) fillWhiteBtn.addEventListener('click', function(){
    pushHistory();
    fillBackground();
  });

  if (downloadBtn) downloadBtn.addEventListener('click', function(){
    const title = (titleInput && titleInput.value.trim()) || 'kleindream-paint';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = (title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'kleindream-paint') + '.png';
    link.click();
  });

  if (saveForm) saveForm.addEventListener('submit', function(ev){
    if (!window.__PAINT_CAN_SAVE__) return;
    const title = (titleInput && titleInput.value.trim()) || '';
    if (!title) {
      if (!confirm('Salvar sem título personalizado?')) {
        ev.preventDefault();
        return;
      }
    }
    if (imageDataInput) imageDataInput.value = canvas.toDataURL('image/png');
  });

  canvas.style.display = 'block';
  canvas.addEventListener('pointerdown', begin);
  canvas.addEventListener('pointermove', draw);
  window.addEventListener('pointerup', end);
  canvas.addEventListener('pointerleave', end);

  startFresh();
})();
