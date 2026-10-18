/* SILENT ENTRY — client: rendering, input, audio, local & LAN modes */
'use strict';
const S = window.SilentEntrySim;
const { MAP, TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, WEAPONS, ITEMS } = S;
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
const lerp = (a,b,t)=>a+(b-a)*t;
function angLerp(a,b,t){ let d=(b-a)%(Math.PI*2); if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return a+d*t; }
const rnd = S.mulberry(4242);

/* ---------- canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let VW=0, VH=0;
function resize(){ VW=cv.width=innerWidth; VH=cv.height=innerHeight; }
addEventListener('resize', resize); resize();
const lightCv = document.createElement('canvas'), lightCtx = lightCv.getContext('2d');

/* ---------- static map pre-render ---------- */
const mapCv = document.createElement('canvas'); mapCv.width=WORLD_W; mapCv.height=WORLD_H;
const decalCv = document.createElement('canvas'); decalCv.width=WORLD_W; decalCv.height=WORLD_H;
const dctx = decalCv.getContext('2d');
const FLOOR_COLORS = { tile:['#565b60','#50555a'], carpet:['#3d454e','#39414a'], concrete:['#4c4c4c','#474747'], wood:['#5d4a36','#57452f'] };
function buildMapCanvas(){
  const c = mapCv.getContext('2d'); const r = S.mulberry(777);
  c.fillStyle='#14161a'; c.fillRect(0,0,WORLD_W,WORLD_H);
  const decor = S.computeDecor();
  // floors
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    const t=MAP.grid[y*MAP_W+x]; if(t===S.T_WALL) continue;
    const f=FLOOR_COLORS[MAP.floor[y*MAP_W+x]]||FLOOR_COLORS.concrete;
    c.fillStyle = ((x+y)%2===0)?f[0]:f[1];
    c.fillRect(x*TILE,y*TILE,TILE,TILE);
    c.fillStyle='rgba(0,0,0,0.16)'; c.fillRect(x*TILE,y*TILE+TILE-1,TILE,1); c.fillRect(x*TILE+TILE-1,y*TILE,1,TILE);
    for(let i=0;i<5;i++){ c.fillStyle = r()<0.5?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.05)'; c.fillRect(x*TILE+r()*30,y*TILE+r()*30,2,2); }
    if(MAP.floor[y*MAP_W+x]==='wood'){ c.fillStyle='rgba(0,0,0,0.2)'; c.fillRect(x*TILE,y*TILE+10,TILE,1); c.fillRect(x*TILE,y*TILE+21,TILE,1); }
  }
  // decor on floor
  for(const d of decor){
    if(d.k==='paper'){ c.save(); c.translate(d.x,d.y); c.rotate(d.a); c.fillStyle='rgba(214,214,206,.75)'; c.fillRect(-4,-3,8,6); c.restore(); }
    else if(d.k==='stain'){ c.fillStyle='rgba(0,0,0,.13)'; c.beginPath(); c.ellipse(d.x,d.y,d.r,d.r*0.7,0,0,7); c.fill(); }
  }
  // site markings
  for(const k of ['A','B']){
    const s=MAP.sites[k];
    c.strokeStyle = k==='A'?'rgba(216,84,60,.55)':'rgba(216,84,60,.55)';
    c.lineWidth=2; c.setLineDash([9,7]);
    c.strokeRect(s.cx-s.r, s.cy-s.r, s.r*2, s.r*2);
    c.setLineDash([]);
    c.fillStyle='rgba(216,84,60,.4)'; c.font='900 54px Arial'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(k, s.cx, s.cy);
    c.font='700 11px Arial'; c.fillStyle='rgba(230,230,220,.4)';
    c.fillText(k==='A'?'СЕРВЕРНАЯ':'АРХИВ', s.cx, s.cy+s.r-11);
  }
  c.font='700 10px Arial'; c.fillStyle='rgba(160,190,230,.4)'; c.textAlign='center';
  c.fillText('CT', MAP.spawns.CT[0].x, MAP.spawns.CT[0].y-16);
  c.fillStyle='rgba(240,190,110,.4)'; c.fillText('T', MAP.spawns.T[0].x, MAP.spawns.T[0].y-16);
  // objects (crates / desks / racks)
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    const t=MAP.grid[y*MAP_W+x], px=x*TILE, py=y*TILE;
    if(t===S.T_CRATE){
      c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(px+2,py+4,TILE,TILE);
      c.fillStyle=((x*7+y*13)%3===0)?'#5c6552':'#7a623f'; c.fillRect(px+1,py+1,TILE-2,TILE-2);
      c.strokeStyle='rgba(0,0,0,.45)'; c.lineWidth=2; c.strokeRect(px+2.5,py+2.5,TILE-5,TILE-5);
      c.beginPath(); c.moveTo(px+2,py+2); c.lineTo(px+TILE-2,py+TILE-2); c.moveTo(px+TILE-2,py+2); c.lineTo(px+2,py+TILE-2); c.stroke();
    } else if(t===S.T_RACK){
      c.fillStyle='#20242a'; c.fillRect(px+1,py+1,TILE-2,TILE-2);
      c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=1;
      for(let i=1;i<4;i++){ c.beginPath(); c.moveTo(px+4,py+i*8); c.lineTo(px+TILE-4,py+i*8); c.stroke(); }
      for(let i=0;i<4;i++){ c.fillStyle=r()<0.6?'#63d66b':'#5db4e8'; c.fillRect(px+4+r()*22,py+3+r()*24,2,2); }
    } else if(t===S.T_DESK){
      c.fillStyle='#6e5b43'; c.fillRect(px,py+3,TILE,TILE-6);
      c.fillStyle='#7d684d'; c.fillRect(px,py+3,TILE,3);
      c.fillStyle='rgba(0,0,0,.25)'; c.fillRect(px,py+TILE-5,TILE,2);
    }
  }
  for(const d of decor){ if(d.k!=='deskstuff') continue;
    if(d.mon){ c.fillStyle='#14181d'; c.fillRect(d.x+7,d.y+7,17,11); c.fillStyle='#2b3a46'; c.fillRect(d.x+8.5,d.y+8.5,14,8); }
    c.fillStyle='rgba(20,20,20,.65)'; c.fillRect(d.x+9,d.y+21,14,4.5);
    if(d.paper>0.4){ c.fillStyle='rgba(218,218,208,.85)'; c.fillRect(d.x+3,d.y+6,7,9); }
  }
  // wall shadows then walls
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    if(MAP.grid[y*MAP_W+x]!==S.T_WALL) continue;
    if(y+1<MAP_H && MAP.grid[(y+1)*MAP_W+x]!==S.T_WALL){ c.fillStyle='rgba(0,0,0,.34)'; c.fillRect(x*TILE,(y+1)*TILE,TILE,7); }
    if(x+1<MAP_W && MAP.grid[y*MAP_W+x+1]!==S.T_WALL){ c.fillStyle='rgba(0,0,0,.2)'; c.fillRect((x+1)*TILE,y*TILE,5,TILE); }
  }
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    if(MAP.grid[y*MAP_W+x]!==S.T_WALL) continue;
    const px=x*TILE, py=y*TILE;
    c.fillStyle='#2c3036'; c.fillRect(px,py,TILE,TILE);
    c.fillStyle='#3d434c'; c.fillRect(px+1.5,py+1.5,TILE-3,TILE-3);
    c.fillStyle='rgba(255,255,255,.05)'; c.fillRect(px+1.5,py+1.5,TILE-3,3);
  }
}
buildMapCanvas();

