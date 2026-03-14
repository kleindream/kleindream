
async function perguntarDisquete(){
 const pergunta=document.getElementById("pergunta-disquete").value;
 const r=await fetch("/api/sr-disquete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pergunta})});
 const d=await r.json();
 document.getElementById("resposta-disquete").innerText=d.resposta;
}
