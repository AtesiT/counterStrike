/* SILENT ENTRY — client: rendering, input (rebindable), settings, audio, local & LAN modes */
'use strict';
const S = window.SilentEntrySim;
const { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, WEAPONS, ITEMS, MAP_LIST } = S;
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
const lerp = (a,b,t)=>a+(b-a)*t;
function angLerp(a,b,t){ let d=(b-a)%(Math.PI*2); if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return a+d*t; }
let MAP = S.getMap();
let curMapKey = MAP.key;

/* ================= settings & keybinds ================= */
const DEFAULT_BINDS = { forward:'KeyW', back:'KeyS', left:'KeyA', right:'KeyD', fire2:'Space', walk:'ShiftLeft',
  reload:'KeyR', use:'KeyE', drop:'KeyG', buy:'KeyB', slot1:'Digit1', slot2:'Digit2', slot3:'Digit3', slot4:'Digit4',
  score:'Tab', spectate:'Space', menu:'Escape' };
const BIND_ACTIONS = [
  ['forward','Вперёд'],['back','Назад'],['left','Влево'],['right','Вправо'],
  ['fire2','Огонь (клавиша)'],['walk','Тихий шаг'],['reload','Перезарядка'],['use','Действие'],
  ['drop','Выбросить оружие'],['buy','Меню закупа'],
  ['slot1','Основное оружие'],['slot2','Пистолет'],['slot3','Нож'],['slot4','Граната'],
  ['score','Таблица счёта'],['spectate','След. союзник (наблюдение)'],['menu','Меню / пауза'],
];
const settings = { renderScale:1, particles:1, lighting:true, shake:true, blood:true, dmgNum:true, fps:false, volume:50, muted:false };
let binds = Object.assign({}, DEFAULT_BINDS);
let selectedMap = 'office';
const STORE_KEY = 'silentEntryV1';
function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY); if(!raw) return;
    const d = JSON.parse(raw);
    if(d.settings) Object.assign(settings, d.settings);
    if(d.binds) binds = Object.assign({}, DEFAULT_BINDS, d.binds);
    if(d.map && MAP_LIST.some(m=>m.key===d.map)) selectedMap = d.map;
    if(d.nick) $('nick').value = d.nick;
    if(d.team) $('teamSel').value = d.team;
    if(d.diff) $('diffSel').value = d.diff;
  }catch(e){}
}
function saveStore(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify({ settings, binds, map:selectedMap,
    nick:$('nick').value, team:$('teamSel').value, diff:$('diffSel').value })); }catch(e){}
}
function prettyKey(code){
  if(!code) return '—';
  const special = { Space:'Пробел', ShiftLeft:'Shift', ShiftRight:'Shift', ControlLeft:'Ctrl', ControlRight:'Ctrl',
    AltLeft:'Alt', AltRight:'Alt', Escape:'Esc', Tab:'Tab', CapsLock:'Caps', Enter:'Enter',
    ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', Backquote:'`' };
  if(special[code]) return special[code];
  if(code.startsWith('Key')) return code.slice(3);
  if(code.startsWith('Digit')) return code.slice(5);
  if(code.startsWith('Numpad')) return 'Num'+code.slice(6);
  return code;
}

/* ================= canvas ================= */
const cv = $('cv'), ctx = cv.getContext('2d');
let VW=0, VH=0, DPR=1;
function resize(){
  VW=innerWidth; VH=innerHeight; DPR=settings.renderScale||1;
  cv.width=Math.round(VW*DPR); cv.height=Math.round(VH*DPR);
  cv.style.width=VW+'px'; cv.style.height=VH+'px';
}
addEventListener('resize', resize);
const lightCv = document.createElement('canvas'), lightCtx = lightCv.getContext('2d');

/* ================= map assets (rebuilt per map) ================= */
const mapCv = document.createElement('canvas'); mapCv.width=WORLD_W; mapCv.height=WORLD_H;
const decalCv = document.createElement('canvas'); decalCv.width=WORLD_W; decalCv.height=WORLD_H;
const dctx = decalCv.getContext('2d');
const FLOOR_COLORS = {
  tile:['#565b60','#50555a'], carpet:['#3d454e','#39414a'], concrete:['#4c4c4c','#474747'], wood:['#5d4a36','#57452f'],
  sand:['#a98f5f','#a18558'], stone:['#6d6a63','#65625c'], snow:['#c9d2d9','#bfc9d2'], ice:['#9fb9c9','#93aec2'],
  grass:['#4d6039','#475a34'], mud:['#5a4936','#53422f'], water:['#33566b','#2f4f63'],
};
function buildMapCanvas(){
  const c = mapCv.getContext('2d'); const r = S.mulberry(777);
  c.setTransform(1,0,0,1,0,0);
  c.fillStyle='#14161a'; c.fillRect(0,0,WORLD_W,WORLD_H);
  const decor = S.computeDecor();
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    const t=MAP.grid[y*MAP_W+x]; if(t===S.T_WALL) continue;
    const ftype=MAP.floor[y*MAP_W+x];
    const f=FLOOR_COLORS[ftype]||FLOOR_COLORS.concrete;
    c.fillStyle = ((x+y)%2===0)?f[0]:f[1];
    c.fillRect(x*TILE,y*TILE,TILE,TILE);
    c.fillStyle='rgba(0,0,0,0.14)'; c.fillRect(x*TILE,y*TILE+TILE-1,TILE,1); c.fillRect(x*TILE+TILE-1,y*TILE,1,TILE);
    for(let i=0;i<5;i++){ c.fillStyle = r()<0.5?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.05)'; c.fillRect(x*TILE+r()*30,y*TILE+r()*30,2,2); }
    if(ftype==='wood'){ c.fillStyle='rgba(0,0,0,0.2)'; c.fillRect(x*TILE,y*TILE+10,TILE,1); c.fillRect(x*TILE,y*TILE+21,TILE,1); }
    if(ftype==='water'){ c.strokeStyle='rgba(255,255,255,0.10)'; c.lineWidth=1.2; c.beginPath(); c.arc(x*TILE+8+r()*14, y*TILE+16, 7, 0.2, 2.4); c.stroke(); }
    if(ftype==='ice'){ c.strokeStyle='rgba(255,255,255,0.16)'; c.lineWidth=1; c.beginPath(); c.moveTo(x*TILE+r()*20,y*TILE+r()*10); c.lineTo(x*TILE+10+r()*20,y*TILE+16+r()*12); c.stroke(); }
    if(ftype==='grass'){ c.fillStyle='rgba(20,40,14,0.25)'; c.fillRect(x*TILE+r()*26,y*TILE+r()*26,3,2); c.fillRect(x*TILE+r()*26,y*TILE+r()*26,2,3); }
  }
  for(const d of decor){
    if(d.k==='paper'){ c.save(); c.translate(d.x,d.y); c.rotate(d.a); c.fillStyle='rgba(214,214,206,.7)'; c.fillRect(-4,-3,8,6); c.restore(); }
    else if(d.k==='stain'){ c.fillStyle='rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(d.x,d.y,d.r,d.r*0.7,0,0,7); c.fill(); }
  }
  // bomb sites
  if(MAP.sites) for(const k of ['A','B']){
    const s=MAP.sites[k];
    c.strokeStyle='rgba(216,84,60,.55)'; c.lineWidth=2; c.setLineDash([9,7]);
    c.strokeRect(s.cx-s.r, s.cy-s.r, s.r*2, s.r*2); c.setLineDash([]);
    c.fillStyle='rgba(216,84,60,.4)'; c.font='900 54px Arial'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(k, s.cx, s.cy);
    c.font='700 11px Arial'; c.fillStyle='rgba(230,230,220,.45)';
    c.fillText(s.name.toUpperCase(), s.cx, s.cy+s.r-11);
  }
  // rescue zone + hostage homes
  if(MAP.rescue){
    c.strokeStyle='rgba(110,210,90,.65)'; c.lineWidth=2.4; c.setLineDash([10,7]);
    c.beginPath(); c.arc(MAP.rescue.x,MAP.rescue.y,MAP.rescue.r,0,7); c.stroke(); c.setLineDash([]);
    c.fillStyle='rgba(140,230,120,.55)'; c.font='900 19px Arial'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText('ЭВАКУАЦИЯ', MAP.rescue.x, MAP.rescue.y);
  }
  for(const h of (MAP.hostages||[])){
    c.strokeStyle='rgba(240,170,70,.6)'; c.lineWidth=1.6; c.setLineDash([5,4]);
    c.strokeRect(h.x-13,h.y-13,26,26); c.setLineDash([]);
  }
  c.font='700 10px Arial'; c.fillStyle='rgba(160,190,230,.45)'; c.textAlign='center';
  c.fillText('CT', MAP.spawns.CT[0].x, MAP.spawns.CT[0].y-16);
  c.fillStyle='rgba(240,190,110,.45)'; c.fillText('T', MAP.spawns.T[0].x, MAP.spawns.T[0].y-16);
  // objects
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
    } else if(t===S.T_TREE){
      const cx=px+TILE/2, cy=py+TILE/2;
      c.fillStyle='rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx+4,cy+6,17,13,0,0,7); c.fill();
      const snow = MAP.theme && MAP.theme.snowCaps;
      c.fillStyle = snow?'#39543e':'#2e4d2a';
      c.beginPath(); c.arc(cx,cy,17,0,7); c.fill();
      c.fillStyle = snow?'#46684c':'#386032';
      c.beginPath(); c.arc(cx-5,cy-4,11,0,7); c.fill(); c.beginPath(); c.arc(cx+6,cy+3,9,0,7); c.fill();
      if(snow){ c.fillStyle='rgba(240,246,250,.75)'; c.beginPath(); c.arc(cx-5,cy-6,5.5,0,7); c.fill(); c.beginPath(); c.arc(cx+6,cy+1,4,0,7); c.fill(); }
      c.fillStyle='#4a3826'; c.beginPath(); c.arc(cx,cy,2.6,0,7); c.fill();
    } else if(t===S.T_ROCK){
      const cx=px+TILE/2, cy=py+TILE/2; const rr=S.mulberry(x*131+y*17);
      c.fillStyle='rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx+3,cy+5,15,11,0,0,7); c.fill();
      c.fillStyle='#6e6e6e'; c.beginPath();
      for(let i=0;i<7;i++){ const a=i/7*Math.PI*2, rad=11+rr()*5; const vx=cx+Math.cos(a)*rad, vy=cy+Math.sin(a)*rad*0.85; i===0?c.moveTo(vx,vy):c.lineTo(vx,vy); }
      c.closePath(); c.fill();
      c.fillStyle='rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(cx-3,cy-3,6,4,-0.5,0,7); c.fill();
    }
  }
  for(const d of decor){ if(d.k!=='deskstuff') continue;
    if(d.mon){ c.fillStyle='#14181d'; c.fillRect(d.x+7,d.y+7,17,11); c.fillStyle='#2b3a46'; c.fillRect(d.x+8.5,d.y+8.5,14,8); }
    c.fillStyle='rgba(20,20,20,.65)'; c.fillRect(d.x+9,d.y+21,14,4.5);
    if(d.paper>0.4){ c.fillStyle='rgba(218,218,208,.85)'; c.fillRect(d.x+3,d.y+6,7,9); }
  }
  // walls (shadow pass, then body)
  const theme = MAP.theme||{wall:'#3d434c',wallDark:'#2c3036'};
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    if(MAP.grid[y*MAP_W+x]!==S.T_WALL) continue;
    if(y+1<MAP_H && MAP.grid[(y+1)*MAP_W+x]!==S.T_WALL){ c.fillStyle='rgba(0,0,0,.32)'; c.fillRect(x*TILE,(y+1)*TILE,TILE,7); }
    if(x+1<MAP_W && MAP.grid[y*MAP_W+x+1]!==S.T_WALL){ c.fillStyle='rgba(0,0,0,.18)'; c.fillRect((x+1)*TILE,y*TILE,5,TILE); }
  }
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    if(MAP.grid[y*MAP_W+x]!==S.T_WALL) continue;
    const px=x*TILE, py=y*TILE;
    c.fillStyle=theme.wallDark; c.fillRect(px,py,TILE,TILE);
    c.fillStyle=theme.wall; c.fillRect(px+1.5,py+1.5,TILE-3,TILE-3);
    c.fillStyle = theme.snowCaps?'rgba(240,246,250,.55)':'rgba(255,255,255,.05)';
    c.fillRect(px+1.5,py+1.5,TILE-3,3);
  }
}
const miniBase=document.createElement('canvas'); miniBase.width=240; miniBase.height=160;
function buildMiniBase(){
  const c=miniBase.getContext('2d'); const k=5;
  c.fillStyle='#0d1622'; c.fillRect(0,0,240,160);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){ const t=MAP.grid[y*MAP_W+x];
    c.fillStyle = t===S.T_WALL?'#54687e':(t===S.T_FLOOR?'#1b2836':'#2a3a4c');
    c.fillRect(x*k,y*k,k,k); }
  c.font='900 11px Arial'; c.textAlign='center';
  if(MAP.sites){ c.fillStyle='rgba(255,120,90,.9)';
    c.fillText('A', MAP.sites.A.cx/WORLD_W*240, MAP.sites.A.cy/WORLD_H*160+4);
    c.fillText('B', MAP.sites.B.cx/WORLD_W*240, MAP.sites.B.cy/WORLD_H*160+4); }
  if(MAP.rescue){ c.strokeStyle='#6ed25a'; c.lineWidth=1.4;
    c.beginPath(); c.arc(MAP.rescue.x/WORLD_W*240, MAP.rescue.y/WORLD_H*160, MAP.rescue.r/WORLD_W*240,0,7); c.stroke(); }
  for(const h of (MAP.hostages||[])){ c.fillStyle='#f0aa46'; c.fillRect(h.x/WORLD_W*240-2, h.y/WORLD_H*160-2, 4, 4); }
}
let segments=[];
function buildSegments(){
  segments=[];
  const vb=(x,y)=>S.visionTile(x,y);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    if(!vb(x,y)) continue;
    const px=x*TILE, py=y*TILE;
    if(!vb(x,y-1)) segments.push([px,py,px+TILE,py]);
    if(!vb(x,y+1)) segments.push([px,py+TILE,px+TILE,py+TILE]);
    if(!vb(x-1,y)) segments.push([px,py,px,py+TILE]);
    if(!vb(x+1,y)) segments.push([px+TILE,py,px+TILE,py+TILE]);
  }
}
function applyMap(key){
  if(S.getMap().key!==key) S.setMap(key);
  MAP=S.getMap(); curMapKey=MAP.key;
  buildMapCanvas(); buildMiniBase(); buildSegments();
  dctx.clearRect(0,0,WORLD_W,WORLD_H);
  $('minimapLabel').textContent = MAP.name.toUpperCase() + (MAP.mode==='hostage'?' · ЗАЛОЖНИКИ':' · БОМБА');
}
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

/* ================= audio ================= */
let AC=null, master=null, noiseBuf=null;
function initAudio(){
  if(AC) return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain(); master.gain.value=settings.volume/100; master.connect(AC.destination);
    noiseBuf=AC.createBuffer(1, AC.sampleRate*0.5, AC.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }catch(e){ AC=null; }
}
function sndPan(x,y){
  if(!cam.viewPos) return {vol:0.6,pan:0};
  const d=Math.hypot(x-cam.viewPos.x,y-cam.viewPos.y);
  return { vol: clamp(1-d/950,0,1), pan: clamp((x-cam.viewPos.x)/500,-0.8,0.8) };
}
function playNoise(dur,freq,vol,type,x,y){
  if(!AC||settings.muted||vol<=0.01) return;
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
  if(!AC||settings.muted) return;
  const t=AC.currentTime+(when||0);
  const o=AC.createOscillator(); o.type=type||'sine'; o.frequency.value=freq;
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.02);
}
const SHOT_PARAMS={ pistol:[0.14,2600,0.5], deagle:[0.22,1700,0.8], smg:[0.11,3000,0.42], p90:[0.1,3200,0.38],
  famas:[0.15,2400,0.55], rifle:[0.17,2200,0.62], shotgun:[0.3,1400,0.85], scout:[0.35,1300,0.9], awp:[0.45,1100,1.0] };
function shotSound(weapon,x,y){
  const pr=SHOT_PARAMS[weapon]||SHOT_PARAMS.rifle;
  const v=sndPan(x,y).vol;
  playNoise(pr[0],pr[1],pr[2]*v,'lowpass',x,y);
  playNoise(0.05,5200,pr[2]*0.5*v,'highpass',x,y);
}
function addShake(v){ if(settings.shake) cam.shake=Math.max(cam.shake,v); }

/* ================= game state ================= */
let mode='menu';
let localGame=null, localSeq=0, myId=null, ws=null;
let snapBuf=[];
let lastRoundSeen=-1;
const cam={ x:WORLD_W/2, y:WORLD_H/2, zoom:1, viewPos:null, shake:0 };
const fx={ tracers:[], parts:[], flashes:[], lights:[], floaters:[], slashes:[] };
const hitFlashes=new Map();
const walkPhase=new Map();
let predicted=null;
let lastBeepSecond=-1, hitmarkT=0, lastAim=0;

function pushSnapshot(snap){
  if(snap.map && snap.map.key!==curMapKey){
    applyMap(snap.map.key);
    snapBuf=[]; predicted=null;
    fx.tracers.length=0; fx.parts.length=0; fx.floaters.length=0; fx.slashes.length=0;
    centerFlash('КАРТА: '+snap.map.name.toUpperCase(), '#cfe0ef');
  }
  snapBuf.push({at:performance.now(), snap});
  if(snapBuf.length>12) snapBuf.splice(0,snapBuf.length-12);
  if(snap.round!==lastRoundSeen){ lastRoundSeen=snap.round; dctx.clearRect(0,0,WORLD_W,WORLD_H); }
  if(snap.events) for(const e of snap.events) handleEvent(e, snap);
}
function currentSnap(){
  if(!snapBuf.length) return null;
  const target=performance.now()-110;
  let a=snapBuf[0];
  for(let i=0;i<snapBuf.length;i++){ if(snapBuf[i].at<=target) a=snapBuf[i]; }
  const idx=snapBuf.indexOf(a);
  const b=snapBuf[Math.min(idx+1,snapBuf.length-1)];
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
  if(A.hostages&&B.hostages){
    const hA=new Map(A.hostages.map(h=>[h.id,h]));
    out.hostages=B.hostages.map(hb=>{ const ha=hA.get(hb.id); return ha?Object.assign({},hb,{x:lerp(ha.x,hb.x,t),y:lerp(ha.y,hb.y,t)}):hb; });
  }
  if(A.view&&B.view) out.view=Object.assign({},B.view,{x:lerp(A.view.x,B.view.x,t),y:lerp(A.view.y,B.view.y,t)});
  return out;
}

/* ================= events -> fx ================= */
function decal(x,y,draw){ dctx.save(); dctx.translate(x,y); draw(dctx); dctx.restore(); }
function spawnParts(x,y,n,opt){
  n=Math.max(1,Math.round(n*(settings.particles||1)));
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
        fx.parts.push({x:e.x,y:e.y,vx:Math.cos(e.angle+2.2)*40,vy:Math.sin(e.angle+2.2)*40,life:0,max:0.5,size:1.6,color:'#c9a227',drag:4});
      }
      break; }
    case 'knife': {
      playNoise(0.09,5200,0.3*sndPan(e.x,e.y).vol,'highpass',e.x,e.y);
      const p=snap.players.find(q=>q.id===e.id);
      if(p) fx.slashes.push({x:e.x,y:e.y,angle:p.angle,t:0});
      if(e.id===myId&&e.hit){ hitmarkT=performance.now(); playTone(700,0.06,0.18,'square'); }
      break; }
    case 'impact': {
      if(e.kind==='wall'){ spawnParts(e.x,e.y,4,{colors:['#9aa0a6','#c7b299','#6e6e6e'],sp1:70,life:0.3});
        decal(e.x,e.y,c=>{c.fillStyle='rgba(15,15,15,.55)';c.beginPath();c.arc(0,0,1.6,0,7);c.fill();}); }
      else {
        spawnParts(e.x,e.y,7,{colors:settings.blood?['#7d1212','#5d0d0d','#931818']:['#ffb347','#ffd27a','#ffffff'],sp1:80,life:0.35,size:2.4});
        if(e.victim) hitFlashes.set(e.victim, performance.now());
        if(e.shooter===myId){
          hitmarkT=performance.now(); playTone(1400,0.05,0.16,'square');
          if(settings.dmgNum && e.dmg) fx.floaters.push({x:e.x+(Math.random()*10-5),y:e.y-12,txt:String(e.dmg),life:0,max:0.75,big:e.dmg>=50});
        }
      }
      break; }
    case 'kill': {
      killfeed(e);
      if(settings.blood) decal(e.x,e.y,c=>{ for(let i=0;i<5;i++){ c.fillStyle=`rgba(96,10,10,${0.16+Math.random()*0.14})`; c.beginPath(); c.ellipse((Math.random()-0.5)*16,(Math.random()-0.5)*16,6+Math.random()*11,5+Math.random()*8,Math.random()*3,0,7); c.fill(); } });
      if(e.killer===myId) playTone(880,0.09,0.2,'square');
      if(e.victim===myId){ playTone(160,0.5,0.3,'sawtooth'); addShake(7); }
      break; }
    case 'explosion': case 'bombBoom': {
      const big=e.type==='bombBoom';
      playNoise(big?1.1:0.55, big?300:520, 1.0*sndPan(e.x,e.y).vol,'lowpass',e.x,e.y);
      fx.lights.push({x:e.x,y:e.y,r:big?430:240,t:0,max:0.28,strength:1});
      spawnParts(e.x,e.y,big?60:30,{colors:['#ffb347','#ff7b2d','#8a8a8a','#555'],sp0:60,sp1:big?420:260,life:0.7,size:3});
      decal(e.x,e.y,c=>{ const g=c.createRadialGradient(0,0,2,0,0,big?90:52); g.addColorStop(0,'rgba(8,8,8,.7)'); g.addColorStop(1,'rgba(8,8,8,0)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,big?90:52,0,7); c.fill(); });
      if(cam.viewPos){ const d=Math.hypot(e.x-cam.viewPos.x,e.y-cam.viewPos.y); addShake(clamp(16-d/45,0,15)); }
      break; }
    case 'flashPop': playNoise(0.3,3800,0.5*sndPan(e.x,e.y).vol,'highpass',e.x,e.y); fx.lights.push({x:e.x,y:e.y,r:300,t:0,max:0.18,strength:1}); break;
    case 'smokePop': playNoise(0.5,900,0.25*sndPan(e.x,e.y).vol,'lowpass',e.x,e.y); break;
    case 'reload': if(e.id===myId){ playTone(500,0.05,0.12,'square'); playTone(700,0.05,0.12,'square',0.22);} break;
    case 'drop': if(e.id===myId) playTone(380,0.05,0.12,'square'); break;
    case 'pickup': if(e.id===myId){ playTone(760,0.06,0.16,'square'); centerFlash(itemName(e.key, me?me.team:'CT'), '#cfe0ef', 1100); } break;
    case 'planted': centerFlash('БОМБА УСТАНОВЛЕНА · ТОЧКА '+e.site,'#ff8a5c'); playTone(660,0.15,0.25,'square'); playTone(660,0.15,0.25,'square',0.2); lastBeepSecond=-1; break;
    case 'defused': centerFlash('БОМБА ОБЕЗВРЕЖЕНА','#7fb2e8'); break;
    case 'untied': centerFlash(me&&me.team==='CT'?'ЗАЛОЖНИК ОСВОБОЖДЁН — ВЕДИТЕ К ЭВАКУАЦИИ':'ЗАЛОЖНИКА УВОДЯТ!', me&&me.team==='CT'?'#9fe870':'#ff8a5c'); playTone(880,0.12,0.2,'triangle'); break;
    case 'rescued': centerFlash('ЗАЛОЖНИК СПАСЁН','#9fe870'); playTone(990,0.2,0.22,'triangle'); break;
    case 'hostageDown': {
      const box=$('killfeed'); const div=document.createElement('div'); div.className='kill warn';
      div.textContent='☠ Заложник убит'+(e.byName?` (${e.byName}, штраф $1000)`:'');
      box.appendChild(div); while(box.children.length>5) box.removeChild(box.firstChild);
      setTimeout(()=>{ div.style.opacity='0'; div.style.transition='opacity .4s'; setTimeout(()=>div.remove(),420); }, 4200);
      playTone(200,0.4,0.25,'sawtooth');
      break; }
    case 'roundEnd': playTone(e.winner===(me&&me.team)?740:330, 0.35, 0.22, 'triangle'); break;
    case 'roundStart': hideCenter(); break;
    case 'live': playTone(990,0.12,0.18,'square'); break;
  }
}
let centerFlashUntil=0;
function centerFlash(text,color,ms){ const el=$('subMsg'); el.textContent=text; el.style.color=color||'#fff'; el.classList.remove('hidden'); centerFlashUntil=performance.now()+(ms||2600); }
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

/* ================= input ================= */
const keys={}; let mouseX=innerWidth/2, mouseY=innerHeight/2, mouseDown=false, rmbDown=false;
let queuedSlot=0, queuedDrop=false, buyOpen=false, boardOpen=false;
let pauseOpen=false, settingsOpen=false, settingsToPause=false, bindCapture=null;

addEventListener('keydown',e=>{
  if(bindCapture){
    e.preventDefault();
    if(!(e.code==='Escape' && bindCapture!=='menu')) assignBind(bindCapture, e.code);
    bindCapture=null; refreshBindUI();
    return;
  }
  keys[e.code]=true;
  const tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'){ if(e.code==='Escape') e.target.blur(); return; }
  if(e.code==='Tab'||e.code==='Space') e.preventDefault();
  if(e.code===binds.menu){ handleMenuKey(); return; }
  if(mode==='menu') return;
  if(e.code===binds.score) boardOpen=true;
  if(settingsOpen||pauseOpen) return;
  if(buyOpen && /^Digit[1-9]$/.test(e.code)){ buyByHotkey(parseInt(e.code.slice(5))-1); return; }
  if(e.code===binds.buy && !e.repeat) toggleBuy();
  if(e.code===binds.slot1) queuedSlot=1;
  if(e.code===binds.slot2) queuedSlot=2;
  if(e.code===binds.slot3) queuedSlot=3;
  if(e.code===binds.slot4) queuedSlot=4;
  if(e.code===binds.drop && !e.repeat) queuedDrop=true;
  if(e.code===binds.spectate){ const s=currentSnap(); if(s&&s.self&&!s.self.alive) requestSpectate(); }
});
addEventListener('keyup',e=>{ keys[e.code]=false; if(e.code===binds.score) boardOpen=false; });
addEventListener('mousemove',e=>{ mouseX=e.clientX; mouseY=e.clientY; });
addEventListener('mousedown',e=>{ initAudio(); if(AC&&AC.state==='suspended')AC.resume();
  if(e.target.closest('button,input,select,textarea,#buyMenu,#menu,#settingsModal,#pauseMenu')) return;
  if(e.button===0){ mouseDown=true; const s=currentSnap(); if(s&&s.self&&!s.self.alive) requestSpectate(); }
  if(e.button===2) rmbDown=true;
});
addEventListener('mouseup',e=>{ if(e.button===0)mouseDown=false; if(e.button===2)rmbDown=false; });
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{ for(const k in keys)keys[k]=false; mouseDown=false; rmbDown=false; });

function handleMenuKey(){
  if(settingsOpen) closeSettings();
  else if(buyOpen) toggleBuy(false);
  else if(mode!=='menu') setPause(!pauseOpen);
}
function ensureLocal(){
  let mx=0,my=0;
  if(keys[binds.forward])my-=1; if(keys[binds.back])my+=1;
  if(keys[binds.left])mx-=1; if(keys[binds.right])mx+=1;
  const walk = binds.walk && binds.walk.startsWith('Shift') ? (keys.ShiftLeft||keys.ShiftRight||false) : !!keys[binds.walk];
  const inp={ mx, my, angle:lastAim, fire:(mouseDown||!!keys[binds.fire2])&&!buyOpen, walk:!!walk,
    use:!!keys[binds.use], reload:!!keys[binds.reload], slot:queuedSlot, drop:queuedDrop };
  queuedSlot=0; queuedDrop=false;
  return inp;
}
function readInput(){
  if(pauseOpen||settingsOpen) return {mx:0,my:0,angle:lastAim,fire:false,walk:false,use:false,reload:false,slot:0,drop:false};
  return ensureLocal();
}
function requestSpectate(){
  if(mode==='local'&&localGame) localGame.cycleSpectate(myId);
  else if(mode==='lan'&&ws&&ws.readyState===1) ws.send(JSON.stringify({t:'spectate'}));
}

/* ================= buy menu ================= */
const BUY_ORDER=['deagle','smg','shotgun','famas','scout','rifle','p90','awp','armor','kit','he','smoke','flash'];
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
    if(key==='kit'&&(me.team!=='CT'||(s.map&&s.map.mode!=='bomb'))) return;
    const price=WEAPONS[key]?WEAPONS[key].price:ITEMS[key].price;
    const owned = WEAPONS[key]? me.weapons.includes(key) : (key==='armor'? me.armor>=100 : key==='kit'? me.hasKit : !!me.grenades[key]);
    const btn=document.createElement('button'); btn.className='buyItem';
    btn.disabled = owned || me.money<price || !me.canBuy;
    btn.innerHTML=`<span>${i<9?`<span class="hot">${i+1}</span>`:''}${itemName(key,me.team)}</span>`+(owned?'<span class="owned">КУПЛЕНО</span>':`<span class="price">$${price}</span>`);
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

/* ================= pause & settings UI ================= */
function setPause(v){
  pauseOpen = !!v && mode!=='menu';
  $('pauseMenu').classList.toggle('hidden',!pauseOpen);
  $('pauseNote').textContent = mode==='lan' ? 'Сетевой матч продолжается без паузы.' : 'Игра на паузе.';
  if(pauseOpen){ mouseDown=false; rmbDown=false; }
}
function openSettings(fromPause){
  settingsOpen=true; settingsToPause=!!fromPause;
  if(fromPause) $('pauseMenu').classList.add('hidden');
  $('settingsModal').classList.remove('hidden');
  syncSettingsUI();
}
function closeSettings(){
  settingsOpen=false; bindCapture=null; refreshBindUI();
  $('settingsModal').classList.add('hidden');
  if(settingsToPause && mode!=='menu' && pauseOpen) $('pauseMenu').classList.remove('hidden');
  settingsToPause=false;
  saveStore();
}
function syncSettingsUI(){
  $('setScale').value=String(settings.renderScale);
  $('setParticles').value=String(settings.particles);
  $('setLighting').checked=settings.lighting;
  $('setShake').checked=settings.shake;
  $('setBlood').checked=settings.blood;
  $('setDmgNum').checked=settings.dmgNum;
  $('setFps').checked=settings.fps;
  $('setVolume').value=settings.volume;
  $('setMute').checked=settings.muted;
  refreshBindUI();
}
function refreshBindUI(){
  const list=$('bindList'); if(!list) return;
  list.innerHTML='';
  for(const [action,label] of BIND_ACTIONS){
    const row=document.createElement('div'); row.className='bindRow';
    row.innerHTML=`<span>${label}</span>`;
    const btn=document.createElement('button');
    btn.className='bindKey'+(bindCapture===action?' capturing':'');
    btn.textContent = bindCapture===action ? 'Нажмите клавишу…' : prettyKey(binds[action]);
    btn.onclick=()=>{ bindCapture=action; refreshBindUI(); };
    row.appendChild(btn);
    list.appendChild(row);
  }
}
function assignBind(action, code){
  for(const k in binds){
    if(k!==action && binds[k]===code){
      const sharePair = (k==='fire2'&&action==='spectate')||(k==='spectate'&&action==='fire2');
      if(!sharePair) binds[k]='';
    }
  }
  binds[action]=code;
  saveStore();
}
$('setScale').onchange=e=>{ settings.renderScale=parseFloat(e.target.value); resize(); saveStore(); };
$('setParticles').onchange=e=>{ settings.particles=parseFloat(e.target.value); saveStore(); };
$('setLighting').onchange=e=>{ settings.lighting=e.target.checked; saveStore(); };
$('setShake').onchange=e=>{ settings.shake=e.target.checked; saveStore(); };
$('setBlood').onchange=e=>{ settings.blood=e.target.checked; saveStore(); };
$('setDmgNum').onchange=e=>{ settings.dmgNum=e.target.checked; saveStore(); };
$('setFps').onchange=e=>{ settings.fps=e.target.checked; $('fps').classList.toggle('hidden',!settings.fps); saveStore(); };
$('setVolume').oninput=e=>{ settings.volume=parseInt(e.target.value); if(master) master.gain.value=settings.volume/100; saveStore(); };
$('setMute').onchange=e=>{ settings.muted=e.target.checked; saveStore(); };
$('bindReset').onclick=()=>{ binds=Object.assign({},DEFAULT_BINDS); bindCapture=null; refreshBindUI(); saveStore(); };
$('settingsClose').onclick=closeSettings;
$('menuSettingsBtn').onclick=()=>openSettings(false);
$('resumeBtn').onclick=()=>setPause(false);
$('pauseSettingsBtn').onclick=()=>openSettings(true);
$('pauseQuitBtn').onclick=()=>exitToMenu();
$('menuBtn').onclick=()=>setPause(true);

/* ================= menu: tabs & map cards ================= */
document.querySelectorAll('.tabBtn[data-tab]').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.tabBtn[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    for(const name of ['play','maps','help']) $('tab-'+name).classList.toggle('hidden', name!==btn.dataset.tab);
  };
});
function buildMapCards(){
  const grid=$('mapGrid'); grid.innerHTML='';
  for(const meta of MAP_LIST){
    const data=S.buildMapData(meta.key);
    const card=document.createElement('button'); card.className='mapCard'+(meta.key===selectedMap?' sel':'');
    const cvs=document.createElement('canvas'); cvs.width=192; cvs.height=128;
    const c=cvs.getContext('2d'); const k=4;
    c.fillStyle='#0d1622'; c.fillRect(0,0,192,128);
    for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
      const t=data.grid[y*MAP_W+x];
      if(t===S.T_WALL) c.fillStyle=data.theme.wallDark;
      else if(t===S.T_TREE) c.fillStyle='#2e4d2a';
      else c.fillStyle=(FLOOR_COLORS[data.floor[y*MAP_W+x]]||FLOOR_COLORS.concrete)[0];
      c.fillRect(x*k,y*k,k,k);
    }
    card.appendChild(cvs);
    const info=document.createElement('div');
    info.innerHTML=`<div class="mapName">${meta.name}<span class="mapBadge ${meta.mode}">${meta.mode==='bomb'?'БОМБА':'ЗАЛОЖНИКИ'}</span></div><div class="mapDesc">${meta.desc}</div>`;
    card.appendChild(info);
    card.onclick=()=>{ selectedMap=meta.key; $('selMapName').textContent=meta.name; applyMap(meta.key); buildMapCards(); saveStore(); };
    grid.appendChild(card);
  }
  const cur=MAP_LIST.find(m=>m.key===selectedMap);
  if(cur) $('selMapName').textContent=cur.name;
}

/* ================= modes ================= */
function startLocal(){
  initAudio();
  const name=$('nick').value.trim()||'Operator';
  let team=$('teamSel').value; if(team==='auto') team='CT';
  applyMap(selectedMap);
  localGame=new S.Game({difficulty:$('diffSel').value});
  const me=localGame.addPlayer({name,team,isBot:false});
  myId=me.id;
  localGame.fillWithBots();
  localGame.startMatch();
  localSeq=0; snapBuf=[]; lastRoundSeen=-1; predicted=null;
  mode='local'; saveStore(); enterGameUI();
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
    if(msg.t==='welcome'){ myId=msg.id; mode='lan'; snapBuf=[]; lastRoundSeen=-1; predicted=null; saveStore(); enterGameUI(); }
    else if(msg.t==='snap'){ pushSnapshot(msg.snap); }
  };
  ws.onerror=()=>{ alert('Не удалось подключиться к серверу. Убедитесь, что страница открыта через игровой сервер (npm start), или играйте в режиме с ботами.'); };
}
function enterGameUI(){
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('pcName').textContent=($('nick').value.trim()||'OPERATOR').toUpperCase();
}
function exitToMenu(){
  if(ws){ try{ws.close();}catch(e){} ws=null; }
  localGame=null; mode='menu'; myId=null; snapBuf=[];
  pauseOpen=false; $('pauseMenu').classList.add('hidden');
  if(settingsOpen) closeSettings();
  $('hud').classList.add('hidden'); $('buyMenu').classList.add('hidden'); buyOpen=false;
  $('menu').classList.remove('hidden');
}
$('btnLocal').onclick=startLocal;
$('btnLan').onclick=startLan;
$('nick').addEventListener('keydown',e=>{ if(e.code==='Enter') startLocal(); });

/* ================= rendering ================= */
const GUN_LEN={pistol:12,deagle:13,smg:17,p90:18,famas:21,rifle:22,shotgun:21,scout:26,awp:28};
function drawOperator(c,p){
  const isCT=p.team==='CT';
  c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p.x+3,p.y+5,12,9,0,0,7); c.fill();
  c.save(); c.translate(p.x,p.y);
  if(!p.alive){
    const hash=[...p.id].reduce((a,ch)=>a+ch.charCodeAt(0),0);
    c.rotate(p.angle + (hash%10)/10*1.4);
    c.fillStyle=isCT?'#232a33':'#463f30'; c.beginPath(); c.ellipse(0,0,13,9.5,0,0,7); c.fill();
    c.fillStyle=isCT?'#2c3540':'#554a36'; c.beginPath(); c.arc(5,0,6,0,7); c.fill();
    c.fillStyle='#191d22'; c.fillRect(6,9,17,3.2);
    c.restore(); return;
  }
  c.rotate(p.angle);
  let ph=walkPhase.get(p.id)||0;
  if(p.speed>15){ ph+=p.speed*0.055; walkPhase.set(p.id,ph); }
  const stepA=Math.sin(ph)*4.5*(p.speed>15?1:0);
  c.fillStyle=isCT?'#1b2129':'#3a3428';
  c.beginPath(); c.ellipse(-7+stepA,5.5,4.6,3.2,0,0,7); c.fill();
  c.beginPath(); c.ellipse(-7-stepA,-5.5,4.6,3.2,0,0,7); c.fill();
  const wkey=p.grenadeSel?null:p.weapon;
  if(wkey==='knife'){
    c.fillStyle='#2a2e33'; c.fillRect(8,3,5,2.6);
    c.fillStyle='#c7cfd6'; c.beginPath(); c.moveTo(12,2.4); c.lineTo(22,4); c.lineTo(12,5.4); c.closePath(); c.fill();
  } else if(wkey){
    const gunLen=GUN_LEN[wkey]||18;
    c.fillStyle='#14171b'; c.fillRect(4,2.2,gunLen,wkey==='deagle'?4:3.4);
    c.fillStyle='#22262c'; c.fillRect(10,4.8,4,2.6);
    if(wkey==='awp'||wkey==='scout'){ c.fillStyle='#0e1114'; c.fillRect(12,2.6,7,2.6); }
    if(wkey==='p90'){ c.fillStyle='#22262c'; c.fillRect(6,1.4,11,1.8); }
  } else {
    c.fillStyle='#3f4a35'; c.beginPath(); c.arc(11,5,3.2,0,7); c.fill();
  }
  const uniform=isCT?'#2a333f':'#57503c', vest=isCT?'#20262f':'#453e2e';
  c.fillStyle=uniform;
  c.beginPath(); c.arc(2,9,5.2,0,7); c.fill();
  c.beginPath(); c.arc(2,-9,5.2,0,7); c.fill();
  c.beginPath(); c.arc(9,4.5,3.4,0,7); c.fill();
  c.beginPath(); c.arc(6,-1,3.2,0,7); c.fill();
  c.fillStyle=vest; c.beginPath(); c.arc(0,0,10.5,0,7); c.fill();
  c.fillStyle=isCT?'#171d25':'#39321f'; c.fillRect(-9,-6,7.5,12);
  c.fillStyle=isCT?'#3f6fb5':'#c77414'; c.fillRect(-8,-4.5,4.5,4.5);
  if(p.hasBomb){ c.fillStyle='#33291a'; c.fillRect(-10,-4,5,8); c.fillStyle='#ff4438'; c.fillRect(-9,-1,2,2); }
  c.fillStyle=isCT?'#333e4c':'#5a4f38'; c.beginPath(); c.arc(1.5,0,6.4,0,7); c.fill();
  c.fillStyle='rgba(255,255,255,.13)'; c.beginPath(); c.arc(3,-1.6,2.8,0,7); c.fill();
  if(!isCT){ c.strokeStyle='#8a7a4e'; c.lineWidth=1.6; c.beginPath(); c.arc(1.5,0,6.4,-0.9,0.9); c.stroke(); }
  c.restore();
}
function drawHostage(c,h,now){
  c.fillStyle='rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(h.x+3,h.y+5,11,8,0,0,7); c.fill();
  c.save(); c.translate(h.x,h.y); c.rotate(h.angle||0);
  if(!h.alive){
    c.fillStyle='#8a5518'; c.beginPath(); c.ellipse(0,0,12,8.5,0,0,7); c.fill();
    c.fillStyle='#caa06a'; c.beginPath(); c.arc(5,0,5,0,7); c.fill();
    c.restore(); return;
  }
  const bob = h.state==='following' ? Math.sin(now/90)*0.7 : 0;
  c.translate(0,bob*0.3);
  c.fillStyle='#7a4d14';
  c.beginPath(); c.ellipse(-6,4.5,4,2.8,0,0,7); c.fill();
  c.beginPath(); c.ellipse(-6,-4.5,4,2.8,0,0,7); c.fill();
  c.fillStyle='#c77414'; c.beginPath(); c.arc(0,0,9.5,0,7); c.fill();      // orange jumpsuit
  c.fillStyle='#a55f10'; c.fillRect(-8,-3,6,6);                            // back panel
  c.fillStyle='#d9a066'; c.beginPath(); c.arc(2,0,5.2,0,7); c.fill();      // head
  c.fillStyle='#3a2c1c'; c.beginPath(); c.arc(1,0,5.2,Math.PI*0.6,Math.PI*1.5); c.fill(); // hair
  if(h.state==='idle'){ c.fillStyle='#9aa0a6'; c.fillRect(4,-4.4,2.4,8.8); } // bound hands band
  c.restore();
  if(h.state==='following'){
    c.strokeStyle=`rgba(110,220,90,${0.45+0.3*Math.sin(now/200)})`; c.lineWidth=1.8;
    c.beginPath(); c.arc(h.x,h.y,15,0,7); c.stroke();
  }
}
function drawGroundWeapon(c,g){
  const hash=[...g.id].reduce((a,ch)=>a+ch.charCodeAt(0),0);
  c.save(); c.translate(g.x,g.y); c.rotate((hash%360)*Math.PI/180);
  c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(-8,1,20,5);
  const len=(GUN_LEN[g.key]||18);
  c.fillStyle='#171b20'; c.fillRect(-4,-1.7,len,3.4);
  c.fillStyle='#262c34'; c.fillRect(1,1.4,4,2.4);
  if(g.key==='awp'||g.key==='scout'){ c.fillStyle='#0e1114'; c.fillRect(4,-2.4,6,2); }
  c.restore();
}
function render(dt, now){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='#0a0d10'; ctx.fillRect(0,0,VW,VH);
  const snap=currentSnap();
  if(!snap||!snap.view){ drawMenuBackdrop(now); updateFx(dt); return; }
  const selfP = snap.players.find(p=>p.id===myId);
  let fx2=snap.view.x, fy2=snap.view.y;
  if(snap.self && snap.self.alive && predicted){ fx2=predicted.x; fy2=predicted.y; }
  cam.viewPos={x:fx2,y:fy2};
  const curW = snap.self ? WEAPONS[snap.self.current] : null;
  const scoped = rmbDown && snap.self && snap.self.alive && curW && curW.zoomable;
  cam.zoom=lerp(cam.zoom, scoped?0.72:1, clamp(dt*8,0,1));
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
  for(const g of (snap.ground||[])) drawGroundWeapon(ctx,g);
  if(snap.bomb&&(snap.bomb.state==='planted'||snap.bomb.state==='dropped')&&snap.bomb.x!==undefined){
    const b=snap.bomb;
    ctx.fillStyle='#2b2118'; ctx.fillRect(b.x-6,b.y-4.5,12,9);
    ctx.fillStyle='#4a3a26'; ctx.fillRect(b.x-6,b.y-4.5,12,3);
    const blink=snap.bomb.state==='planted' && Math.floor(now/(snap.bomb.timer<8?140:480))%2===0;
    ctx.fillStyle=blink?'#ff3b2e':'#7a1a14'; ctx.beginPath(); ctx.arc(b.x+2,b.y,2.2,0,7); ctx.fill();
    if(snap.bomb.state==='planted'){
      const interval=snap.bomb.timer<8?0.5:1;
      if(Math.floor(now/(interval*1000))!==lastBeepSecond){ lastBeepSecond=Math.floor(now/(interval*1000)); playTone(1180,0.06,0.13*sndPan(b.x,b.y).vol,'square'); }
    }
  }
  for(const g of snap.grenades){ ctx.fillStyle='#39432f'; ctx.beginPath(); ctx.arc(g.x,g.y,3.4,0,7); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(g.x-1,g.y-3,2,2); }
  for(const h of (snap.hostages||[])) if(h.vis||!h.alive&&h.vis) drawHostage(ctx,h,now);
  const sorted=[...snap.players].sort((a,b)=>(a.alive?1:0)-(b.alive?1:0));
  for(const p of sorted){
    let pp=p;
    if(p.id===myId && p.alive && predicted) pp=Object.assign({},p,{x:predicted.x,y:predicted.y});
    drawOperator(ctx,pp);
  }
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

  if(settings.lighting) drawLighting(snap, ox, oy);
  else { /* still show dynamic light flashes subtly */ }

  /* fx above darkness */
  ctx.save(); ctx.translate(ox,oy); ctx.scale(cam.zoom,cam.zoom);
  for(const p of snap.players){
    if(!p.alive||p.speed>45) continue;
    if(!['rifle','awp','scout','famas'].includes(p.weapon)) continue;
    ctx.strokeStyle='rgba(255,60,50,.28)'; ctx.lineWidth=1/cam.zoom;
    ctx.beginPath(); ctx.moveTo(p.x+Math.cos(p.angle)*24,p.y+Math.sin(p.angle)*24);
    ctx.lineTo(p.x+Math.cos(p.angle)*85,p.y+Math.sin(p.angle)*85); ctx.stroke();
  }
  ctx.lineCap='round';
  for(const t of fx.tracers){
    ctx.strokeStyle='rgba(255,214,130,.95)'; ctx.lineWidth=1.7/cam.zoom;
    ctx.beginPath(); ctx.moveTo(t.x-t.vx*0.012,t.y-t.vy*0.012); ctx.lineTo(t.x,t.y); ctx.stroke();
  }
  for(const f of fx.flashes){
    ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.angle);
    const s=f.weapon==='awp'?26:f.weapon==='shotgun'?22:16;
    ctx.fillStyle='rgba(255,190,80,.95)';
    ctx.beginPath(); ctx.moveTo(0,-3.4); ctx.lineTo(s,0); ctx.lineTo(0,3.4); ctx.lineTo(3,0); ctx.fill();
    ctx.fillStyle='rgba(255,240,200,.9)'; ctx.beginPath(); ctx.arc(2,0,3.4,0,7); ctx.fill();
    ctx.restore();
  }
  for(const s2 of fx.slashes){
    ctx.save(); ctx.translate(s2.x,s2.y); ctx.rotate(s2.angle);
    ctx.strokeStyle=`rgba(255,255,255,${0.8*(1-s2.t/0.16)})`; ctx.lineWidth=2.2/cam.zoom;
    ctx.beginPath(); ctx.arc(6,0,20,-0.7+s2.t*6,0.1+s2.t*6); ctx.stroke();
    ctx.restore();
  }
  for(const p of fx.parts){ ctx.globalAlpha=clamp(1-p.life/p.max,0,1); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
  ctx.globalAlpha=1;
  // hit flashes ON victims (players + hostages)
  const flashDraw=(id,x,y)=>{
    const t0=hitFlashes.get(id); if(!t0) return;
    const age=now-t0; if(age>150){ hitFlashes.delete(id); return; }
    const a=1-age/150;
    ctx.fillStyle=`rgba(255,64,48,${0.34*a})`; ctx.beginPath(); ctx.arc(x,y,12,0,7); ctx.fill();
    ctx.strokeStyle=`rgba(255,90,70,${0.9*a})`; ctx.lineWidth=2.2/cam.zoom;
    ctx.beginPath(); ctx.arc(x,y,15,0,7); ctx.stroke();
  };
  for(const p of snap.players) if(p.alive) flashDraw(p.id, p.id===myId&&predicted?predicted.x:p.x, p.id===myId&&predicted?predicted.y:p.y);
  for(const h of (snap.hostages||[])) if(h.alive&&h.vis) flashDraw(h.id,h.x,h.y);
  // damage numbers
  ctx.textAlign='center';
  for(const f of fx.floaters){
    const a=1-f.life/f.max;
    ctx.font=`800 ${f.big?16:12.5}px Arial`;
    ctx.fillStyle=`rgba(0,0,0,${0.6*a})`; ctx.fillText(f.txt,f.x+1,f.y-f.life*30+1);
    ctx.fillStyle=f.big?`rgba(255,120,60,${a})`:`rgba(255,215,106,${a})`;
    ctx.fillText(f.txt,f.x,f.y-f.life*30);
  }
  // ground weapon labels
  ctx.font='600 9.5px Arial';
  for(const g of (snap.ground||[])){
    if(!cam.viewPos || Math.hypot(g.x-cam.viewPos.x,g.y-cam.viewPos.y)>130) continue;
    const near = snap.self&&snap.self.alive&&Math.hypot(g.x-cam.viewPos.x,g.y-cam.viewPos.y)<46;
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText(itemName(g.key,snap.self?snap.self.team:'CT'),g.x+1,g.y-10);
    ctx.fillStyle='#e8eef4'; ctx.fillText(itemName(g.key,snap.self?snap.self.team:'CT'),g.x,g.y-11);
    if(near && snap.self){
      const slot=WEAPONS[g.key].slot;
      const occupied=snap.self.weapons.some(k=>WEAPONS[k].slot===slot);
      ctx.fillStyle='#a5d66d';
      ctx.fillText(occupied?prettyKey(binds.use)+' — обменять':'подойдите, чтобы подобрать', g.x, g.y+18);
    }
  }
  // hostage labels
  for(const h of (snap.hostages||[])){
    if(!h.vis) continue;
    ctx.font='700 9px Arial';
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText(h.alive?'ЗАЛОЖНИК':'',h.x+1,h.y-16);
    ctx.fillStyle='#f2cd90'; ctx.fillText(h.alive?'ЗАЛОЖНИК':'',h.x,h.y-17);
    if(h.alive&&h.hp<100){ ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(h.x-11,h.y-14,22,3); ctx.fillStyle='#e8a33d'; ctx.fillRect(h.x-11,h.y-14,22*clamp(h.hp/100,0,1),3); }
  }
  // names + hp + channel rings
  ctx.font='600 10px Arial';
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
      ctx.strokeStyle=p.channel.type==='plant'?'#ffb347':p.channel.type==='untie'?'#6ed25a':'#7fb2e8';
      ctx.beginPath(); ctx.arc(p.x,p.y,17,-Math.PI/2,-Math.PI/2+ (p.channel.t/p.channel.need)*Math.PI*2); ctx.stroke();
    }
  }
  ctx.restore();

  if(snap.self && snap.self.alive && snap.self.lastDamageAngle!==undefined && (snap.t - snap.self.lastDamageT)<0.9 && cam.viewPos){
    const sp=worldToScreen(cam.viewPos.x,cam.viewPos.y);
    ctx.strokeStyle=`rgba(229,57,47,${0.85*(1-(snap.t-snap.self.lastDamageT)/0.9)})`; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(sp.x,sp.y,30,snap.self.lastDamageAngle-0.6,snap.self.lastDamageAngle+0.6); ctx.stroke();
  }
  if(mode!=='menu') drawCrosshair(scoped);
  updateFx(dt);
}
function drawMenuBackdrop(now){
  const px=WORLD_W/2+Math.cos(now/9000)*220, py=WORLD_H/2+Math.sin(now/11000)*150;
  ctx.save(); ctx.translate(VW/2-px,VH/2-py);
  ctx.globalAlpha=0.4; ctx.drawImage(mapCv,0,0); ctx.globalAlpha=1; ctx.restore();
}
function worldToScreen(x,y){ return { x: VW/2+(x-cam.x)*cam.zoom, y: VH/2+(y-cam.y)*cam.zoom }; }
function screenToWorld(x,y){ return { x: cam.x+(x-VW/2)/cam.zoom, y: cam.y+(y-VH/2)/cam.zoom }; }
function drawLighting(snap, ox, oy){
  const bw=Math.round(VW*DPR), bh=Math.round(VH*DPR);
  if(lightCv.width!==bw||lightCv.height!==bh){ lightCv.width=bw; lightCv.height=bh; }
  const lc=lightCtx; lc.setTransform(DPR,0,0,DPR,0,0); lc.globalCompositeOperation='source-over';
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
  if(viewP && viewP.alive && !blind){
    const fg=lc.createRadialGradient(vp.x,vp.y,10,vp.x,vp.y,400);
    fg.addColorStop(0,'rgba(0,0,0,0.95)'); fg.addColorStop(1,'rgba(0,0,0,0)');
    lc.fillStyle=fg;
    lc.beginPath(); lc.moveTo(vp.x,vp.y);
    lc.arc(vp.x,vp.y,400,viewP.angle-0.34,viewP.angle+0.34); lc.closePath(); lc.fill();
  }
  for(const L of fx.lights){
    const a=L.strength*clamp(1-L.t/L.max,0,1);
    const g=lc.createRadialGradient(L.x,L.y,2,L.x,L.y,L.r);
    g.addColorStop(0,`rgba(0,0,0,${a})`); g.addColorStop(1,'rgba(0,0,0,0)');
    lc.fillStyle=g; lc.beginPath(); lc.arc(L.x,L.y,L.r,0,7); lc.fill();
  }
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.drawImage(lightCv,0,0);
  ctx.restore();
}
function drawCrosshair(scoped){
  const gap = scoped?3:6, len=scoped?10:7;
  ctx.strokeStyle='rgba(140,255,140,.9)'; ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.moveTo(mouseX-gap-len,mouseY); ctx.lineTo(mouseX-gap,mouseY);
  ctx.moveTo(mouseX+gap,mouseY); ctx.lineTo(mouseX+gap+len,mouseY);
  ctx.moveTo(mouseX,mouseY-gap-len); ctx.lineTo(mouseX,mouseY-gap);
  ctx.moveTo(mouseX,mouseY+gap); ctx.lineTo(mouseX,mouseY+gap+len);
  ctx.stroke();
  ctx.fillStyle='rgba(140,255,140,.9)'; ctx.fillRect(mouseX-0.8,mouseY-0.8,1.6,1.6);
  if(scoped){ ctx.strokeStyle='rgba(140,255,140,.35)'; ctx.beginPath(); ctx.arc(mouseX,mouseY,26,0,7); ctx.stroke(); }
  $('hitmarker').classList.toggle('hidden', performance.now()-hitmarkT>110);
}
function updateFx(dt){
  for(let i=fx.tracers.length-1;i>=0;i--){ const t=fx.tracers[i];
    t.x+=t.vx*dt; t.y+=t.vy*dt; t.life-=dt;
    if(t.life<=0||S.bulletBlockTile(S.tileAt(t.x,t.y))) fx.tracers.splice(i,1);
  }
  for(let i=fx.parts.length-1;i>=0;i--){ const p=fx.parts[i]; p.life+=dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt; const dr=Math.pow(0.02,dt*p.drag/3); p.vx*=dr; p.vy*=dr;
    if(p.life>=p.max) fx.parts.splice(i,1);
  }
  if(fx.parts.length>900) fx.parts.splice(0,fx.parts.length-900);
  for(let i=fx.flashes.length-1;i>=0;i--){ fx.flashes[i].t+=dt; if(fx.flashes[i].t>0.05) fx.flashes.splice(i,1); }
  for(let i=fx.slashes.length-1;i>=0;i--){ fx.slashes[i].t+=dt; if(fx.slashes[i].t>0.16) fx.slashes.splice(i,1); }
  for(let i=fx.lights.length-1;i>=0;i--){ fx.lights[i].t+=dt; if(fx.lights[i].t>=fx.lights[i].max) fx.lights.splice(i,1); }
  for(let i=fx.floaters.length-1;i>=0;i--){ fx.floaters[i].life+=dt; if(fx.floaters[i].life>=fx.floaters[i].max) fx.floaters.splice(i,1); }
}

/* ================= HUD ================= */
const hudCache={};
function setText(id,txt){ if(hudCache[id]!==txt){ hudCache[id]=txt; $(id).textContent=txt; } }
function fmtTime(sec){ sec=Math.max(0,Math.ceil(sec)); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }
function updateHUD(snap){
  if(!snap||!snap.self) return;
  const me=snap.self;
  setText('scoreCT',String(snap.score.CT)); setText('scoreT',String(snap.score.T));
  setText('roundLabel','РАУНД '+snap.round+(snap.phase==='freeze'?' · ПОДГОТОВКА':''));
  if(snap.map) setText('missionTitle','ОПЕРАЦИЯ · '+snap.map.name.toUpperCase());
  const timerEl=$('timer');
  if(snap.bomb&&snap.bomb.state==='planted'){ setText('timer',fmtTime(snap.bomb.timer)); timerEl.classList.add('bombT'); }
  else { setText('timer',fmtTime(snap.phaseT)); timerEl.classList.remove('bombT'); }
  setText('aliveCT','CT '+snap.aliveCount.CT); setText('aliveT',snap.aliveCount.T+' T');
  let mission;
  if(snap.map&&snap.map.mode==='hostage'){
    const hs=snap.hostages||[];
    const mine=hs.find(h=>h.state==='following'&&h.followId===myId);
    const carried=hs.find(h=>h.state==='following');
    if(me.team==='CT') mission = mine?'Ведите заложника в зону эвакуации!':carried?'Прикрывайте носителя заложника':'Освободите заложника ('+prettyKey(binds.use)+') и доведите до эвакуации';
    else mission = carried?'Не дайте увести заложника!':'Охраняйте заложников';
  } else if(snap.bomb&&snap.bomb.state==='planted'){
    mission = me.team==='CT' ? `Обезвредьте бомбу · точка ${snap.bomb.site}` : `Защищайте бомбу · точка ${snap.bomb.site}`;
  } else if(me.team==='CT') mission='Защищайте точки A и B';
  else mission = me.hasBomb ? 'У вас бомба! Установите её на A или B ('+prettyKey(binds.use)+')' : 'Установите бомбу на точке A или B';
  setText('missionText',mission);
  setText('hpVal',String(me.hp)); setText('armVal',String(me.armor));
  $('hpBar').style.width=clamp(me.hp,0,100)+'%';
  $('hpBar').style.background=me.hp>55?'#7dc24a':me.hp>28?'#e0b03c':'#e05244';
  $('armBar').style.width=clamp(me.armor,0,100)+'%';
  setText('money','$'+me.money+(me.canBuy?' · '+prettyKey(binds.buy)+' — закуп':''));
  $('lowHpFx').style.opacity = (me.alive&&me.hp<40)? (0.35+0.3*Math.sin(performance.now()/240))*(1-me.hp/40)+0.25 : 0;
  const bl=me.blindT||0;
  $('flashFx').style.opacity = me.alive? clamp(bl/1.6,0,1)*(me.blindFull?1:0.75) : 0;
  const selfP=snap.players.find(p=>p.id===myId);
  if(me.grenadeSel){ setText('wpnName','ГРАНАТА · '+ITEMS[me.grenadeSel].name.toUpperCase()); setText('ammoMag','1'); setText('ammoRes',''); }
  else if(me.current==='knife'){ setText('wpnName','НОЖ'); setText('ammoMag','—'); setText('ammoRes',''); }
  else if(selfP){
    setText('wpnName', itemName(me.current,me.team));
    setText('ammoMag', selfP.ammo===null?'—':String(selfP.ammo));
    setText('ammoRes', selfP.reserve===null?'':String(selfP.reserve));
  }
  $('ammo').classList.toggle('low', !!(selfP&&selfP.ammo!==null&&selfP.ammo<=3&&me.current!=='knife'));
  $('reloadHint').classList.toggle('hidden', !(selfP&&selfP.reloading));
  const nades=['he','smoke','flash'].filter(k=>me.grenades[k]).map(k=>({he:'HE',smoke:'SMOKE',flash:'FLASH'}[k])+(me.grenadeSel===k?'◂':'')).join(' · ');
  setText('nades', nades? prettyKey(binds.slot4)+': '+nades : (me.hasKit?'САПЁРНЫЙ НАБОР':''));
  const cm=$('centerMsg');
  if(snap.phase==='end'){ cm.textContent=snap.winnerText.toUpperCase(); cm.style.color = snap.winnerText.startsWith('Спецназ')?'#a9cbf0':'#f2cd90'; cm.classList.remove('hidden'); }
  else if(snap.phase==='freeze'){ cm.textContent='РАУНД '+snap.round; cm.style.color='#e8eef4'; cm.classList.remove('hidden'); }
  else cm.classList.add('hidden');
  if(performance.now()>centerFlashUntil && snap.phase!=='end') $('subMsg').classList.add('hidden');
  if(snap.phase==='freeze'&&me.canBuy&&performance.now()>centerFlashUntil){ const el=$('subMsg'); el.textContent=prettyKey(binds.buy)+' — меню закупа'; el.style.color='#a5d66d'; el.classList.remove('hidden'); }
  const pw=$('progressWrap');
  if(me.channel){ pw.classList.remove('hidden');
    setText('progressLabel', me.channel.type==='plant'?'УСТАНОВКА БОМБЫ':me.channel.type==='untie'?'ОСВОБОЖДЕНИЕ ЗАЛОЖНИКА':'ОБЕЗВРЕЖИВАНИЕ');
    $('progressBar').style.width=(me.channel.t/me.channel.need*100)+'%';
  } else pw.classList.add('hidden');
  const sl=$('specLabel');
  if(me.spectating){ sl.textContent='💀 ВЫ УБИТЫ · Наблюдение: '+me.spectating.name+' · '+prettyKey(binds.spectate)+'/ЛКМ — следующий'; sl.classList.remove('hidden'); }
  else if(!me.alive && snap.phase==='live'){ sl.textContent='💀 ВЫ УБИТЫ · Возрождение в следующем раунде'; sl.classList.remove('hidden'); }
  else sl.classList.add('hidden');
  if(buyOpen){ if(!me.canBuy) toggleBuy(false); else renderBuy(); }
  $('scoreboard').classList.toggle('hidden',!boardOpen);
  if(boardOpen) renderBoard(snap);
  drawMinimap(snap);
}
function renderBoard(snap){
  if(snap.map) setText('sbHead', snap.map.name.toUpperCase()+' · СЧЁТ МАТЧА');
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
  for(const h of (snap.hostages||[])){
    const x=sx(h.x), y=sy(h.y);
    if(!h.alive){ c.fillStyle='#777'; c.fillText('✕',x,y+3); continue; }
    c.fillStyle = h.state==='following' ? (Math.floor(performance.now()/300)%2===0?'#9fe870':'#f0aa46') : '#f0aa46';
    c.beginPath(); c.arc(x,y,3,0,7); c.fill();
    c.strokeStyle='#fff'; c.lineWidth=0.8; c.stroke();
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

/* ================= prediction ================= */
function updatePrediction(dt, snap, inp){
  if(!snap||!snap.self||!snap.self.alive){ predicted=null; return; }
  const selfP=snap.players.find(p=>p.id===myId);
  if(!selfP){ predicted=null; return; }
  if(!predicted) predicted={x:selfP.x,y:selfP.y};
  const w=WEAPONS[snap.self.current]||WEAPONS.pistol;
  let sp=218*w.moveSpeed*(inp.walk?0.52:1)*S.floorSpeedAt(predicted.x,predicted.y);
  if(snap.phase==='freeze'||snap.self.channel) sp=0;
  let mx=inp.mx,my=inp.my; const ml=Math.hypot(mx,my); if(ml>1){mx/=ml;my/=ml;}
  const tmp={x:predicted.x,y:predicted.y};
  S.moveCircle(tmp, mx*sp*dt, my*sp*dt);
  predicted.x=tmp.x; predicted.y=tmp.y;
  const err=Math.hypot(predicted.x-selfP.x,predicted.y-selfP.y);
  if(err>46){ predicted.x=selfP.x; predicted.y=selfP.y; }
  else { const k=clamp(dt*7,0,1)*clamp(err/46,0,1); predicted.x=lerp(predicted.x,selfP.x,k); predicted.y=lerp(predicted.y,selfP.y,k); }
}

/* ================= boot & main loop ================= */
loadStore();
resize();
applyMap(selectedMap);
buildMapCards();
syncSettingsUI();
$('fps').classList.toggle('hidden',!settings.fps);

let lastT=performance.now(), simAcc=0, inputAcc=0;
let fpsFrames=0, fpsLast=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  let dt=(now-lastT)/1000; lastT=now;
  dt=Math.min(dt,0.05);
  if(settings.fps){ fpsFrames++; if(now-fpsLast>=500){ $('fps').textContent=Math.round(fpsFrames*1000/(now-fpsLast))+' FPS'; fpsFrames=0; fpsLast=now; } }
  const pausedLocal = mode==='local' && (pauseOpen||settingsOpen);
  if(cam.viewPos && !pauseOpen && !settingsOpen){ const mw=screenToWorld(mouseX,mouseY); lastAim=Math.atan2(mw.y-cam.viewPos.y, mw.x-cam.viewPos.x); }
  const inp=readInput();

  if(mode==='local'&&localGame){
    if(!pausedLocal){
      localGame.setInput(myId,inp);
      simAcc+=dt;
      while(simAcc>=1/30){
        localGame.tick(1/30); simAcc-=1/30;
        const snap=localGame.snapshotFor(myId);
        snap.events=localGame.eventsSince(localSeq); localSeq=localGame.eventSeq;
        pushSnapshot(snap);
      }
    }
  } else if(mode==='lan'&&ws&&ws.readyState===1&&myId){
    inputAcc+=dt;
    if(inputAcc>=1/30||inp.slot||inp.drop){ inputAcc=0; ws.send(JSON.stringify({t:'input',input:inp})); }
  }
  const snap=currentSnap();
  if(mode!=='menu'&&!pausedLocal) updatePrediction(dt,snap,inp);
  render(dt,now);
  if(mode!=='menu'&&snap) updateHUD(snap);
}
requestAnimationFrame(loop);