/* minimap base (blueprint) */
const miniBase=document.createElement('canvas'); miniBase.width=240; miniBase.height=160;
(function(){ const c=miniBase.getContext('2d'); const k=5;
  c.fillStyle='#0d1622'; c.fillRect(0,0,240,160);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){ const t=MAP.grid[y*MAP_W+x];
    c.fillStyle = t===S.T_WALL?'#54687e':(t===S.T_FLOOR?'#1b2836':'#2a3a4c');
    c.fillRect(x*k,y*k,k,k); }
  c.font='900 11px Arial'; c.textAlign='center';
  c.fillStyle='rgba(255,120,90,.9)'; c.fillText('A', MAP.sites.A.cx/WORLD_W*240, MAP.sites.A.cy/WORLD_H*160+4);
  c.fillText('B', MAP.sites.B.cx/WORLD_W*240, MAP.sites.B.cy/WORLD_H*160+4);
})();

/* ---------- visibility polygon ---------- */
const segments=[];
(function(){
  const vb=(x,y)=>S.visionTile(x,y);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    if(!vb(x,y)) continue;
    const px=x*TILE, py=y*TILE;
    if(!vb(x,y-1)) segments.push([px,py,px+TILE,py]);
    if(!vb(x,y+1)) segments.push([px,py+TILE,px+TILE,py+TILE]);
    if(!vb(x-1,y)) segments.push([px,py,px,py+TILE]);
    if(!vb(x+1,y)) segments.push([px+TILE,py,px+TILE,py+TILE]);
  }
})();
function visibilityPoly(ox,oy,radius){
  const segs=[];
  for(const s of segments){
    const mx=(s[0]+s[2])/2, my=(s[1]+s[3])/2;
    if(Math.abs(mx-ox)<radius+40 && Math.abs(my-oy)<radius+40) segs.push(s);
  }
  const pts=new Set();
  for(const s of segs){ pts.add(s[0]+','+s[1]); pts.add(s[2]+','+s[3]); }
  const hits=[];
  const cast=(ang)=>{
    const dx=Math.cos(ang), dy=Math.sin(ang);
    let best=radius, bx=ox+dx*radius, by=oy+dy*radius;
    for(const s of segs){
      const sdx=s[2]-s[0], sdy=s[3]-s[1];
      const den=dx*sdy-dy*sdx; if(Math.abs(den)<1e-9) continue;
      const t=((s[0]-ox)*sdy-(s[1]-oy)*sdx)/den;
      const u=((s[0]-ox)*dy-(s[1]-oy)*dx)/den;
      if(t>0.5 && t<best && u>=0 && u<=1){ best=t; bx=ox+dx*t; by=oy+dy*t; }
    }
    return {ang,x:bx,y:by};
  };
  for(const key of pts){
    const [px,py]=key.split(',').map(Number);
    const a=Math.atan2(py-oy,px-ox);
    hits.push(cast(a-0.0009), cast(a), cast(a+0.0009));
  }
  for(let i=0;i<24;i++) hits.push(cast(i/24*Math.PI*2));
  hits.sort((m,n)=>m.ang-n.ang);
  return hits;
}

/* ---------- audio (synthesized) ---------- */
let AC=null, master=null, muted=false, noiseBuf=null;
function initAudio(){
  if(AC) return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain(); master.gain.value=0.5; master.connect(AC.destination);
    noiseBuf=AC.createBuffer(1, AC.sampleRate*0.5, AC.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }catch(e){ AC=null; }
}
function sndPan(x,y){ // returns {vol,pan} relative to camera view
  if(!cam.viewPos) return {vol:0.6,pan:0};
  const d=Math.hypot(x-cam.viewPos.x,y-cam.viewPos.y);
  return { vol: clamp(1-d/950,0,1), pan: clamp((x-cam.viewPos.x)/500,-0.8,0.8) };
}
function playNoise(dur,freq,vol,type,x,y,decayPow){
  if(!AC||muted||vol<=0.01) return;
  const t=AC.currentTime;
  const src=AC.createBufferSource(); src.buffer=noiseBuf;
  const f=AC.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=freq;
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  let node=g;
  if(AC.createStereoPanner && x!==undefined){ const p=AC.createStereoPanner(); p.pan.value=sndPan(x,y).pan; g.connect(p); node=p; }
  src.connect(f); f.connect(g); node.connect(master);
  src.start(t); src.stop(t+dur+0.02);
}
function playTone(freq,dur,vol,type,when){
  if(!AC||muted) return;
  const t=AC.currentTime+(when||0);
  const o=AC.createOscillator(); o.type=type||'sine'; o.frequency.value=freq;
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.02);
}
const SHOT_PARAMS={ pistol:[0.14,2600,0.5], smg:[0.11,3000,0.42], rifle:[0.17,2200,0.62], shotgun:[0.3,1400,0.85], awp:[0.45,1100,1.0] };
function shotSound(weapon,x,y){
  const pr=SHOT_PARAMS[weapon]||SHOT_PARAMS.rifle;
  const v=sndPan(x,y).vol;
  playNoise(pr[0],pr[1],pr[2]*v,'lowpass',x,y);
  playNoise(0.05,5200,pr[2]*0.5*v,'highpass',x,y);
}

/* ---------- game state ---------- */
let mode='menu'; // local | lan
let localGame=null, localSeq=0, myId=null, ws=null;
let snapBuf=[]; // {at, snap}
let lastRoundSeen=0;
const cam={ x:WORLD_W/2, y:WORLD_H/2, zoom:1, viewPos:null, shake:0 };
const fx={ tracers:[], parts:[], flashes:[], lights:[] };
const walkPhase=new Map();
let predicted=null; // {x,y} client-side predicted own position
let lastBeepSecond=-1, hitmarkT=0;

function pushSnapshot(snap){
  snapBuf.push({at:performance.now(), snap});
  if(snapBuf.length>12) snapBuf.splice(0,snapBuf.length-12);
  if(snap.round!==lastRoundSeen){ lastRoundSeen=snap.round; dctx.clearRect(0,0,WORLD_W,WORLD_H); }
  if(snap.events) for(const e of snap.events) handleEvent(e, snap);
}
function currentSnap(){
  if(!snapBuf.length) return null;
  const target=performance.now()-110;
  let a=snapBuf[0], b=snapBuf[snapBuf.length-1];
  for(let i=0;i<snapBuf.length;i++){ if(snapBuf[i].at<=target) a=snapBuf[i]; }
  const idx=snapBuf.indexOf(a);
  b=snapBuf[Math.min(idx+1,snapBuf.length-1)];
  if(a===b) return a.snap;
  const span=Math.max(1,b.at-a.at), t=clamp((target-a.at)/span,0,1);
  return interpolate(a.snap,b.snap,t);
}
function interpolate(A,B,t){
  if(A.phase!==B.phase || A.round!==B.round) return B;
  const out=Object.assign({},B);
  const mapA=new Map(A.players.map(p=>[p.id,p]));
  out.players=B.players.map(pb=>{
    const pa=mapA.get(pb.id); if(!pa) return pb;
    return Object.assign({},pb,{ x:lerp(pa.x,pb.x,t), y:lerp(pa.y,pb.y,t), angle:angLerp(pa.angle,pb.angle,t) });
  });
  if(A.view&&B.view) out.view=Object.assign({},B.view,{x:lerp(A.view.x,B.view.x,t),y:lerp(A.view.y,B.view.y,t)});
  return out;
}

