(function(){
  const canvas=document.getElementById('paintCanvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const tools=[...document.querySelectorAll('.paint-tool')];
  const palette=[...document.querySelectorAll('.paint-color')];
  const sizeInput=document.getElementById('paintBrushSize');
  const sizeValue=document.getElementById('paintBrushSizeValue');
  const opacityInput=document.getElementById('paintOpacity');
  const opacityValue=document.getElementById('paintOpacityValue');
  const customColor=document.getElementById('paintCustomColor');
  const form=document.getElementById('paintSaveForm');
  const imageData=document.getElementById('paintImageData');
  const undoBtn=document.getElementById('paintUndo');
  const redoBtn=document.getElementById('paintRedo');
  const clearBtn=document.getElementById('paintClear');
  const whiteBtn=document.getElementById('paintFillWhite');
  const downloadBtn=document.getElementById('paintDownloadBtn');
  let tool='pen', color='#000000', size=4, opacity=1;
  let drawing=false, start=null, last=null, snapshot=null;
  const undo=[], redo=[];
  const maxHistory=24;

  function fillWhite(){ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
  function pushHistory(){try{undo.push(ctx.getImageData(0,0,canvas.width,canvas.height));if(undo.length>maxHistory)undo.shift();redo.length=0;}catch(e){}}
  function restore(data){if(data)ctx.putImageData(data,0,0);}
  function point(evt){const r=canvas.getBoundingClientRect();const e=evt.touches?evt.touches[0]:evt;return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)};}
  function setTool(t){tool=t;tools.forEach(b=>b.classList.toggle('active',b.dataset.tool===t));}
  function setColor(c){color=c;customColor.value=c;palette.forEach(b=>b.classList.toggle('active',b.dataset.color.toLowerCase()===c.toLowerCase()));}
  function line(a,b){ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=size;ctx.strokeStyle=color;ctx.globalAlpha=tool==='eraser'?1:opacity;ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
  function spray(p){ctx.save();ctx.globalAlpha=opacity*.75;ctx.fillStyle=color;const dots=Math.max(12,size*3);const radius=Math.max(6,size*1.4);for(let i=0;i<dots;i++){const a=Math.random()*Math.PI*2;const rr=Math.random()*radius;ctx.fillRect(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr,1.2,1.2);}ctx.restore();}
  function brushDot(p){ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.fill();ctx.restore();}
  function previewShape(p){restore(snapshot);ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';const x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y);ctx.beginPath();if(tool==='line'){ctx.moveTo(start.x,start.y);ctx.lineTo(p.x,p.y);}else if(tool==='rect'){ctx.rect(x,y,w,h);}else if(tool==='circle'){ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);}ctx.stroke();ctx.restore();}
  function floodFill(p){const x=Math.floor(p.x),y=Math.floor(p.y);const img=ctx.getImageData(0,0,canvas.width,canvas.height);const data=img.data;const idx=(y*canvas.width+x)*4;const target=[data[idx],data[idx+1],data[idx+2],data[idx+3]];const rgb=hexToRgb(color);const repl=[rgb.r,rgb.g,rgb.b,255];if(match(target,repl,0))return;const stack=[[x,y]];while(stack.length){const [cx,cy]=stack.pop();if(cx<0||cy<0||cx>=canvas.width||cy>=canvas.height)continue;const i=(cy*canvas.width+cx)*4;if(!match([data[i],data[i+1],data[i+2],data[i+3]],target,18))continue;data[i]=repl[0];data[i+1]=repl[1];data[i+2]=repl[2];data[i+3]=255;stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);}ctx.putImageData(img,0,0);}
  function match(a,b,t){return Math.abs(a[0]-b[0])<=t&&Math.abs(a[1]-b[1])<=t&&Math.abs(a[2]-b[2])<=t&&Math.abs(a[3]-b[3])<=t;}
  function hexToRgb(hex){const n=parseInt(hex.replace('#',''),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function down(e){e.preventDefault();const p=point(e);pushHistory();drawing=true;start=p;last=p;snapshot=ctx.getImageData(0,0,canvas.width,canvas.height);if(tool==='fill'){floodFill(p);drawing=false;}else if(tool==='brush'){brushDot(p);}else if(tool==='spray'){spray(p);}else if(tool==='pen'||tool==='eraser'){line(p,p);}}
  function move(e){if(!drawing)return;e.preventDefault();const p=point(e);if(tool==='pen'||tool==='eraser'){line(last,p);last=p;}else if(tool==='brush'){line(last,p);brushDot(p);last=p;}else if(tool==='spray'){spray(p);last=p;}else if(tool==='line'||tool==='rect'||tool==='circle'){previewShape(p);}}
  function up(e){if(!drawing)return;e&&e.preventDefault();drawing=false;snapshot=null;last=null;start=null;}

  tools.forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  palette.forEach(b=>b.addEventListener('click',()=>setColor(b.dataset.color)));
  customColor.addEventListener('input',e=>setColor(e.target.value));
  sizeInput.addEventListener('input',e=>{size=Number(e.target.value)||4;sizeValue.textContent=size+' px';});
  opacityInput.addEventListener('input',e=>{opacity=(Number(e.target.value)||100)/100;opacityValue.textContent=Math.round(opacity*100)+'%';});
  canvas.addEventListener('mousedown',down);canvas.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
  canvas.addEventListener('touchstart',down,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up,{passive:false});
  undoBtn&&undoBtn.addEventListener('click',()=>{if(!undo.length)return;redo.push(ctx.getImageData(0,0,canvas.width,canvas.height));restore(undo.pop());});
  redoBtn&&redoBtn.addEventListener('click',()=>{if(!redo.length)return;undo.push(ctx.getImageData(0,0,canvas.width,canvas.height));restore(redo.pop());});
  clearBtn&&clearBtn.addEventListener('click',()=>{if(confirm('Limpar o desenho atual?')){pushHistory();ctx.clearRect(0,0,canvas.width,canvas.height);fillWhite();}});
  whiteBtn&&whiteBtn.addEventListener('click',()=>{pushHistory();fillWhite();});
  downloadBtn&&downloadBtn.addEventListener('click',()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='klein-dream-paint.png';a.click();});
  form&&form.addEventListener('submit',()=>{fillWhiteBehindTransparent();imageData.value=canvas.toDataURL('image/png');});
  function fillWhiteBehindTransparent(){const old=ctx.getImageData(0,0,canvas.width,canvas.height);ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();return old;}
  fillWhite();pushHistory();
})();
