
async function pingPresence(){
    try{
        await fetch('/api/presence/ping',{method:'POST'});
    }catch(e){}
}

async function loadOnline(){
    try{
        let r = await fetch('/api/presence/online');
        let users = await r.json();
        let el = document.getElementById("onlineUsers");
        if(!el) return;
        el.innerHTML = users.map(u=>"<li>"+u.username+"</li>").join("");
    }catch(e){}
}

setInterval(pingPresence,60000);
setInterval(loadOnline,30000);
pingPresence();
loadOnline();