/* ---------- events -> fx ---------- */
function decal(x,y,draw){ dctx.save(); dctx.translate(x,y); draw(dctx); dctx.restore(); }
function spawnParts(x,y,n,opt){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=(opt.sp0||20)+Math.random()*(opt.sp1||90);
    fx.parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,max:0.25+Math.random()*(opt.life||0.4),
      size:1+Math.random()*(opt.size||2), color:opt.colors[Math.floor(Math.random()*opt.colors.length)], drag:opt.drag||3});
  }
}
function handleEvent(e, snap){
  const me = snap.self;
  switch(e.type){
    case 'shot': {
      shotSound(e.weapon,e.x,e.y);
      const shooter = snap.players.find(p=>p.id===e.id);
      const mx=e.x+Math.cos(e.angle)*24, my=e.y+Math.sin(e.angle)*24;
      if(shooter || e.id===myId){
        fx.flashes.push({x:mx,y:my,angle:e.angle,t:0,weapon:e.weapon});
        fx.lights.push({x:mx,y:my,r:130,t:0,max:0.07,strength:0.85});
        const w=WEAPONS[e.weapon]; const pellets=w?w.pellets:1;
        for(let i=0;i<Math.min(pellets,4);i++){
          const a=e.angle+(Math.random()*2-1)*(w?w.spread:2)*Math.PI/180;
          fx.tracers.push({x:mx,y:my,vx:Math.cos(a)*1750,vy:Math.sin(a)*1750,life:0.55});
        }
        // shell
        fx.parts.push({x:e.x,y:e.y,vx:Math.cos(e.angle+2.2)*40,vy:Math.sin(e.angle+2.2)*40,life:0,max:0.5,size:1.6,color:'#c9a227',drag:4});
      }
      break; }
    case 'impact': {
      if(e.kind==='wall'){ spawnParts(e.x,e.y,4,{colors:['#9aa0a6','#c7b299','#6e6e6e'],sp1:70,life:0.3});
        decal(e.x,e.y,c=>{c.fillStyle='rgba(15,15,15,.55)';c.beginPath();c.arc(0,0,1.6,0,7);c.fill();}); }
      else { spawnParts(e.x,e.y,7,{colors:['#7d1212','#5d0d0d','#931818'],sp1:80,life:0.35,size:2.4});
        if(e.shooter===myId){ hitmarkT=performance.now(); playTone(1400,0.05,0.16,'square'); }
      }
      break; }
    case 'kill': {
      killfeed(e);
      decal(e.x,e.y,c=>{ for(let i=0;i<5;i++){ c.fillStyle=`rgba(96,10,10,${0.16+Math.random()*0.14})`; c.beginPath(); c.ellipse((Math.random()-0.5)*16,(Math.random()-0.5)*16,6+Math.random()*11,5+Math.random()*8,Math.random()*3,0,7); c.fill(); } });
      if(e.killer===myId) playTone(880,0.09,0.2,'square');
      if(e.victim===myId){ playTone(160,0.5,0.3,'sawtooth'); cam.shake=Math.max(cam.shake,7); }
      break; }
    case 'explosion': case 'bombBoom': {
      const big=e.type==='bombBoom';
      playNoise(big?1.1:0.55, big?300:520, 1.0*sndPan(e.x,e.y).vol,'lowpass',e.x,e.y);
      fx.lights.push({x:e.x,y:e.y,r:big?430:240,t:0,max:0.28,strength:1});
      spawnParts(e.x,e.y,big?60:30,{colors:['#ffb347','#ff7b2d','#8a8a8a','#555'],sp0:60,sp1:big?420:260,life:0.7,size:3});
      decal(e.x,e.y,c=>{ const g=c.createRadialGradient(0,0,2,0,0,big?90:52); g.addColorStop(0,'rgba(8,8,8,.7)'); g.addColorStop(1,'rgba(8,8,8,0)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,big?90:52,0,7); c.fill(); });
      if(cam.viewPos){ const d=Math.hypot(e.x-cam.viewPos.x,e.y-cam.viewPos.y); cam.shake=Math.max(cam.shake, clamp(16-d/45,0,15)); }
      break; }
    case 'flashPop': playNoise(0.3,3800,0.5*sndPan(e.x,e.y).vol,'highpass',e.x,e.y); fx.lights.push({x:e.x,y:e.y,r:300,t:0,max:0.18,strength:1}); break;
    case 'smokePop': playNoise(0.5,900,0.25*sndPan(e.x,e.y).vol,'lowpass',e.x,e.y); break;
    case 'reload': if(e.id===myId){ playTone(500,0.05,0.12,'square'); playTone(700,0.05,0.12,'square',0.22);} break;
    case 'planted': centerFlash('БОМБА УСТАНОВЛЕНА · ТОЧКА '+e.site,'#ff8a5c'); playTone(660,0.15,0.25,'square'); playTone(660,0.15,0.25,'square',0.2); lastBeepSecond=-1; break;
    case 'defused': centerFlash('БОМБА ОБЕЗВРЕЖЕНА','#7fb2e8'); break;
    case 'roundEnd': playTone(e.winner===(me&&me.team)?740:330, 0.35, 0.22, 'triangle'); break;
    case 'roundStart': hideCenter(); break;
    case 'live': playTone(990,0.12,0.18,'square'); break;
  }
}
let centerFlashUntil=0;
function centerFlash(text,color){ const el=$('subMsg'); el.textContent=text; el.style.color=color||'#fff'; el.classList.remove('hidden'); centerFlashUntil=performance.now()+2600; }
function hideCenter(){ $('subMsg').classList.add('hidden'); }
function killfeed(e){
  const box=$('killfeed'); const div=document.createElement('div'); div.className='kill';
  const wName=e.weapon?(WEAPONS[e.weapon]?WEAPONS[e.weapon].nameCT:e.weapon):'✸';
  div.innerHTML = e.killerName
    ? `<span class="${e.killerTeam==='CT'?'ct':'t'}">${esc(e.killerName)}</span><span class="wpn">${wName}</span><span class="${e.victimTeam==='CT'?'ct':'t'}">${esc(e.victimName)}</span>`
    : `<span class="${e.victimTeam==='CT'?'ct':'t'}">${esc(e.victimName)}</span> <span class="wpn">погиб</span>`;
  box.appendChild(div);
  while(box.children.length>5) box.removeChild(box.firstChild);
  setTimeout(()=>{ div.style.opacity='0'; div.style.transition='opacity .4s'; setTimeout(()=>div.remove(),420); }, 3800);
}
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

/* ---------- input ---------- */
const keys={}; let mouseX=innerWidth/2, mouseY=innerHeight/2, mouseDown=false, rmbDown=false;
let queuedSlot=0, buyOpen=false, boardOpen=false;
addEventListener('keydown',e=>{
  if(e.code==='Tab'){ e.preventDefault(); boardOpen=true; }
  keys[e.code]=true;
  if(mode==='menu') return;
  if(e.code==='Digit1') queuedSlot=1;
  if(e.code==='Digit2') queuedSlot=2;
  if(e.code==='Digit3'){ const s=currentSnap(); queuedSlot = (s&&s.self&&s.self.grenadeSel)?4:3; }
  if(e.code==='KeyB'&&!e.repeat) toggleBuy();
  if(e.code==='Escape'&&buyOpen) toggleBuy(false);
  if(buyOpen && /^Digit[1-9]$/.test(e.code)){ buyByHotkey(parseInt(e.code.slice(5))-1); }
  if(e.code==='Space'){ e.preventDefault(); requestSpectate(); }
});
addEventListener('keyup',e=>{ keys[e.code]=false; if(e.code==='Tab') boardOpen=false; });
addEventListener('mousemove',e=>{ mouseX=e.clientX; mouseY=e.clientY; });
addEventListener('mousedown',e=>{ initAudio(); if(AC&&AC.state==='suspended')AC.resume();
  if(e.target.closest('button,input,select,#buyMenu,#menu')) return;
  if(e.button===0){ mouseDown=true; const s=currentSnap(); if(s&&s.self&&!s.self.alive) requestSpectate(); }
  if(e.button===2) rmbDown=true;
});
addEventListener('mouseup',e=>{ if(e.button===0)mouseDown=false; if(e.button===2)rmbDown=false; });
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{ for(const k in keys)keys[k]=false; mouseDown=false; rmbDown=false; });

function readInput(angleRef){
  let mx=0,my=0;
  if(keys.KeyW||keys.ArrowUp)my-=1; if(keys.KeyS||keys.ArrowDown)my+=1;
  if(keys.KeyA||keys.ArrowLeft)mx-=1; if(keys.KeyD||keys.ArrowRight)mx+=1;
  const inp={ mx, my, angle:angleRef, fire:mouseDown&&!buyOpen, walk:!!(keys.ShiftLeft||keys.ShiftRight),
    use:!!keys.KeyE, reload:!!keys.KeyR, slot:queuedSlot };
  queuedSlot=0;
  return inp;
}
function requestSpectate(){
  if(mode==='local'&&localGame) localGame.cycleSpectate(myId);
  else if(mode==='lan'&&ws&&ws.readyState===1) ws.send(JSON.stringify({t:'spectate'}));
}

/* ---------- buy menu ---------- */
const BUY_ORDER=['smg','shotgun','rifle','awp','armor','kit','he','smoke','flash'];
function toggleBuy(force){
  const s=currentSnap();
  buyOpen = force!==undefined?force:!buyOpen;
  if(buyOpen && !(s&&s.self&&s.self.canBuy)) buyOpen=false;
  $('buyMenu').classList.toggle('hidden',!buyOpen);
  if(buyOpen) renderBuy();
}
function itemName(key,team){ if(WEAPONS[key]) return team==='T'?WEAPONS[key].nameT:WEAPONS[key].nameCT; return ITEMS[key].name; }
function renderBuy(){
  const s=currentSnap(); if(!s||!s.self) return;
  const me=s.self;
  $('buyMoney').textContent='· $'+me.money;
  const grid=$('buyGrid'); grid.innerHTML='';
  BUY_ORDER.forEach((key,i)=>{
    if(key==='kit'&&me.team!=='CT') return;
    const price=WEAPONS[key]?WEAPONS[key].price:ITEMS[key].price;
    const owned = WEAPONS[key]? me.weapons.includes(key) : (key==='armor'? me.armor>=100 : key==='kit'? me.hasKit : !!me.grenades[key]);
    const btn=document.createElement('button'); btn.className='buyItem';
    btn.disabled = owned || me.money<price || !me.canBuy;
    btn.innerHTML=`<span><span class="hot">${i+1}</span>${itemName(key,me.team)}</span>`+(owned?'<span class="owned">КУПЛЕНО</span>':`<span class="price">$${price}</span>`);
    btn.onclick=()=>buyItem(key);
    grid.appendChild(btn);
  });
}
function buyByHotkey(i){ const key=BUY_ORDER[i]; if(key) buyItem(key); }
function buyItem(key){
  if(mode==='local'&&localGame) localGame.buy(myId,key);
  else if(mode==='lan'&&ws&&ws.readyState===1) ws.send(JSON.stringify({t:'buy',item:key}));
  playTone(1200,0.05,0.12,'square');
  setTimeout(renderBuy,60);
}

/* ---------- modes ---------- */
function startLocal(){
  initAudio();
  const name=$('nick').value.trim()||'Operator';
  let team=$('teamSel').value; if(team==='auto') team='CT';
  localGame=new S.Game({difficulty:$('diffSel').value});
  const me=localGame.addPlayer({name,team,isBot:false});
  myId=me.id;
  localGame.fillWithBots();
  localGame.startMatch();
  localSeq=0; snapBuf=[]; lastRoundSeen=0; predicted=null;
  mode='local'; enterGameUI();
}
function startLan(){
  initAudio();
  const name=$('nick').value.trim()||'Operator';
  const team=$('teamSel').value;
  const proto=location.protocol==='https:'?'wss':'ws';
  ws=new WebSocket(`${proto}://${location.host}`);
  ws.onopen=()=>ws.send(JSON.stringify({t:'join',name,team:team==='auto'?null:team}));
  ws.onmessage=(ev)=>{
    let msg; try{msg=JSON.parse(ev.data);}catch(e){return;}
    if(msg.t==='welcome'){ myId=msg.id; mode='lan'; snapBuf=[]; lastRoundSeen=0; predicted=null; enterGameUI(); }
    else if(msg.t==='snap'){ pushSnapshot(msg.snap); }
  };
  ws.onerror=()=>{ alert('Не удалось подключиться к серверу. Убедитесь, что страница открыта через игровой сервер (npm start), или играйте в режиме с ботами.'); };
  ws.onclose=()=>{ if(mode==='lan'){ /* stay in game view; user can exit to menu */ } };
}
function enterGameUI(){
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('pcName').textContent=($('nick').value.trim()||'OPERATOR').toUpperCase();
}
function exitToMenu(){
  if(ws){ try{ws.close();}catch(e){} ws=null; }
  localGame=null; mode='menu'; myId=null; snapBuf=[];
  $('hud').classList.add('hidden'); $('buyMenu').classList.add('hidden'); buyOpen=false;
  $('menu').classList.remove('hidden');
}
$('btnLocal').onclick=startLocal;
$('btnLan').onclick=startLan;
$('menuBtn').onclick=exitToMenu;
$('muteBtn').onclick=()=>{ muted=!muted; $('muteBtn').textContent=muted?'🔇':'🔊'; };

/* ---------- rendering ---------- */
function drawOperator(c,p,time){
  const isCT=p.team==='CT';
  // shadow
  c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p.x+3,p.y+5,12,9,0,0,7); c.fill();
  c.save(); c.translate(p.x,p.y);
  if(!p.alive){
    // corpse: rotated, slumped
    const hash=[...p.id].reduce((a,ch)=>a+ch.charCodeAt(0),0);
    c.rotate(p.angle + (hash%10)/10*1.4);
    c.fillStyle=isCT?'#232a33':'#463f30'; c.beginPath(); c.ellipse(0,0,13,9.5,0,0,7); c.fill();
    c.fillStyle=isCT?'#2c3540':'#554a36'; c.beginPath(); c.arc(5,0,6,0,7); c.fill();
    c.fillStyle='#191d22'; c.fillRect(6,9,17,3.2); // dropped rifle beside
    c.restore(); return;
  }
  c.rotate(p.angle);
  // legs stepping
  let ph=walkPhase.get(p.id)||0;
  if(p.speed>15){ ph+=p.speed*0.055; walkPhase.set(p.id,ph); }
  const stepA=Math.sin(ph)*4.5*(p.speed>15?1:0);
  c.fillStyle=isCT?'#1b2129':'#3a3428';
  c.beginPath(); c.ellipse(-7+stepA,5.5,4.6,3.2,0,0,7); c.fill();
  c.beginPath(); c.ellipse(-7-stepA,-5.5,4.6,3.2,0,0,7); c.fill();
  // rifle
  const wkey=p.grenadeSel?null:p.weapon;
  const gunLen={pistol:12,smg:17,rifle:22,shotgun:21,awp:28}[wkey]||0;
  if(wkey){
    c.fillStyle='#14171b'; c.fillRect(4,2.2,gunLen,3.4);
    c.fillStyle='#22262c'; c.fillRect(10,4.8,4,2.6); // mag
    if(wkey==='awp'){ c.fillStyle='#0e1114'; c.fillRect(12,2.6,7,2.6); }
  } else {
    c.fillStyle='#3f4a35'; c.beginPath(); c.arc(11,5,3.2,0,7); c.fill(); // grenade in hand
  }
  // shoulders / arms
  const uniform=isCT?'#2a333f':'#57503c', vest=isCT?'#20262f':'#453e2e';
  c.fillStyle=uniform;
  c.beginPath(); c.arc(2,9,5.2,0,7); c.fill();
  c.beginPath(); c.arc(2,-9,5.2,0,7); c.fill();
  c.beginPath(); c.arc(9,4.5,3.4,0,7); c.fill(); // hands to gun
  c.beginPath(); c.arc(6,-1,3.2,0,7); c.fill();
  // torso + vest + backpack
  c.fillStyle=vest; c.beginPath(); c.arc(0,0,10.5,0,7); c.fill();
  c.fillStyle=isCT?'#171d25':'#39321f'; c.fillRect(-9,-6,7.5,12);
  c.fillStyle=isCT?'#3f6fb5':'#c77414'; c.fillRect(-8,-4.5,4.5,4.5); // team patch
  if(p.hasBomb){ c.fillStyle='#33291a'; c.fillRect(-10,-4,5,8); c.fillStyle='#ff4438'; c.fillRect(-9,-1,2,2); }
  // helmet
  c.fillStyle=isCT?'#333e4c':'#5a4f38'; c.beginPath(); c.arc(1.5,0,6.4,0,7); c.fill();
  c.fillStyle='rgba(255,255,255,.13)'; c.beginPath(); c.arc(3,-1.6,2.8,0,7); c.fill();
  if(!isCT){ c.strokeStyle='#8a7a4e'; c.lineWidth=1.6; c.beginPath(); c.arc(1.5,0,6.4,-0.9,0.9); c.stroke(); }
  c.restore();
}
function render(dt, now){
  ctx.fillStyle='#0a0d10'; ctx.fillRect(0,0,VW,VH);
  const snap=currentSnap();
  if(!snap||!snap.view){ drawMenuBackdrop(now); return; }
  /* camera */
  const selfP = snap.players.find(p=>p.id===myId);
  let focus = snap.view;
  let fx2=focus.x, fy2=focus.y;
  if(snap.self && snap.self.alive && predicted){ fx2=predicted.x; fy2=predicted.y; }
  cam.viewPos={x:fx2,y:fy2};
  const scoped = rmbDown && snap.self && snap.self.alive && snap.self.current==='awp';
  const targetZoom = scoped?0.72:1;
  cam.zoom=lerp(cam.zoom,targetZoom,clamp(dt*8,0,1));
  // mouse world + lookahead
  const mw = screenToWorld(mouseX,mouseY);
  const la = scoped?0.42:0.14;
  let cx=fx2+(mw.x-fx2)*la, cy=fy2+(mw.y-fy2)*la;
  cx=clamp(cx, VW/cam.zoom/2-80, WORLD_W-VW/cam.zoom/2+80);
  cy=clamp(cy, VH/cam.zoom/2-80, WORLD_H-VH/cam.zoom/2+80);
  if(VW/cam.zoom>=WORLD_W)cx=WORLD_W/2; if(VH/cam.zoom>=WORLD_H)cy=WORLD_H/2;
  cam.shake=Math.max(0,cam.shake-dt*26);
  const shx=(Math.random()*2-1)*cam.shake, shy=(Math.random()*2-1)*cam.shake;
  cam.x=cx; cam.y=cy;
  const ox=VW/2-(cx+shx)*cam.zoom, oy=VH/2-(cy+shy)*cam.zoom;

  ctx.save();
  ctx.translate(ox,oy); ctx.scale(cam.zoom,cam.zoom);
  ctx.drawImage(mapCv,0,0);
  ctx.drawImage(decalCv,0,0);
  // bomb
  if(snap.bomb&&(snap.bomb.state==='planted'||snap.bomb.state==='dropped')&&snap.bomb.x!==undefined){
    const b=snap.bomb;
    ctx.fillStyle='#2b2118'; ctx.fillRect(b.x-6,b.y-4.5,12,9);
    ctx.fillStyle='#4a3a26'; ctx.fillRect(b.x-6,b.y-4.5,12,3);
    const blink=snap.bomb.state==='planted' && Math.floor(now/(snap.bomb.timer<8?140:480))%2===0;
    ctx.fillStyle=blink?'#ff3b2e':'#7a1a14'; ctx.beginPath(); ctx.arc(b.x+2,b.y,2.2,0,7); ctx.fill();
    if(snap.bomb.state==='planted'){ /* beep */
      const sec=Math.ceil(snap.bomb.timer);
      const interval=snap.bomb.timer<8?0.5:1;
      if(Math.floor(now/ (interval*1000))!==lastBeepSecond){ lastBeepSecond=Math.floor(now/(interval*1000)); playTone(1180,0.06,0.13*sndPan(b.x,b.y).vol,'square'); }
    }
  }
  // grenades in flight
  for(const g of snap.grenades){ ctx.fillStyle='#39432f'; ctx.beginPath(); ctx.arc(g.x,g.y,3.4,0,7); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(g.x-1,g.y-3,2,2); }
  // players: corpses first
  const sorted=[...snap.players].sort((a,b)=>(a.alive?1:0)-(b.alive?1:0));
  for(const p of sorted){
    let pp=p;
    if(p.id===myId && p.alive && predicted) pp=Object.assign({},p,{x:predicted.x,y:predicted.y});
    drawOperator(ctx,pp,now);
  }
  // smoke
  for(const s of snap.smokes){
    const fade = s.t>10.5? clamp(1-(s.t-10.5)/2.5,0,1):1;
    for(let i=0;i<7;i++){
      const a=i/7*6.28+now/2600, rr=s.r*(0.35+0.4*Math.sin(now/900+i*2.1));
      const gx=s.x+Math.cos(a)*s.r*0.38, gy=s.y+Math.sin(a)*s.r*0.38;
      const g=ctx.createRadialGradient(gx,gy,2,gx,gy,Math.max(10,rr));
      g.addColorStop(0,`rgba(168,172,176,${0.5*fade})`); g.addColorStop(1,'rgba(168,172,176,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx,gy,Math.max(10,rr),0,7); ctx.fill();
    }
  }
  ctx.restore();

  /* darkness + visibility */
  drawLighting(snap, ox, oy, now);

  /* fx above darkness */
  ctx.save(); ctx.translate(ox,oy); ctx.scale(cam.zoom,cam.zoom);
  // lasers
  for(const p of snap.players){
    if(!p.alive||p.speed>45) continue;
    if(!['rifle','awp'].includes(p.weapon)) continue;
    ctx.strokeStyle='rgba(255,60,50,.28)'; ctx.lineWidth=1/cam.zoom;
    ctx.beginPath(); ctx.moveTo(p.x+Math.cos(p.angle)*24,p.y+Math.sin(p.angle)*24);
    ctx.lineTo(p.x+Math.cos(p.angle)*85,p.y+Math.sin(p.angle)*85); ctx.stroke();
  }
  // tracers
  ctx.lineCap='round';
  for(const t of fx.tracers){
    ctx.strokeStyle='rgba(255,214,130,.95)'; ctx.lineWidth=1.7/cam.zoom;
    ctx.beginPath(); ctx.moveTo(t.x-t.vx*0.012,t.y-t.vy*0.012); ctx.lineTo(t.x,t.y); ctx.stroke();
  }
  // muzzle flashes
  for(const f of fx.flashes){
    ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.angle);
    const s=f.weapon==='awp'?26:f.weapon==='shotgun'?22:16;
    ctx.fillStyle='rgba(255,190,80,.95)';
    ctx.beginPath(); ctx.moveTo(0,-3.4); ctx.lineTo(s,0); ctx.lineTo(0,3.4); ctx.lineTo(3,0); ctx.fill();
    ctx.fillStyle='rgba(255,240,200,.9)'; ctx.beginPath(); ctx.arc(2,0,3.4,0,7); ctx.fill();
    ctx.restore();
  }
  // particles
  for(const p of fx.parts){ ctx.globalAlpha=clamp(1-p.life/p.max,0,1); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
  ctx.globalAlpha=1;
  // names + hp + channel rings (teammates/self view)
  ctx.textAlign='center'; ctx.font='600 10px Arial';
  for(const p of snap.players){
    if(!p.alive) continue;
    const mine = snap.self && p.team===snap.self.team;
    if(mine && p.id!==myId){
      ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillText(p.name,p.x+1,p.y-19);
      ctx.fillStyle=p.team==='CT'?'#a9cbf0':'#f2cd90'; ctx.fillText(p.name,p.x,p.y-20);
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(p.x-12,p.y-17,24,3.4);
      ctx.fillStyle=p.hp>35?'#7dc24a':'#e05244'; ctx.fillRect(p.x-12,p.y-17,24*clamp(p.hp/100,0,1),3.4);
    }
    if(p.channel){
      ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2.6/cam.zoom;
      ctx.beginPath(); ctx.arc(p.x,p.y,17,0,7); ctx.stroke();
      ctx.strokeStyle=p.channel.type==='plant'?'#ffb347':'#7fb2e8';
      ctx.beginPath(); ctx.arc(p.x,p.y,17,-Math.PI/2,-Math.PI/2+ (p.channel.t/p.channel.need)*Math.PI*2); ctx.stroke();
    }
  }
  ctx.restore();

  /* damage direction + crosshair */
  if(snap.self && snap.self.alive && snap.self.lastDamageAngle!==undefined && (snap.t - snap.self.lastDamageT)<0.9 && cam.viewPos){
    const sp=worldToScreen(cam.viewPos.x,cam.viewPos.y);
    ctx.strokeStyle=`rgba(229,57,47,${0.85*(1-(snap.t-snap.self.lastDamageT)/0.9)})`; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(sp.x,sp.y,30,snap.self.lastDamageAngle-0.6,snap.self.lastDamageAngle+0.6); ctx.stroke();
  }
  if(mode!=='menu') drawCrosshair(snap, scoped);
  updateFx(dt);
}
function drawMenuBackdrop(now){
  // slow pan over map behind menu
  const px=WORLD_W/2+Math.cos(now/9000)*220, py=WORLD_H/2+Math.sin(now/11000)*150;
  ctx.save(); ctx.translate(VW/2-px,VH/2-py);
  ctx.globalAlpha=0.4; ctx.drawImage(mapCv,0,0); ctx.globalAlpha=1; ctx.restore();
}
function worldToScreen(x,y){ return { x: VW/2+(x-cam.x)*cam.zoom, y: VH/2+(y-cam.y)*cam.zoom }; }
function screenToWorld(x,y){ return { x: cam.x+(x-VW/2)/cam.zoom, y: cam.y+(y-VH/2)/cam.zoom }; }
function drawLighting(snap, ox, oy, now){
  if(lightCv.width!==VW||lightCv.height!==VH){ lightCv.width=VW; lightCv.height=VH; }
  const lc=lightCtx; lc.setTransform(1,0,0,1,0,0); lc.globalCompositeOperation='source-over';
  lc.clearRect(0,0,VW,VH);
  lc.fillStyle='rgba(4,7,12,0.60)'; lc.fillRect(0,0,VW,VH);
  lc.translate(ox,oy); lc.scale(cam.zoom,cam.zoom);
  lc.globalCompositeOperation='destination-out';
  const vp=cam.viewPos;
  const viewP=snap.players.find(p=>p.id===snap.view.id);
  const blind = snap.self && snap.self.alive && snap.self.blindT>0;
  const radius = blind? 90 : 690;
  const poly=visibilityPoly(vp.x,vp.y,radius);
  const grad=lc.createRadialGradient(vp.x,vp.y,40,vp.x,vp.y,radius);
  grad.addColorStop(0,'rgba(0,0,0,0.97)'); grad.addColorStop(0.72,'rgba(0,0,0,0.9)'); grad.addColorStop(1,'rgba(0,0,0,0)');
  lc.fillStyle=grad;
  lc.beginPath(); lc.moveTo(vp.x,vp.y);
  for(const h of poly) lc.lineTo(h.x,h.y);
  lc.closePath(); lc.fill();
  // flashlight cone
  if(viewP && viewP.alive && !blind){
    const fg=lc.createRadialGradient(vp.x,vp.y,10,vp.x,vp.y,400);
    fg.addColorStop(0,'rgba(0,0,0,0.95)'); fg.addColorStop(1,'rgba(0,0,0,0)');
    lc.fillStyle=fg;
    lc.beginPath(); lc.moveTo(vp.x,vp.y);
    lc.arc(vp.x,vp.y,400,viewP.angle-0.34,viewP.angle+0.34); lc.closePath(); lc.fill();
  }
  // dynamic lights
  for(const L of fx.lights){
    const a=L.strength*clamp(1-L.t/L.max,0,1);
    const g=lc.createRadialGradient(L.x,L.y,2,L.x,L.y,L.r);
    g.addColorStop(0,`rgba(0,0,0,${a})`); g.addColorStop(1,'rgba(0,0,0,0)');
    lc.fillStyle=g; lc.beginPath(); lc.arc(L.x,L.y,L.r,0,7); lc.fill();
  }
  lc.setTransform(1,0,0,1,0,0); lc.globalCompositeOperation='source-over';
  ctx.drawImage(lightCv,0,0);
}
function drawCrosshair(snap, scoped){
  const sp={x:mouseX,y:mouseY};
  const gap = scoped?3:6, len=scoped?10:7;
  ctx.strokeStyle='rgba(140,255,140,.9)'; ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.moveTo(sp.x-gap-len,sp.y); ctx.lineTo(sp.x-gap,sp.y);
  ctx.moveTo(sp.x+gap,sp.y); ctx.lineTo(sp.x+gap+len,sp.y);
  ctx.moveTo(sp.x,sp.y-gap-len); ctx.lineTo(sp.x,sp.y-gap);
  ctx.moveTo(sp.x,sp.y+gap); ctx.lineTo(sp.x,sp.y+gap+len);
  ctx.stroke();
  ctx.fillStyle='rgba(140,255,140,.9)'; ctx.fillRect(sp.x-0.8,sp.y-0.8,1.6,1.6);
  if(scoped){ ctx.strokeStyle='rgba(140,255,140,.35)'; ctx.beginPath(); ctx.arc(sp.x,sp.y,26,0,7); ctx.stroke(); }
  $('hitmarker').classList.toggle('hidden', performance.now()-hitmarkT>110);
}
function updateFx(dt){
  for(let i=fx.tracers.length-1;i>=0;i--){ const t=fx.tracers[i];
    t.x+=t.vx*dt; t.y+=t.vy*dt; t.life-=dt;
    const tt=S.tileAt(t.x,t.y);
    if(t.life<=0||tt===S.T_WALL||tt===S.T_CRATE||tt===S.T_RACK) fx.tracers.splice(i,1);
  }
  for(let i=fx.parts.length-1;i>=0;i--){ const p=fx.parts[i]; p.life+=dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt; const dr=Math.pow(0.02,dt*p.drag/3); p.vx*=dr; p.vy*=dr;
    if(p.life>=p.max) fx.parts.splice(i,1);
  }
  if(fx.parts.length>700) fx.parts.splice(0,fx.parts.length-700);
  for(let i=fx.flashes.length-1;i>=0;i--){ fx.flashes[i].t+=dt; if(fx.flashes[i].t>0.05) fx.flashes.splice(i,1); }
  for(let i=fx.lights.length-1;i>=0;i--){ fx.lights[i].t+=dt; if(fx.lights[i].t>=fx.lights[i].max) fx.lights.splice(i,1); }
}

/* ---------- HUD ---------- */
const hudCache={};
function setText(id,txt){ if(hudCache[id]!==txt){ hudCache[id]=txt; $(id).textContent=txt; } }
function fmtTime(sec){ sec=Math.max(0,Math.ceil(sec)); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }
function updateHUD(snap){
  if(!snap||!snap.self) return;
  const me=snap.self;
  setText('scoreCT',String(snap.score.CT)); setText('scoreT',String(snap.score.T));
  setText('roundLabel','РАУНД '+snap.round+(snap.phase==='freeze'?' · ПОДГОТОВКА':''));
  const timerEl=$('timer');
  if(snap.bomb&&snap.bomb.state==='planted'){ setText('timer',fmtTime(snap.bomb.timer)); timerEl.classList.add('bombT'); }
  else { setText('timer',fmtTime(snap.phaseT)); timerEl.classList.remove('bombT'); }
  setText('aliveCT','CT '+snap.aliveCount.CT); setText('aliveT',snap.aliveCount.T+' T');
  // mission text
  let mission;
  if(snap.bomb&&snap.bomb.state==='planted') mission = me.team==='CT' ? `Обезвредьте бомбу · точка ${snap.bomb.site}` : `Защищайте бомбу · точка ${snap.bomb.site}`;
  else if(me.team==='CT') mission='Защищайте точки A «Серверная» и B «Архив»';
  else mission = me.hasBomb ? 'У вас бомба! Установите её на A или B (E)' : 'Установите бомбу на точке A или B';
  setText('missionText',mission);
  // player card
  setText('hpVal',String(me.hp)); setText('armVal',String(me.armor));
  $('hpBar').style.width=clamp(me.hp,0,100)+'%';
  $('hpBar').style.background=me.hp>55?'#7dc24a':me.hp>28?'#e0b03c':'#e05244';
  $('armBar').style.width=clamp(me.armor,0,100)+'%';
  setText('money','$'+me.money+(me.canBuy?' · B — закуп':''));
  $('lowHpFx').style.opacity = (me.alive&&me.hp<40)? (0.35+0.3*Math.sin(performance.now()/240))*(1-me.hp/40)+0.25 : 0;
  // flash blindness
  const bl=me.blindT||0;
  $('flashFx').style.opacity = me.alive? clamp(bl/1.6,0,1)*(me.blindFull?1:0.75) : 0;
  // weapon
  const selfP=snap.players.find(p=>p.id===myId);
  if(me.grenadeSel){ setText('wpnName','ГРАНАТА · '+ITEMS[me.grenadeSel].name.toUpperCase()); setText('ammoMag','1'); setText('ammoRes',''); }
  else if(selfP){
    setText('wpnName', itemName(me.current,me.team));
    setText('ammoMag', selfP.ammo===null?'—':String(selfP.ammo));
    setText('ammoRes', selfP.reserve===null?'':String(selfP.reserve));
  }
  $('ammo').classList.toggle('low', !!(selfP&&selfP.ammo!==null&&selfP.ammo<=3));
  $('reloadHint').classList.toggle('hidden', !(selfP&&selfP.reloading));
  const nades=['he','smoke','flash'].filter(k=>me.grenades[k]).map(k=>({he:'HE',smoke:'SMOKE',flash:'FLASH'}[k])+(me.grenadeSel===k?'◂':'')).join(' · ');
  setText('nades', nades? '3: '+nades : (me.hasKit?'САПЁРНЫЙ НАБОР':''));
  // center messages
  const cm=$('centerMsg');
  if(snap.phase==='end'){ cm.textContent=snap.winnerText.toUpperCase(); cm.style.color = snap.winnerText.startsWith('Спецназ')?'#a9cbf0':'#f2cd90'; cm.classList.remove('hidden'); }
  else if(snap.phase==='freeze'){ cm.textContent='РАУНД '+snap.round; cm.style.color='#e8eef4'; cm.classList.remove('hidden'); }
  else cm.classList.add('hidden');
  if(performance.now()>centerFlashUntil && snap.phase!=='end') $('subMsg').classList.add('hidden');
  if(snap.phase==='freeze'&&me.canBuy){ const el=$('subMsg'); el.textContent='B — меню закупа'; el.style.color='#a5d66d'; el.classList.remove('hidden'); }
  // channel progress (self)
  const pw=$('progressWrap');
  if(me.channel){ pw.classList.remove('hidden');
    setText('progressLabel', me.channel.type==='plant'?'УСТАНОВКА БОМБЫ':'ОБЕЗВРЕЖИВАНИЕ');
    $('progressBar').style.width=(me.channel.t/me.channel.need*100)+'%';
  } else pw.classList.add('hidden');
  // spectate
  const sl=$('specLabel');
  if(me.spectating){ sl.textContent='💀 ВЫ УБИТЫ · Наблюдение: '+me.spectating.name+' · Пробел/ЛКМ — следующий'; sl.classList.remove('hidden'); }
  else if(!me.alive && snap.phase==='live'){ sl.textContent='💀 ВЫ УБИТЫ · Возрождение в следующем раунде'; sl.classList.remove('hidden'); }
  else sl.classList.add('hidden');
  // buy refresh
  if(buyOpen){ if(!me.canBuy) toggleBuy(false); else renderBuy(); }
  // scoreboard
  $('scoreboard').classList.toggle('hidden',!boardOpen);
  if(boardOpen) renderBoard(snap);
  drawMinimap(snap);
}
function renderBoard(snap){
  const mk=(team)=>{
    let html='<tr><th>Игрок</th><th class="num">У</th><th class="num">С</th><th class="num">$</th></tr>';
    for(const p of snap.board.filter(b=>b.team===team)){
      html+=`<tr class="${p.alive?'':'dead'} ${p.id===myId?'me':''}"><td>${esc(p.name)}${p.isBot?' <span class="dim">[BOT]</span>':''}</td><td class="num">${p.kills}</td><td class="num">${p.deaths}</td><td class="num">${p.money===null?'—':p.money}</td></tr>`;
    }
    return html;
  };
  const a=mk('CT'), b=mk('T');
  if(hudCache.sbCT!==a){hudCache.sbCT=a;$('sbCT').innerHTML=a;}
  if(hudCache.sbT!==b){hudCache.sbT=b;$('sbT').innerHTML=b;}
}
function drawMinimap(snap){
  const c=$('minimap').getContext('2d');
  c.drawImage(miniBase,0,0);
  const sx=x=>x/WORLD_W*240, sy=y=>y/WORLD_H*160;
  if(snap.bomb&&snap.bomb.state==='planted'&&snap.bomb.x!==undefined){
    const blink=Math.floor(performance.now()/300)%2===0;
    c.fillStyle=blink?'#ff3b2e':'#ffb347'; c.font='900 10px Arial'; c.textAlign='center';
    c.fillText('✸',sx(snap.bomb.x),sy(snap.bomb.y)+3);
  } else if(snap.bomb&&snap.bomb.state==='dropped'&&snap.bomb.x!==undefined){
    c.fillStyle='#ffb347'; c.fillRect(sx(snap.bomb.x)-2,sy(snap.bomb.y)-2,4,4);
  }
  for(const blip of snap.radar){
    const x=sx(blip.x), y=sy(blip.y);
    if(blip.self){
      c.save(); c.translate(x,y); c.rotate(blip.angle);
      c.fillStyle='#fff'; c.beginPath(); c.moveTo(5,0); c.lineTo(-3.4,-3); c.lineTo(-3.4,3); c.closePath(); c.fill(); c.restore();
    } else {
      const friendly = snap.self && blip.team===snap.self.team;
      c.fillStyle = friendly? (blip.team==='CT'?'#7fb2e8':'#f2b04e') : '#ff5347';
      c.beginPath(); c.arc(x,y,friendly?2.6:3,0,7); c.fill();
      if(blip.bomb){ c.fillStyle='#ffb347'; c.fillRect(x-1.4,y-5.4,2.8,2.8); }
    }
  }
}

/* ---------- prediction (own movement) ---------- */
function updatePrediction(dt, snap, inp){
  if(!snap||!snap.self||!snap.self.alive){ predicted=null; return; }
  const selfP=snap.players.find(p=>p.id===myId);
  if(!selfP){ predicted=null; return; }
  if(!predicted) predicted={x:selfP.x,y:selfP.y};
  const w=WEAPONS[snap.self.current]||WEAPONS.pistol;
  let sp=218*w.moveSpeed*(inp.walk?0.52:1);
  if(snap.phase==='freeze'||snap.self.channel) sp=0;
  let mx=inp.mx,my=inp.my; const ml=Math.hypot(mx,my); if(ml>1){mx/=ml;my/=ml;}
  const tmp={x:predicted.x,y:predicted.y};
  S.moveCircle(tmp, mx*sp*dt, my*sp*dt);
  predicted.x=tmp.x; predicted.y=tmp.y;
  // reconcile with authoritative
  const err=Math.hypot(predicted.x-selfP.x,predicted.y-selfP.y);
  if(err>46){ predicted.x=selfP.x; predicted.y=selfP.y; }
  else { predicted.x=lerp(predicted.x,selfP.x,clamp(dt*7,0,1)*clamp(err/46,0,1)); predicted.y=lerp(predicted.y,selfP.y,clamp(dt*7,0,1)*clamp(err/46,0,1)); }
}

/* ---------- main loop ---------- */
let lastT=performance.now(), simAcc=0, inputAcc=0;
function loop(now){
  requestAnimationFrame(loop);
  let dt=(now-lastT)/1000; lastT=now;
  dt=Math.min(dt,0.05);
  // compute aim angle from mouse & view pos
  let angle=0;
  if(cam.viewPos){ const mw=screenToWorld(mouseX,mouseY); angle=Math.atan2(mw.y-cam.viewPos.y, mw.x-cam.viewPos.x); }
  const inp=readInput(angle);

  if(mode==='local'&&localGame){
    localGame.setInput(myId,inp);
    simAcc+=dt;
    while(simAcc>=1/30){
      localGame.tick(1/30); simAcc-=1/30;
      const snap=localGame.snapshotFor(myId);
      snap.events=localGame.eventsSince(localSeq); localSeq=localGame.eventSeq;
      pushSnapshot(snap);
    }
  } else if(mode==='lan'&&ws&&ws.readyState===1&&myId){
    inputAcc+=dt;
    if(inputAcc>=1/30){ inputAcc=0; ws.send(JSON.stringify({t:'input',input:inp})); }
    else if(inp.slot) { /* ensure slot not lost */ ws.send(JSON.stringify({t:'input',input:inp})); inputAcc=0; }
  }
  const snap=currentSnap();
  if(mode!=='menu') updatePrediction(dt,snap,inp);
  render(dt,now);
  if(mode!=='menu'&&snap) updateHUD(snap);
}
requestAnimationFrame(loop);
