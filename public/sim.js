/* ============================================================
   SILENT ENTRY — shared game simulation
   Runs in browser (singleplayer) and on Node server (LAN).
   ============================================================ */
(function (global) {
'use strict';

/* ---------------- constants ---------------- */
const TILE = 32, MAP_W = 48, MAP_H = 32;
const WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE;
const PLAYER_R = 11;
const T_FLOOR = 0, T_WALL = 1, T_CRATE = 2, T_DESK = 3, T_RACK = 4, T_TREE = 5, T_ROCK = 6;

const WEAPONS = {
  pistol:  { key:'pistol',  slot:'secondary', nameCT:'P2000',  nameT:'Glock-18', price:0,    dmg:24, rpm:400, mag:13, reserve:52,  reload:1.1, spread:1.4, moveSpread:4.5, bulletSpeed:1500, auto:false, pellets:1, moveSpeed:1.0,  zoomable:false },
  smg:     { key:'smg',     slot:'primary',   nameCT:'MP9',    nameT:'MAC-10',   price:1250, dmg:19, rpm:800, mag:30, reserve:120, reload:1.8, spread:2.6, moveSpread:5.0, bulletSpeed:1500, auto:true,  pellets:1, moveSpeed:0.97, zoomable:false },
  shotgun: { key:'shotgun', slot:'primary',   nameCT:'Nova',   nameT:'Nova',     price:1050, dmg:10, rpm:75,  mag:8,  reserve:32,  reload:2.6, spread:6.5, moveSpread:8.0, bulletSpeed:1300, auto:false, pellets:8, moveSpeed:0.95, zoomable:false },
  rifle:   { key:'rifle',   slot:'primary',   nameCT:'M4A4',   nameT:'AK-47',    price:2700, dmg:27, rpm:630, mag:30, reserve:90,  reload:2.2, spread:1.7, moveSpread:5.5, bulletSpeed:1800, auto:true,  pellets:1, moveSpeed:0.94, zoomable:false },
  awp:     { key:'awp',     slot:'primary',   nameCT:'AWP',    nameT:'AWP',      price:4750, dmg:112,rpm:42,  mag:5,  reserve:30,  reload:3.2, spread:0.15,moveSpread:12.0,bulletSpeed:2400, auto:false, pellets:1, moveSpeed:0.86, zoomable:true  },
  deagle:  { key:'deagle',  slot:'secondary', nameCT:'Desert Eagle', nameT:'Desert Eagle', price:700,  dmg:42, rpm:260, mag:7,  reserve:35,  reload:2.0, spread:0.9, moveSpread:7.0, bulletSpeed:1900, auto:false, pellets:1, moveSpeed:0.98, zoomable:false },
  famas:   { key:'famas',   slot:'primary',   nameCT:'FAMAS',   nameT:'Galil AR',   price:1900, dmg:23, rpm:666, mag:30, reserve:90,  reload:2.4, spread:2.1, moveSpread:5.5, bulletSpeed:1700, auto:true,  pellets:1, moveSpeed:0.94, zoomable:false },
  scout:   { key:'scout',   slot:'primary',   nameCT:'SSG 08',  nameT:'SSG 08',     price:1700, dmg:74, rpm:48,  mag:10, reserve:60,  reload:2.6, spread:0.3, moveSpread:9.0, bulletSpeed:2300, auto:false, pellets:1, moveSpeed:0.93, zoomable:true  },
  p90:     { key:'p90',     slot:'primary',   nameCT:'P90',     nameT:'P90',        price:2350, dmg:17, rpm:857, mag:50, reserve:100, reload:2.6, spread:3.4, moveSpread:4.2, bulletSpeed:1500, auto:true,  pellets:1, moveSpeed:0.97, zoomable:false },
  knife:   { key:'knife',   slot:'melee',     nameCT:'Нож',     nameT:'Нож',        price:0,    dmg:55, rpm:110, mag:0,  reserve:0,   reload:0,   spread:0,   moveSpread:0,   bulletSpeed:0,    auto:false, pellets:0, moveSpeed:1.04, zoomable:false },
};
const WEAPON_TIER = { knife:0, pistol:1, deagle:2, smg:2, shotgun:2, famas:3, scout:3, p90:3, rifle:4, awp:5 };
const ITEMS = {
  armor: { key:'armor', name:'Броня + шлем', price:650 },
  kit:   { key:'kit',   name:'Набор сапёра', price:400, ctOnly:true },
  he:    { key:'he',    name:'Осколочная граната', price:300, grenade:true },
  smoke: { key:'smoke', name:'Дымовая граната', price:300, grenade:true },
  flash: { key:'flash', name:'Светошумовая граната', price:200, grenade:true },
};
const DIFFS = {
  easy:   { reaction:0.60, aimErr:5.5, burstPause:0.55, name:'Лёгкие' },
  normal: { reaction:0.36, aimErr:3.0, burstPause:0.38, name:'Средние' },
  hard:   { reaction:0.20, aimErr:1.5, burstPause:0.24, name:'Сложные' },
};
const BOT_NAMES = ['Raptor','Viper','Ghost','Havoc','Nomad','Falcon','Onyx','Blitz','Cobra','Jackal','Rogue','Sable','Talon','Vector','Wraith','Zenith'];

/* ---------------- utils ---------------- */
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
const dist2 = (x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1;return dx*dx+dy*dy;};
const dist = (x1,y1,x2,y2)=>Math.sqrt(dist2(x1,y1,x2,y2));
function angLerp(a,b,t){ let d=(b-a)%(Math.PI*2); if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return a+d*t; }
function angDiff(a,b){ let d=(b-a)%(Math.PI*2); if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return d; }
function mulberry(seed){ return function(){ seed|=0; seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^(seed>>>15),1|seed); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

/* ---------------- maps ----------------
   Each map is built by carving rooms/corridors out of solid rock.
   All maps share the same dimensions. mode: 'bomb' | 'hostage'. */
function makeBuilder(){
  const g = new Uint8Array(MAP_W*MAP_H).fill(T_WALL);
  const floor = new Array(MAP_W*MAP_H).fill('concrete');
  const idx=(x,y)=>y*MAP_W+x;
  function carve(x,y,w,h,f){ for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){ if(i<1||j<1||i>=MAP_W-1||j>=MAP_H-1)continue; g[idx(i,j)]=T_FLOOR; floor[idx(i,j)]=f||'tile'; } }
  function paint(x,y,w,h,f){ for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){ if(i>=0&&j>=0&&i<MAP_W&&j<MAP_H&&g[idx(i,j)]===T_FLOOR) floor[idx(i,j)]=f; } }
  function set(x,y,t){ if(x>=0&&y>=0&&x<MAP_W&&y<MAP_H) g[idx(x,y)]=t; }
  function rect(x,y,w,h,t){ for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++) set(i,j,t); }
  function scatter(list,t){ for(const p of list) set(p[0],p[1],t); }
  function forceFloor(pts){ for(const s of pts) set(Math.floor(s.x/TILE),Math.floor(s.y/TILE),T_FLOOR); }
  return { g, floor, carve, paint, set, rect, scatter, forceFloor };
}
const pt = (x,y)=>({x:(x+0.5)*TILE, y:(y+0.5)*TILE});
const ptList = (list)=>list.map(p=>pt(p[0],p[1]));

function buildOfficeMap(){
  const b = makeBuilder(); const {carve,set,rect} = b;
  carve(2,2,12,7,'tile'); carve(36,2,10,7,'carpet'); carve(35,24,11,6,'wood');
  carve(2,24,9,6,'concrete'); carve(20,13,9,7,'carpet');
  carve(14,3,22,3,'tile'); carve(2,9,3,15,'concrete'); carve(43,9,3,15,'tile');
  carve(11,27,24,3,'concrete'); carve(23,6,3,7,'tile'); carve(23,20,3,7,'tile');
  carve(5,15,15,3,'tile'); carve(29,15,14,3,'tile');
  carve(8,10,6,5,'carpet'); carve(34,10,6,5,'carpet'); carve(9,19,5,4,'concrete');
  set(13,3,T_WALL); set(13,5,T_WALL); set(36,3,T_WALL); set(36,5,T_WALL);
  set(44,23,T_WALL); set(3,23,T_WALL);
  rect(4,3,1,4,T_RACK); rect(6,3,1,4,T_RACK); rect(10,5,3,1,T_RACK); rect(9,3,1,2,T_CRATE);
  rect(37,25,4,1,T_CRATE); rect(37,28,4,1,T_CRATE); rect(44,26,1,2,T_CRATE);
  rect(38,3,2,1,T_DESK); rect(41,3,2,1,T_DESK); rect(38,6,2,1,T_DESK); rect(42,6,2,1,T_DESK);
  rect(9,11,2,1,T_DESK); rect(11,13,2,1,T_DESK); rect(35,11,2,1,T_DESK); rect(37,13,2,1,T_DESK);
  rect(21,14,2,1,T_DESK); rect(26,18,2,1,T_DESK); rect(22,17,1,2,T_CRATE);
  b.scatter([[16,4],[31,4],[3,14],[44,13],[17,28],[28,28],[24,10],[24,22],[10,20],[12,21]], T_CRATE);
  rect(3,25,2,2,T_CRATE); rect(8,28,2,1,T_CRATE);
  set(21,16,T_WALL); set(27,16,T_WALL);
  const sites = {
    A:{ key:'A', name:'Серверная', cx:8*TILE,  cy:7*TILE,    r:2.6*TILE, plant:pt(8,7) },
    B:{ key:'B', name:'Архив',     cx:40*TILE, cy:26.5*TILE, r:2.6*TILE, plant:pt(40,26) },
  };
  const spawns = { CT: ptList([[38,4],[40,5],[42,4],[39,7],[43,7]]), T: ptList([[4,27],[6,26],[5,28],[7,28],[4,25]]) };
  const holds = { CT_A:ptList([[12,6],[8,8]]), CT_B:ptList([[43,25],[36,28]]), CT_MID:ptList([[26,14],[21,19]]),
                  T_Apost:ptList([[5,7],[12,3],[11,7]]), T_Bpost:ptList([[36,25],[44,28],[38,29]]) };
  b.forceFloor([...spawns.CT,...spawns.T,sites.A.plant,sites.B.plant,...holds.CT_A,...holds.CT_B,...holds.CT_MID,...holds.T_Apost,...holds.T_Bpost]);
  return { key:'office', name:'Gordon Hall · Офис', mode:'bomb', grid:b.g, floor:b.floor, sites, spawns, holds,
           hostages:[], rescue:null, theme:{ wall:'#3d434c', wallDark:'#2c3036', snowCaps:false } };
}

function buildDustMap(){
  const b = makeBuilder(); const {carve,set,rect} = b;
  carve(2,2,13,8,'sand');            // A site
  carve(37,2,9,6,'stone');           // CT spawn
  carve(35,23,11,7,'sand');          // B site
  carve(2,24,10,6,'sand');           // T spawn
  carve(20,13,8,6,'stone');          // mid
  carve(15,3,22,3,'stone');          // top corridor
  carve(3,10,3,14,'sand');           // long (left)
  carve(42,8,3,15,'stone');          // right corridor
  carve(12,26,23,3,'stone');         // tunnels (bottom)
  carve(23,6,3,7,'stone'); carve(23,19,3,7,'stone');
  carve(6,15,14,3,'sand'); carve(28,15,14,3,'sand');
  carve(8,10,7,4,'sand'); carve(5,11,3,2,'sand');      // A-short yard
  carve(33,10,6,5,'stone'); carve(39,12,3,2,'stone');  // upper tunnels room
  // box stacks & cover
  rect(6,3,2,2,T_CRATE); set(11,7,T_CRATE); rect(3,7,2,1,T_CRATE); set(9,5,T_ROCK);
  rect(38,24,2,2,T_CRATE); set(43,28,T_CRATE); rect(36,27,1,2,T_CRATE);
  rect(39,3,2,1,T_CRATE); rect(4,25,2,2,T_CRATE);
  b.scatter([[18,4],[31,4],[4,16],[43,17],[17,27],[29,27],[24,9],[24,21],[10,12],[35,12]], T_CRATE);
  b.scatter([[12,8],[21,14],[26,17],[15,16]], T_ROCK);
  set(21,16,T_WALL); set(26,14,T_WALL);
  const sites = {
    A:{ key:'A', name:'Площадка A', cx:8*TILE,  cy:6*TILE,  r:2.6*TILE, plant:pt(8,6) },
    B:{ key:'B', name:'Туннели B',  cx:40*TILE, cy:26*TILE, r:2.6*TILE, plant:pt(40,26) },
  };
  const spawns = { CT: ptList([[39,3],[41,4],[43,3],[40,6],[44,6]]), T: ptList([[4,26],[6,27],[5,28],[8,27],[3,28]]) };
  const holds = { CT_A:ptList([[13,4],[10,8]]), CT_B:ptList([[43,24],[36,28]]), CT_MID:ptList([[25,14],[21,17]]),
                  T_Apost:ptList([[4,3],[13,8]]), T_Bpost:ptList([[44,29],[36,24]]) };
  b.forceFloor([...spawns.CT,...spawns.T,sites.A.plant,sites.B.plant,...holds.CT_A,...holds.CT_B,...holds.CT_MID,...holds.T_Apost,...holds.T_Bpost]);
  return { key:'dust', name:'Dust Yard · Пустыня', mode:'bomb', grid:b.g, floor:b.floor, sites, spawns, holds,
           hostages:[], rescue:null, theme:{ wall:'#a08054', wallDark:'#7d623d', snowCaps:false } };
}

function buildWinterMap(){
  const b = makeBuilder(); const {carve,paint,set,rect} = b;
  carve(3,2,8,5,'wood');             // T west cabin
  carve(37,2,8,5,'wood');            // T east cabin
  carve(19,2,10,6,'tile');           // hostage facility
  carve(11,3,8,2,'tile'); carve(29,3,8,2,'tile');
  carve(22,8,4,4,'snow');            // facility south exit
  carve(8,12,32,9,'snow');           // big snowy yard
  paint(22,15,8,4,'ice');            // frozen pond
  carve(4,7,3,15,'snow'); carve(41,7,3,15,'snow');       // flank paths
  carve(3,18,7,5,'wood'); carve(38,18,7,5,'wood');       // south cabins
  carve(22,21,4,5,'snow');
  carve(19,26,10,4,'tile');          // CT base / rescue
  carve(6,23,13,2,'snow'); carve(29,23,13,2,'snow');
  // cover
  rect(20,3,2,1,T_CRATE); rect(26,6,2,1,T_DESK); rect(21,6,2,1,T_DESK);
  b.scatter([[10,13],[14,17],[17,13],[31,13],[35,17],[38,14],[12,20],[36,20],[19,18],[15,14],[33,19]], T_TREE);
  b.scatter([[16,15],[33,15],[20,13]], T_ROCK);
  b.scatter([[5,12],[42,12],[24,10],[9,19],[39,20]], T_CRATE);
  const spawns = { CT: ptList([[21,27],[23,28],[25,27],[27,28],[24,29]]),
                   T:  ptList([[4,3],[6,4],[40,3],[42,4],[24,3]]) };
  const hostages = ptList([[22,4],[26,5]]);
  const rescue = { x:24*TILE, y:28*TILE, r:2.6*TILE };
  b.forceFloor([...spawns.CT,...spawns.T,...hostages]);
  return { key:'winter', name:'North Station · Зима', mode:'hostage', grid:b.g, floor:b.floor,
           sites:null, spawns, holds:{}, hostages, rescue,
           theme:{ wall:'#77828f', wallDark:'#59636f', snowCaps:true } };
}

function buildJungleMap(){
  const b = makeBuilder(); const {carve,paint,set,rect} = b;
  carve(19,2,10,7,'stone');          // temple (hostages)
  carve(10,3,9,3,'stone'); carve(29,3,9,3,'stone');
  carve(3,2,7,5,'wood'); carve(38,2,7,5,'wood');         // T camps
  carve(22,9,4,4,'grass');           // temple steps
  carve(6,13,36,8,'grass');          // jungle belt
  paint(12,15,6,3,'mud'); paint(30,16,6,3,'mud'); paint(21,18,5,2,'mud');
  carve(3,7,3,14,'grass'); carve(42,7,3,14,'grass');     // side trails
  carve(2,21,44,2,'water');          // river
  paint(22,21,4,2,'wood'); paint(9,21,3,2,'wood'); paint(36,21,3,2,'wood'); // bridges
  carve(20,23,8,3,'sand');
  carve(20,26,8,4,'sand');           // CT base / rescue
  carve(4,23,10,3,'grass'); carve(34,23,10,3,'grass');   // ruins banks
  carve(14,24,6,2,'grass'); carve(28,24,6,2,'grass');
  // cover: dense trees + temple stones
  b.scatter([[8,14],[11,17],[14,14],[17,19],[20,15],[24,17],[27,14],[30,19],[33,14],[36,17],[39,14],[10,19],[38,19],[15,16],[32,15],[23,13],[7,16],[40,16]], T_TREE);
  b.scatter([[18,17],[29,18],[12,13],[35,20]], T_ROCK);
  rect(20,5,1,2,T_ROCK); set(27,3,T_ROCK); rect(24,7,2,1,T_CRATE);
  b.scatter([[5,10],[43,10],[6,24],[41,24]], T_CRATE);
  const spawns = { CT: ptList([[21,27],[23,28],[25,27],[26,29],[22,29]]),
                   T:  ptList([[4,3],[6,5],[40,3],[42,5],[24,3]]) };
  const hostages = ptList([[22,5],[25,4]]);
  const rescue = { x:24*TILE, y:28*TILE, r:2.6*TILE };
  b.forceFloor([...spawns.CT,...spawns.T,...hostages]);
  return { key:'jungle', name:'Lost Temple · Джунгли', mode:'hostage', grid:b.g, floor:b.floor,
           sites:null, spawns, holds:{}, hostages, rescue,
           theme:{ wall:'#5f6b52', wallDark:'#454f3c', snowCaps:false } };
}

const MAP_BUILDERS = { office:buildOfficeMap, dust:buildDustMap, winter:buildWinterMap, jungle:buildJungleMap };
const MAP_LIST = [
  { key:'office', name:'Gordon Hall · Офис',    mode:'bomb',    desc:'Офисный этаж. Бомба: A «Серверная» и B «Архив».' },
  { key:'dust',   name:'Dust Yard · Пустыня',   mode:'bomb',    desc:'Песчаные улицы и туннели в духе Dust. Бомба на A и B.' },
  { key:'winter', name:'North Station · Зима',  mode:'hostage', desc:'Снежная станция. Спасите заложника и доведите до базы CT.' },
  { key:'jungle', name:'Lost Temple · Джунгли', mode:'hostage', desc:'Храм в джунглях, река и грязь. Спасите заложника.' },
];
let MAP = MAP_BUILDERS.office();
function setMap(key){ if(MAP_BUILDERS[key]) MAP = MAP_BUILDERS[key](); return MAP; }
function getMap(){ return MAP; }
function buildMapData(key){ const f=MAP_BUILDERS[key]; return f?f():null; }
const FLOOR_SPEED = { mud:0.8, water:0.68, snow:0.94, ice:1.05, sand:0.96 };
function floorSpeedAt(x,y){ const tx=Math.floor(x/TILE), ty=Math.floor(y/TILE);
  if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return 1; return FLOOR_SPEED[MAP.floor[ty*MAP_W+tx]]||1; }
function bulletBlockTile(t){ return t===T_WALL||t===T_CRATE||t===T_RACK||t===T_TREE||t===T_ROCK; }

const tileAt = (x,y)=>{ const tx=Math.floor(x/TILE), ty=Math.floor(y/TILE); if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return T_WALL; return MAP.grid[ty*MAP_W+tx]; };
const solidTile = (tx,ty)=>{ if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return true; return MAP.grid[ty*MAP_W+tx]!==T_FLOOR; };
const visionTile = (tx,ty)=>{ if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return true; const t=MAP.grid[ty*MAP_W+tx]; return t===T_WALL||t===T_CRATE||t===T_RACK||t===T_TREE||t===T_ROCK; };

function losClear(x1,y1,x2,y2,smokes){
  const d=dist(x1,y1,x2,y2), steps=Math.max(1,Math.ceil(d/7));
  for(let i=1;i<steps;i++){ const t=i/steps, x=x1+(x2-x1)*t, y=y1+(y2-y1)*t;
    if(visionTile(Math.floor(x/TILE),Math.floor(y/TILE))) return false; }
  if(smokes){ for(const s of smokes){ if(s.r>18){
    // distance point-to-segment
    const vx=x2-x1, vy=y2-y1, wx=s.x-x1, wy=s.y-y1, len2=vx*vx+vy*vy||1;
    let tt=clamp((wx*vx+wy*vy)/len2,0,1); const px=x1+vx*tt-s.x, py=y1+vy*tt-s.y;
    if(px*px+py*py < (s.r*0.85)*(s.r*0.85)) return false;
  } } }
  return true;
}
function moveCircle(p, dx, dy){
  p.x += dx; p.y += dy;
  for(let iter=0; iter<3; iter++){
    let pushed=false;
    const minTx=Math.floor((p.x-PLAYER_R-1)/TILE), maxTx=Math.floor((p.x+PLAYER_R+1)/TILE);
    const minTy=Math.floor((p.y-PLAYER_R-1)/TILE), maxTy=Math.floor((p.y+PLAYER_R+1)/TILE);
    for(let ty=minTy;ty<=maxTy;ty++)for(let tx=minTx;tx<=maxTx;tx++){
      if(!solidTile(tx,ty)) continue;
      const rx0=tx*TILE, ry0=ty*TILE, rx1=rx0+TILE, ry1=ry0+TILE;
      const nx=clamp(p.x,rx0,rx1), ny=clamp(p.y,ry0,ry1);
      const ddx=p.x-nx, ddy=p.y-ny, d2=ddx*ddx+ddy*ddy;
      if(d2 >= PLAYER_R*PLAYER_R) continue;
      if(d2 > 0.0001){
        const d=Math.sqrt(d2), push=PLAYER_R-d;
        p.x += ddx/d*push; p.y += ddy/d*push;
      } else {
        // center inside the tile: exit along the smallest penetration axis
        const left=p.x-rx0, right=rx1-p.x, top=p.y-ry0, bottom=ry1-p.y;
        const m=Math.min(left,right,top,bottom);
        if(m===left) p.x=rx0-PLAYER_R; else if(m===right) p.x=rx1+PLAYER_R;
        else if(m===top) p.y=ry0-PLAYER_R; else p.y=ry1+PLAYER_R;
      }
      pushed=true;
    }
    if(!pushed) break;
  }
  p.x=clamp(p.x,PLAYER_R,WORLD_W-PLAYER_R); p.y=clamp(p.y,PLAYER_R,WORLD_H-PLAYER_R);
}
/* A* on tile grid */
function findPath(sx,sy,gx,gy){
  const s={x:clamp(Math.floor(sx/TILE),0,MAP_W-1), y:clamp(Math.floor(sy/TILE),0,MAP_H-1)};
  const gT={x:clamp(Math.floor(gx/TILE),0,MAP_W-1), y:clamp(Math.floor(gy/TILE),0,MAP_H-1)};
  const key=(x,y)=>y*MAP_W+x;
  const open=new Map(), came=new Map(), gScore=new Map(), closed=new Set();
  const h=(x,y)=>Math.abs(x-gT.x)+Math.abs(y-gT.y);
  const passable=(x,y)=>!solidTile(x,y);
  let goal=gT;
  if(!passable(goal.x,goal.y)){ // find nearest passable
    let found=null;
    for(let r=1;r<5&&!found;r++) for(let j=-r;j<=r&&!found;j++)for(let i=-r;i<=r;i++){ if(passable(gT.x+i,gT.y+j)){found={x:gT.x+i,y:gT.y+j};break;} }
    if(!found) return []; goal=found;
  }
  gScore.set(key(s.x,s.y),0); open.set(key(s.x,s.y),{x:s.x,y:s.y,f:h(s.x,s.y)});
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(open.size){
    let cur=null,bestF=Infinity;
    for(const n of open.values()) if(n.f<bestF){bestF=n.f;cur=n;}
    open.delete(key(cur.x,cur.y));
    if(cur.x===goal.x&&cur.y===goal.y){
      const path=[]; let c=cur;
      while(c){ path.push({x:(c.x+0.5)*TILE,y:(c.y+0.5)*TILE}); c=came.get(key(c.x,c.y)); }
      return path.reverse();
    }
    closed.add(key(cur.x,cur.y));
    const cg=gScore.get(key(cur.x,cur.y));
    for(const d of DIRS){
      const nx=cur.x+d[0], ny=cur.y+d[1];
      if(!passable(nx,ny)||closed.has(key(nx,ny))) continue;
      if(d[0]!==0&&d[1]!==0&&(!passable(cur.x+d[0],cur.y)||!passable(cur.x,cur.y+d[1]))) continue; // no corner cut
      const ng=cg+((d[0]!==0&&d[1]!==0)?1.41:1);
      if(ng<(gScore.get(key(nx,ny))??Infinity)){
        gScore.set(key(nx,ny),ng); came.set(key(nx,ny),cur);
        open.set(key(nx,ny),{x:nx,y:ny,f:ng+h(nx,ny)});
      }
    }
    if(closed.size>3000) break;
  }
  return [];
}

/* ---------------- game ---------------- */
let NEXT_ID = 1;
class Game {
  constructor(opts){
    opts = opts||{};
    this.diff = DIFFS[opts.difficulty] ? opts.difficulty : 'normal';
    this.teamSize = opts.teamSize || 5;
    this.players = new Map();
    this.bullets = []; this.grenades = []; this.smokes = [];
    this.events = []; this.eventSeq = 0;
    this.time = 0;
    this.phase = 'warmup'; this.phaseT = 0;
    this.round = 0; this.score = {CT:0,T:0};
    this.lossStreak = {CT:0,T:0};
    this.bomb = { state:'carried', carrierId:null, x:0,y:0, timer:0, site:null };
    this.targetSite = 'A';
    this.intel = { CT:{lastSeen:null,plantedSite:null}, T:{lastSeen:null,plantedSite:null} };
    this.winnerText = ''; this.matchOver = false; this.halftimeDone = false;
    this.botNamesUsed = new Set();
    this.randTick = 0;
    this.mode = MAP.mode;
    this.hostages = []; this.ground = []; this.groundSeq = 0; this.pendingMap = null;
    this.postPos = {A:[],B:[]}; this.guardPos = [];
    this.#regenPositions();
  }
  /* ---------- players ---------- */
  addPlayer(o){
    const id = o.id || ('p'+(NEXT_ID++));
    const team = o.team || this.#pickTeam();
    const p = {
      id, name:(o.name||'Player').slice(0,16), team, isBot:!!o.isBot, connected:true,
      x:0,y:0, angle:0, hp:100, armor:0, alive:false, money:800,
      kills:0, deaths:0, assists:0,
      weapons:{}, current:'pistol', grenadeSel:null,
      grenades:{}, hasBomb:false, hasKit:false,
      fireCd:0, reloadT:0, lastFireT:-9, prevFire:false,
      channel:{type:null,t:0,need:0},
      blindT:0, speedNow:0, lastDamageFrom:null, lastDamageT:-9, firedT:-9,
      spectateId:null, joinedRound:this.round,
      input:{mx:0,my:0,angle:0,fire:false,walk:false,use:false,reload:false,slot:0,drop:false},
      prevInput:{reload:false,use:false,drop:false},
      bot:null,
    };
    this.#givePistol(p);
    if(p.isBot) p.bot = this.#newBotBrain();
    this.players.set(id,p);
    return p;
  }
  removePlayer(id){
    const p=this.players.get(id);
    if(p){ if(p.hasBomb) this.#dropBomb(p); this.players.delete(id); }
  }
  #pickTeam(){
    let ct=0,t=0; for(const p of this.players.values()) (p.team==='CT'?ct++:t++);
    return ct<=t ? 'CT' : 'T';
  }
  #givePistol(p){
    const w=WEAPONS.pistol;
    p.weapons.pistol={ ammo:w.mag, reserve:w.reserve };
    if(!p.weapons.knife) p.weapons.knife={ ammo:0, reserve:0 };
    if(!WEAPONS[p.current] || !p.weapons[p.current]) p.current='pistol';
  }
  #newBotBrain(){
    return { path:[], pathI:0, repathT:0, thinkT:Math.random()*0.2, target:null, holdPos:null,
      seenEnemy:null, seenT:-9, engageT:0, burst:0, burstPauseT:0, strafeDir:1, strafeT:0,
      stuckPos:null, stuckT:0, role:'rifle', aimAngle:0, nadeCd:5+Math.random()*8 };
  }
  addBot(team){
    let name = BOT_NAMES.find(n=>!this.botNamesUsed.has(n)) || ('BOT '+(NEXT_ID));
    this.botNamesUsed.add(name);
    return this.addPlayer({ name, team, isBot:true });
  }
  /** Ensure teamSize per team: humans first, bots fill. Returns changes. */
  fillWithBots(){
    for(const team of ['CT','T']){
      const members=[...this.players.values()].filter(p=>p.team===team);
      const humans=members.filter(p=>!p.isBot), bots=members.filter(p=>p.isBot);
      if(humans.length+bots.length < this.teamSize){
        for(let i=humans.length+bots.length;i<this.teamSize;i++) this.addBot(team);
      } else if(humans.length+bots.length > this.teamSize){
        let excess=humans.length+bots.length-this.teamSize;
        const sorted=[...bots].sort((a,b)=>(a.alive?1:0)-(b.alive?1:0)); // remove dead bots first
        for(const b of sorted){ if(excess<=0)break; this.botNamesUsed.delete(b.name); this.removePlayer(b.id); excess--; }
      }
    }
  }
  /* ---------- events ---------- */
  ev(type, data){ const e=Object.assign({seq:++this.eventSeq,type,t:this.time},data||{}); this.events.push(e); if(this.events.length>400) this.events.splice(0,this.events.length-400); return e; }
  eventsSince(seq){ return this.events.filter(e=>e.seq>seq); }

  /* ---------- match flow ---------- */
  startMatch(){
    if(this.pendingMap && this.pendingMap!==MAP.key){ setMap(this.pendingMap); this.pendingMap=null; }
    this.mode=MAP.mode; this.#regenPositions();
    this.score={CT:0,T:0}; this.lossStreak={CT:0,T:0}; this.round=0; this.matchOver=false; this.halftimeDone=false;
    for(const p of this.players.values()){ p.money=800; p.kills=0;p.deaths=0;p.assists=0; p.weapons={}; this.#givePistol(p); p.grenades={}; }
    this.#startRound();
  }
  #startRound(){
    this.round++;
    this.phase='freeze'; this.phaseT=4; this.winnerText='';
    this.bullets.length=0; this.grenades.length=0; this.smokes.length=0; this.ground.length=0;
    this.bomb = this.mode==='bomb'
      ? { state:'carried', carrierId:null, x:0,y:0, timer:0, site:null }
      : { state:'none', carrierId:null, x:0,y:0, timer:0, site:null };
    this.hostages = (MAP.hostages||[]).map((h,i)=>({ id:'H'+i, x:h.x, y:h.y, home:{x:h.x,y:h.y}, hp:100, alive:true,
      state:'idle', followId:null, angle:Math.PI/2, path:[], pathI:0, repathT:0 }));
    this.intel={ CT:{lastSeen:null,plantedSite:null}, T:{lastSeen:null,plantedSite:null} };
    this.targetSite = Math.random()<0.5 ? 'A' : 'B';
    // spawn
    const used={CT:0,T:0};
    const ts=[...this.players.values()].filter(p=>p.team==='T');
    const carrier = (this.mode==='bomb' && ts.length) ? ts[Math.floor(Math.random()*ts.length)] : null;
    for(const p of this.players.values()){
      const sp = MAP.spawns[p.team][used[p.team]++ % MAP.spawns[p.team].length];
      p.x=sp.x+ (Math.random()*10-5); p.y=sp.y+(Math.random()*10-5);
      p.angle = p.team==='CT' ? Math.PI : 0;
      p.hp=100; p.alive=true; p.reloadT=0; p.fireCd=0; p.blindT=0;
      p._spawnedRound=this.round;
      p.channel={type:null,t:0,need:0}; p.hasBomb = (carrier && p.id===carrier.id);
      if(p.hasBomb) this.bomb.carrierId=p.id;
      // refill current weapon mags partially? CS keeps weapons; ensure pistol exists
      if(!p.weapons.pistol) this.#givePistol(p);
      for(const k in p.weapons){ const w=WEAPONS[k]; p.weapons[k].ammo=w.mag; p.weapons[k].reserve=Math.max(p.weapons[k].reserve, w.mag); }
      if(!p.weapons[p.current]) p.current = this.#bestKey(p);
      p.grenadeSel=null;
      if(p.bot) Object.assign(p.bot, this.#newBotBrain());
    }
    // bot roles / holds
    this.#assignBotRoles();
    // bots buy at freeze start
    for(const p of this.players.values()) if(p.isBot) this.#botBuy(p);
    this.ev('roundStart',{round:this.round});
  }
  #assignBotRoles(){
    if(this.mode==='hostage'){
      const tB=[...this.players.values()].filter(p=>p.team==='T'&&p.isBot);
      tB.forEach((b,i)=>{ b.bot.role=(i<3?'guard':'flex'); b.bot.holdPos=this.guardPos.length?this.guardPos[i%this.guardPos.length]:null; });
      const cB=[...this.players.values()].filter(p=>p.team==='CT'&&p.isBot);
      cB.forEach(b=>{ b.bot.role='rescue'; b.bot.holdPos=null; });
      return;
    }
    const cts=[...this.players.values()].filter(p=>p.team==='CT'&&p.isBot);
    const ctHolds=[...MAP.holds.CT_A, ...MAP.holds.CT_MID, ...MAP.holds.CT_B];
    cts.forEach((b,i)=>{ b.bot.holdPos = ctHolds[i%ctHolds.length]; b.bot.role='hold'; });
    const tsBots=[...this.players.values()].filter(p=>p.team==='T'&&p.isBot);
    tsBots.forEach((b,i)=>{ b.bot.role = (i===tsBots.length-1 && tsBots.length>2) ? 'lurk' : 'push'; });
  }
  #endRound(winner, reason){
    if(this.phase==='end') return;
    this.phase='end'; this.phaseT=4.5;
    this.score[winner]++;
    const loser = winner==='CT'?'T':'CT';
    this.lossStreak[loser]++; this.lossStreak[winner]=0;
    const loseBonus = Math.min(1400 + (this.lossStreak[loser]-1)*500, 3400);
    for(const p of this.players.values()){
      if(p.team===winner) p.money=Math.min(16000,p.money+3250);
      else { p.money=Math.min(16000,p.money+loseBonus + (p.team==='T'&&this.bomb.state==='planted'?600:0)); }
      p.channel={type:null,t:0,need:0};
    }
    this.winnerText = (winner==='CT'?'Спецназ':'Террористы')+' · '+reason;
    this.ev('roundEnd',{winner, reason, text:this.winnerText});
    // match end? first to 7, halftime at round 6
    if(this.score.CT>=7 || this.score.T>=7) this.matchOver=true;
  }
  #swapSides(){
    for(const p of this.players.values()){ p.team = p.team==='CT'?'T':'CT'; p.money=800; p.weapons={}; this.#givePistol(p); p.grenades={}; }
    const s=this.score.CT; this.score.CT=this.score.T; this.score.T=s;
    this.lossStreak={CT:0,T:0}; this.halftimeDone=true;
    this.ev('halftime',{});
  }
  /* ---------- buy ---------- */
  canBuy(p){
    if(!p.alive) return false;
    if(this.phase==='freeze') return true;
    if(this.phase==='live' && (105-this.phaseT)<20){
      const sp=MAP.spawns[p.team][0]; return dist(p.x,p.y,sp.x,sp.y) < 7*TILE;
    }
    return false;
  }
  buy(id, key){
    const p=this.players.get(id); if(!p||!this.canBuy(p)) return false;
    if(WEAPONS[key]){
      const w=WEAPONS[key]; if(p.money<w.price) return false;
      if(p.weapons[key]){ p.weapons[key].reserve=w.reserve; return false; } // already owned: free ammo top-up
      for(const k of Object.keys(p.weapons)) if(k!==key && WEAPONS[k].slot===w.slot) this.#dropWeaponKey(p,k);
      p.money-=w.price; p.weapons[key]={ammo:w.mag,reserve:w.reserve};
      p.current=key; p.grenadeSel=null;
      return true;
    }
    if(ITEMS[key]){
      const it=ITEMS[key]; if(p.money<it.price) return false;
      if(it.ctOnly && p.team!=='CT') return false;
      if(key==='kit' && this.mode!=='bomb') return false;
      if(key==='armor'){ if(p.armor>=100) return false; p.money-=it.price; p.armor=100; return true; }
      if(key==='kit'){ if(p.hasKit) return false; p.money-=it.price; p.hasKit=true; return true; }
      if(it.grenade){ if(p.grenades[key]) return false; p.money-=it.price; p.grenades[key]=1; return true; }
    }
    return false;
  }
  #botBuy(p){
    const buy=(k)=>this.buy(p.id,k);
    if(this.round===1 || (this.round===7&&this.halftimeDone)){ // pistol round
      if(Math.random()<0.7) buy('armor'); if(Math.random()<0.35) buy('he'); if(Math.random()<0.3) buy('flash');
      if(this.mode==='bomb'&&p.team==='CT'&&Math.random()<0.4) buy('kit');
      return;
    }
    const primKey=this.#slotKey(p,'primary');
    const primTier=primKey?WEAPON_TIER[primKey]:0;
    if(p.money>=2900){ if(primTier<4) buy(Math.random()<0.18?'p90':'rifle'); buy('armor'); }
    else if(p.money>=2100){ if(!primKey&&Math.random()<0.8){ buy(['famas','smg','scout','shotgun'][Math.floor(Math.random()*4)]); buy('armor'); } else if(Math.random()<0.5) buy('armor'); }
    else if(p.money>=1400 && Math.random()<0.45 && this.#slotKey(p,'secondary')==='pistol'){ buy('deagle'); }
    else if(p.money>=650 && Math.random()<0.5){ buy('armor'); }
    if(Math.random()<0.15 && p.money>=4750 && primKey!=='awp') buy('awp');
    if(p.money>=900){ if(Math.random()<0.5)buy('smoke'); if(Math.random()<0.5)buy('he'); if(Math.random()<0.4)buy('flash'); }
    if(this.mode==='bomb'&&p.team==='CT'&&Math.random()<0.5) buy('kit');
  }
  /* ---------- input ---------- */
  setInput(id, inp){
    const p=this.players.get(id); if(!p||p.isBot||!inp) return;
    p.input = { mx:clamp(+inp.mx||0,-1,1), my:clamp(+inp.my||0,-1,1), angle:+inp.angle||0,
      fire:!!inp.fire, walk:!!inp.walk, use:!!inp.use, reload:!!inp.reload, slot:inp.slot|0, drop:!!inp.drop };
  }
  cycleSpectate(id){
    const p=this.players.get(id); if(!p||p.alive) return;
    const mates=[...this.players.values()].filter(q=>q.team===p.team&&q.alive);
    if(!mates.length) { p.spectateId=null; return; }
    const i=mates.findIndex(q=>q.id===p.spectateId);
    p.spectateId=mates[(i+1)%mates.length].id;
  }

  /* ---------- main tick ---------- */
  #spawnLate(p){ // joined during freeze time -> spawn right away
    const idx=[...this.players.values()].filter(q=>q.team===p.team&&q.alive).length;
    const sp=MAP.spawns[p.team][idx%MAP.spawns[p.team].length];
    p.x=sp.x; p.y=sp.y; p.hp=100; p.alive=true; p.reloadT=0; p.fireCd=0; p.blindT=0;
    p._spawnedRound=this.round; p.channel={type:null,t:0,need:0};
    if(!p.weapons.pistol) this.#givePistol(p);
    if(p.isBot){ Object.assign(p.bot,this.#newBotBrain()); this.#assignBotRoles(); this.#botBuy(p); }
  }
  tick(dt){
    this.time+=dt;
    if(this.phase==='freeze') for(const p of this.players.values()) if(!p.alive && p._spawnedRound!==this.round) this.#spawnLate(p);
    // bots think -> produce inputs
    for(const p of this.players.values()) if(p.isBot && p.alive) this.#botThink(p,dt);
    for(const p of this.players.values()) if(p.alive) this.#updatePlayer(p,dt);
    // pairwise separation (symmetric, prevents doorway sticking)
    const aliveList=[...this.players.values()].filter(p=>p.alive);
    for(let i=0;i<aliveList.length;i++)for(let j=i+1;j<aliveList.length;j++){
      const a=aliveList[i], b=aliveList[j], d2=dist2(a.x,a.y,b.x,b.y), min=PLAYER_R*2;
      if(d2<min*min && d2>0.01){ const d=Math.sqrt(d2), push=(min-d)/2+0.05, nx=(a.x-b.x)/d, ny=(a.y-b.y)/d;
        moveCircle(a,nx*push,ny*push); moveCircle(b,-nx*push,-ny*push); }
    }
    this.#updateBullets(dt);
    this.#updateGrenades(dt);
    this.#updateHostages(dt);
    for(const s of this.smokes){ s.t+=dt; s.r=Math.min(72, s.r+dt*60); }
    this.smokes=this.smokes.filter(s=>s.t<13);
    // phase timers
    if(this.phase==='freeze'){
      this.phaseT-=dt; if(this.phaseT<=0){ this.phase='live'; this.phaseT=105; this.ev('live',{}); }
    } else if(this.phase==='live'){
      this.phaseT-=dt;
      if(this.phaseT<=0 && this.bomb.state!=='planted'){
        if(this.mode==='hostage') this.#endRound('T','Время вышло — заложники не спасены');
        else this.#endRound('CT','Время вышло');
      }
    } else if(this.phase==='end'){
      this.phaseT-=dt;
      if(this.phaseT<=0){
        if(this.matchOver){ this.startMatch(); }
        else { if(this.round===6 && !this.halftimeDone) this.#swapSides(); this.#startRound(); }
      }
    }
    if(this.bomb.state==='planted'){
      this.bomb.timer-=dt;
      if(this.bomb.timer<=0 && this.phase!=='end'){
        this.ev('bombBoom',{x:this.bomb.x,y:this.bomb.y});
        for(const p of this.players.values()) if(p.alive && dist(p.x,p.y,this.bomb.x,this.bomb.y)<170) this.#damage(p, 500, null);
        this.#endRound('T','Бомба взорвалась');
      }
    }
    // elimination check
    if((this.phase==='live') && this.players.size){
      let ctAlive=0,tAlive=0,ctAny=false,tAny=false;
      for(const p of this.players.values()){ if(p.team==='CT'){ctAny=true; if(p.alive)ctAlive++;} else {tAny=true; if(p.alive)tAlive++;} }
      if(ctAny&&tAny){
        if(tAlive===0 && this.bomb.state!=='planted') this.#endRound('CT','Команда уничтожена');
        else if(ctAlive===0) this.#endRound('T','Команда уничтожена');
      }
    }
  }
  #updatePlayer(p,dt){
    const inp=p.input;
    const frozen = this.phase==='freeze';
    // slot switching (edge: client sends slot number when pressed, sim stores last)
    if(inp.slot && inp.slot!==p._lastSlot){
      p._lastSlot=inp.slot;
      if(inp.slot===1){ const prim=this.#slotKey(p,'primary'); if(prim){p.current=prim;p.grenadeSel=null;p.reloadT=0;} }
      if(inp.slot===2){ const sec=this.#slotKey(p,'secondary'); if(sec){p.current=sec;p.grenadeSel=null;p.reloadT=0;} }
      if(inp.slot===3){ p.current='knife'; p.grenadeSel=null; p.reloadT=0; }
      if(inp.slot===4){
        const order=['he','smoke','flash'].filter(k=>p.grenades[k]);
        if(order.length){ const i=order.indexOf(p.grenadeSel); p.grenadeSel = i<0 ? order[0] : order[(i+1)%order.length]; }
      }
    }
    if(!inp.slot) p._lastSlot=0;
    p.angle = inp.angle;
    if(p.blindT>0) p.blindT-=dt;
    // channel (plant/defuse/pickup)
    const moving = (inp.mx!==0||inp.my!==0);
    this.#updateChannel(p,dt,moving);
    // movement
    const w=WEAPONS[p.current];
    let sp = 218 * (w?w.moveSpeed:1) * (inp.walk?0.52:1) * floorSpeedAt(p.x,p.y);
    if(frozen) sp=0;
    if(p.channel.type) sp=0;
    let mx=inp.mx,my=inp.my; const ml=Math.hypot(mx,my);
    if(ml>1){mx/=ml;my/=ml;}
    const ox=p.x,oy=p.y;
    moveCircle(p, mx*sp*dt, my*sp*dt);
    // (player-player separation runs as a symmetric pass in tick)
    p.speedNow = dt>0 ? dist(p.x,p.y,ox,oy)/dt : 0;
    // pickup bomb by walking over (T)
    if(p.team==='T' && this.bomb.state==='dropped' && dist(p.x,p.y,this.bomb.x,this.bomb.y)<22){
      this.bomb.state='carried'; this.bomb.carrierId=p.id; p.hasBomb=true; this.ev('bombPickup',{by:p.id});
    }
    // ground weapons: auto-pickup into empty slot; bots swap for a better tier
    for(let gi=this.ground.length-1; gi>=0; gi--){
      const gw=this.ground[gi];
      if(dist(p.x,p.y,gw.x,gw.y)>20) continue;
      const slot=WEAPONS[gw.key].slot, cur=this.#slotKey(p,slot);
      if(!cur){
        this.ground.splice(gi,1);
        p.weapons[gw.key]={ammo:gw.ammo,reserve:gw.reserve};
        if(p.current==='knife'||slot==='primary'){ p.current=gw.key; p.grenadeSel=null; p.reloadT=0; }
        this.ev('pickup',{x:p.x,y:p.y,key:gw.key,id:p.id});
      } else if(p.isBot && WEAPON_TIER[gw.key]>WEAPON_TIER[cur]){
        this.#swapGround(p,gi);
      }
    }
    // reload
    if(p.reloadT>0){ p.reloadT-=dt; if(p.reloadT<=0){ const st=p.weapons[p.current]; if(st){ const need=w.mag-st.ammo, take=Math.min(need,st.reserve); st.ammo+=take; st.reserve-=take; } } }
    if(inp.reload && !p.prevInput.reload && !p.grenadeSel) this.#tryReload(p);
    if(inp.drop && !p.prevInput.drop && p.current!=='knife' && !p.grenadeSel && this.phase==='live') this.#dropWeaponKey(p,p.current);
    // fire
    if(p.fireCd>0) p.fireCd-=dt;
    if(inp.fire && !frozen && this.phase==='live'){
      if(p.grenadeSel){ if(!p.prevFire) this.#throwGrenade(p); }
      else this.#tryFire(p,dt);
    }
    p.prevFire=inp.fire;
    p.prevInput={reload:inp.reload, use:inp.use, drop:inp.drop};
  }
  #tryReload(p){
    const w=WEAPONS[p.current], st=p.weapons[p.current];
    if(!w||!st||p.reloadT>0||st.ammo>=w.mag||st.reserve<=0) return;
    p.reloadT=w.reload; this.ev('reload',{x:p.x,y:p.y,id:p.id});
  }
  #tryFire(p){
    const w=WEAPONS[p.current], st=p.weapons[p.current];
    if(!w||!st||p.reloadT>0||p.fireCd>0) return;
    if(!w.auto && p.prevFire) return;
    if(w.slot==='melee'){
      p.fireCd=60/w.rpm;
      let best=null,bestD=40;
      for(const e of this.players.values()){
        if(!e.alive||e.team===p.team) continue;
        const d=dist(p.x,p.y,e.x,e.y);
        if(d<bestD && Math.abs(angDiff(p.angle,Math.atan2(e.y-p.y,e.x-p.x)))<1.1){ best=e; bestD=d; }
      }
      let hit=false;
      if(best){
        const behind=Math.abs(angDiff(best.angle, Math.atan2(p.y-best.y,p.x-best.x)))>2.2;
        this.#damage(best, behind?95:w.dmg, p); hit=true;
      }
      this.ev('knife',{x:p.x,y:p.y,id:p.id,hit});
      return;
    }
    if(st.ammo<=0){ this.#tryReload(p); p.fireCd=0.25; return; }
    st.ammo--; p.fireCd=60/w.rpm; p.firedT=this.time;
    const movingFactor = clamp(p.speedNow/218,0,1);
    const spreadDeg = w.spread + w.moveSpread*movingFactor*movingFactor;
    for(let i=0;i<w.pellets;i++){
      const a=p.angle + (Math.random()*2-1)*spreadDeg*Math.PI/180;
      this.bullets.push({ x:p.x+Math.cos(p.angle)*16, y:p.y+Math.sin(p.angle)*16,
        vx:Math.cos(a)*w.bulletSpeed, vy:Math.sin(a)*w.bulletSpeed,
        dmg:w.dmg, owner:p.id, team:p.team, life:1.1, traveled:0 });
    }
    this.ev('shot',{x:p.x,y:p.y,angle:p.angle,weapon:p.current,id:p.id,team:p.team});
    // noise intel for bots (handled in bot perception via firedT)
    if(st.ammo===0) this.#tryReload(p);
  }
  #throwGrenade(p){
    const kind=p.grenadeSel; if(!kind||!p.grenades[kind]) return;
    p.grenades[kind]=0; p.grenadeSel=null;
    const sp=430;
    this.grenades.push({ kind, x:p.x+Math.cos(p.angle)*14, y:p.y+Math.sin(p.angle)*14,
      vx:Math.cos(p.angle)*sp, vy:Math.sin(p.angle)*sp, t:0, fuse: kind==='smoke'?0.9:1.35, owner:p.id, team:p.team });
    this.ev('throw',{x:p.x,y:p.y,kind,id:p.id});
  }
  #updateChannel(p,dt,moving){
    const inp=p.input;
    const siteOf=(x,y)=>{ for(const k of ['A','B']){ const s=MAP.sites[k]; if(dist(x,y,s.cx,s.cy)<s.r) return k; } return null; };
    if(!inp.use || this.phase!=='live'){ if(p.channel.type){ p.channel={type:null,t:0,need:0}; } return; }
    if(p.team==='T' && p.hasBomb && this.bomb.state==='carried'){
      const sk=siteOf(p.x,p.y);
      if(sk){
        if(p.channel.type!=='plant'){ p.channel={type:'plant',t:0,need:3.2,site:sk}; this.ev('planting',{id:p.id}); }
        if(moving) p.channel.t=Math.max(0,p.channel.t-dt*2); else p.channel.t+=dt;
        if(p.channel.t>=p.channel.need){
          p.hasBomb=false; this.bomb={state:'planted',carrierId:null,x:p.x,y:p.y,timer:35,site:sk};
          this.intel.CT.plantedSite=sk; this.intel.T.plantedSite=sk;
          p.money=Math.min(16000,p.money+300); p.channel={type:null,t:0,need:0};
          this.ev('planted',{site:sk,x:p.x,y:p.y});
        }
        return;
      }
    }
    if(p.team==='CT' && this.bomb.state==='planted' && dist(p.x,p.y,this.bomb.x,this.bomb.y)<30){
      if(p.channel.type!=='defuse'){ p.channel={type:'defuse',t:0,need:p.hasKit?2.5:5}; this.ev('defusing',{id:p.id}); }
      if(moving) p.channel.t=Math.max(0,p.channel.t-dt*2); else p.channel.t+=dt;
      if(p.channel.t>=p.channel.need){
        this.bomb.state='defused'; p.money=Math.min(16000,p.money+300); p.channel={type:null,t:0,need:0};
        this.ev('defused',{x:this.bomb.x,y:this.bomb.y});
        this.#endRound('CT','Бомба обезврежена');
      }
      return;
    }
    if(p.team==='CT' && this.mode==='hostage'){
      const h=this.hostages.find(h=>h.alive&&h.state==='idle'&&dist(p.x,p.y,h.x,h.y)<34);
      if(h){
        if(p.channel.type!=='untie'||p.channel.hostage!==h) p.channel={type:'untie',t:0,need:0.9,hostage:h};
        if(moving) p.channel.t=Math.max(0,p.channel.t-dt*2); else p.channel.t+=dt;
        if(p.channel.t>=p.channel.need){
          h.state='following'; h.followId=p.id; h.path=[]; h.pathI=0;
          p.channel={type:null,t:0,need:0};
          this.intel.T.lastSeen={x:h.x,y:h.y,t:this.time};
          this.ev('untied',{x:h.x,y:h.y,by:p.id});
        }
        return;
      }
    }
    if(!p.prevInput.use){
      const gi=this.ground.findIndex(g=>dist(p.x,p.y,g.x,g.y)<24);
      if(gi>=0 && this.#slotKey(p,WEAPONS[this.ground[gi].key].slot)){ this.#swapGround(p,gi); return; }
    }
    if(p.channel.type) p.channel={type:null,t:0,need:0};
  }
  #dropBomb(p){ p.hasBomb=false; this.bomb={state:'dropped',carrierId:null,x:p.x,y:p.y,timer:0,site:null}; this.ev('bombDropped',{x:p.x,y:p.y}); }
  #slotKey(p,slot){ return Object.keys(p.weapons).find(k=>WEAPONS[k].slot===slot)||null; }
  #bestKey(p){ return this.#slotKey(p,'primary')||this.#slotKey(p,'secondary')||'knife'; }
  #dropWeaponKey(p,key){
    const st=p.weapons[key]; if(!st||key==='knife') return;
    let gx=p.x+Math.cos(p.angle)*20, gy=p.y+Math.sin(p.angle)*20;
    if(solidTile(Math.floor(gx/TILE),Math.floor(gy/TILE))){ gx=p.x; gy=p.y; }
    this.ground.push({ id:'g'+(++this.groundSeq), key, ammo:st.ammo, reserve:st.reserve, x:gx, y:gy });
    delete p.weapons[key];
    if(p.current===key){ p.current=this.#bestKey(p); p.reloadT=0; }
    this.ev('drop',{x:gx,y:gy,key,id:p.id});
  }
  #swapGround(p,gi){
    const gw=this.ground[gi]; if(!gw) return;
    const slot=WEAPONS[gw.key].slot, cur=this.#slotKey(p,slot);
    this.ground.splice(gi,1);
    if(cur && cur!==gw.key) this.#dropWeaponKey(p,cur);
    p.weapons[gw.key]={ammo:gw.ammo,reserve:gw.reserve};
    p.current=gw.key; p.grenadeSel=null; p.reloadT=0;
    this.ev('pickup',{x:p.x,y:p.y,key:gw.key,id:p.id});
  }
  #damageHostage(h, dmg, attacker){
    if(!h.alive || this.phase!=='live') return;
    h.hp-=dmg;
    if(h.hp<=0){
      h.hp=0; h.alive=false; h.state='dead'; h.followId=null;
      if(attacker) attacker.money=Math.max(0,attacker.money-1000);
      this.ev('hostageDown',{x:h.x,y:h.y,by:attacker?attacker.id:null,byName:attacker?attacker.name:null});
    }
  }
  #updateHostages(dt){
    if(this.mode!=='hostage') return;
    for(const h of this.hostages){
      if(!h.alive || h.state!=='following') continue;
      const rescuer=this.players.get(h.followId);
      if(!rescuer || !rescuer.alive){ h.state='idle'; h.followId=null; continue; }
      if(MAP.rescue && dist(h.x,h.y,MAP.rescue.x,MAP.rescue.y)<MAP.rescue.r){
        h.state='rescued'; rescuer.money=Math.min(16000,rescuer.money+350);
        this.ev('rescued',{x:h.x,y:h.y,by:rescuer.id});
        this.#endRound('CT','Заложник спасён');
        continue;
      }
      const d=dist(h.x,h.y,rescuer.x,rescuer.y);
      if(d<30) continue;
      // direct steer if the straight line is walkable, else A*
      let clear=true; const steps=Math.ceil(d/8);
      for(let s=1;s<steps;s++){ const tx=h.x+(rescuer.x-h.x)*s/steps, ty=h.y+(rescuer.y-h.y)*s/steps;
        if(solidTile(Math.floor(tx/TILE),Math.floor(ty/TILE))){ clear=false; break; } }
      let tx=rescuer.x, ty=rescuer.y;
      if(!clear){
        h.repathT-=dt;
        if(h.repathT<=0 || !h.path.length){ h.path=findPath(h.x,h.y,rescuer.x,rescuer.y); h.pathI=0; h.repathT=0.8; }
        while(h.pathI<h.path.length && dist(h.x,h.y,h.path[h.pathI].x,h.path[h.pathI].y)<10) h.pathI++;
        if(h.pathI<h.path.length){ tx=h.path[h.pathI].x; ty=h.path[h.pathI].y; } else continue;
      }
      const a=Math.atan2(ty-h.y,tx-h.x); h.angle=a;
      const sp=200*floorSpeedAt(h.x,h.y);
      moveCircle(h, Math.cos(a)*sp*dt, Math.sin(a)*sp*dt);
    }
  }
  #damage(victim, dmg, attacker){
    if(!victim.alive || this.phase!=='live') return;
    let d=dmg;
    if(victim.armor>0){ d*=0.55; victim.armor=Math.max(0,victim.armor-dmg*0.4); }
    victim.hp-=d;
    victim.lastDamageFrom = attacker?attacker.id:null; victim.lastDamageT=this.time;
    victim.lastDamageAngle = attacker? Math.atan2(attacker.y-victim.y, attacker.x-victim.x) : victim.angle;
    if(victim.hp<=0){
      victim.hp=0; victim.alive=false; victim.deaths++;
      victim.channel={type:null,t:0,need:0};
      if(attacker && attacker.id!==victim.id){ attacker.kills++; attacker.money=Math.min(16000,attacker.money+300); }
      if(victim.hasBomb) this.#dropBomb(victim);
      const dropKey=(victim.current!=='knife'&&victim.weapons[victim.current])?victim.current:this.#slotKey(victim,'primary');
      if(dropKey) this.#dropWeaponKey(victim,dropKey);
      for(const h of this.hostages) if(h.followId===victim.id){ h.state='idle'; h.followId=null; }
      victim.weapons={}; this.#givePistol(victim); victim.current='pistol';
      victim.armor=0; victim.hasKit=false; victim.grenades={}; victim.grenadeSel=null;
      victim.deathT=this.time;
      this.ev('kill',{victim:victim.id, victimName:victim.name, victimTeam:victim.team,
        killer:attacker?attacker.id:null, killerName:attacker?attacker.name:null, killerTeam:attacker?attacker.team:null,
        weapon:attacker?attacker.current:null, x:victim.x,y:victim.y});
      // intel: teammates learn position of death
      const intel=this.intel[victim.team]; intel.lastSeen={x:victim.x,y:victim.y,t:this.time};
    }
  }
  #updateBullets(dt){
    const bs=this.bullets;
    for(let i=bs.length-1;i>=0;i--){
      const b=bs[i]; let remain=Math.hypot(b.vx,b.vy)*dt; let dead=false;
      while(remain>0 && !dead){
        const step=Math.min(remain,6), L=Math.hypot(b.vx,b.vy);
        b.x+=b.vx/L*step; b.y+=b.vy/L*step; b.traveled+=step; remain-=step;
        const tt=tileAt(b.x,b.y);
        if(bulletBlockTile(tt)){ this.ev('impact',{x:b.x,y:b.y,kind:'wall'}); dead=true; break; }
        for(const p of this.players.values()){
          if(!p.alive||p.id===b.owner||p.team===b.team) continue;
          if(dist2(b.x,b.y,p.x,p.y) < (PLAYER_R+2)*(PLAYER_R+2)){
            const fall = clamp(1 - Math.max(0,b.traveled-450)/1400, 0.55, 1);
            const owner=this.players.get(b.owner);
            this.ev('impact',{x:b.x,y:b.y,kind:'flesh',victim:p.id,shooter:b.owner,dmg:Math.round(b.dmg*fall)});
            this.#damage(p, b.dmg*fall, owner);
            dead=true; break;
          }
        }
        if(!dead) for(const h of this.hostages){
          if(!h.alive) continue;
          if(dist2(b.x,b.y,h.x,h.y)<(PLAYER_R+2)*(PLAYER_R+2)){
            const fall2=clamp(1-Math.max(0,b.traveled-450)/1400,0.55,1);
            this.ev('impact',{x:b.x,y:b.y,kind:'flesh',victim:h.id,shooter:b.owner,dmg:Math.round(b.dmg*fall2)});
            this.#damageHostage(h, b.dmg*fall2, this.players.get(b.owner));
            dead=true; break;
          }
        }
      }
      b.life-=dt;
      if(dead||b.life<=0) bs.splice(i,1);
    }
  }
  #updateGrenades(dt){
    for(let i=this.grenades.length-1;i>=0;i--){
      const g=this.grenades[i]; g.t+=dt;
      const sp=Math.hypot(g.vx,g.vy);
      if(sp>1){
        const nx=g.x+g.vx*dt, ny=g.y+g.vy*dt;
        if(tileAt(nx,g.y)===T_WALL){ g.vx*=-0.35; } else g.x=nx;
        if(tileAt(g.x,ny)===T_WALL){ g.vy*=-0.35; } else g.y=ny;
        const fr=Math.pow(0.25,dt); g.vx*=fr; g.vy*=fr;
      }
      if(g.t>=g.fuse){
        this.grenades.splice(i,1);
        const owner=this.players.get(g.owner);
        if(g.kind==='he'){
          this.ev('explosion',{x:g.x,y:g.y,kind:'he'});
          for(const p of this.players.values()){ if(!p.alive) continue;
            const d=dist(p.x,p.y,g.x,g.y);
            if(d<125 && losClear(g.x,g.y,p.x,p.y,null)){
              let dmg=Math.max(8, 92*(1-d/135)), atk=null;
              if(owner){ if(owner.team!==p.team) atk=owner; else dmg*=(owner===p?0.5:0.3); }
              this.#damage(p, dmg, atk);
            }
          }
          for(const h of this.hostages){ if(!h.alive) continue;
            const d=dist(h.x,h.y,g.x,g.y);
            if(d<125 && losClear(g.x,g.y,h.x,h.y,null)) this.#damageHostage(h, Math.max(8,92*(1-d/135)), owner);
          }
        } else if(g.kind==='smoke'){
          this.smokes.push({x:g.x,y:g.y,r:12,t:0}); this.ev('smokePop',{x:g.x,y:g.y});
        } else if(g.kind==='flash'){
          this.ev('flashPop',{x:g.x,y:g.y});
          for(const p of this.players.values()){ if(!p.alive) continue;
            const d=dist(p.x,p.y,g.x,g.y);
            if(d<420 && losClear(g.x,g.y,p.x,p.y,this.smokes)){
              const toF=Math.atan2(g.y-p.y,g.x-p.x);
              const facing=Math.abs(angDiff(p.angle,toF))<1.25;
              const dur = (facing? 2.6:0.7) * clamp(1-d/460,0.15,1);
              p.blindT=Math.max(p.blindT,dur); p.blindFull = facing;
            }
          }
        }
      }
    }
  }
  #genAround(px,py,rMin,rMax,count){
    const out=[];
    for(let ty=1;ty<MAP_H-1;ty++)for(let tx=1;tx<MAP_W-1;tx++){
      if(solidTile(tx,ty)) continue;
      const cx=(tx+0.5)*TILE, cy=(ty+0.5)*TILE, d=dist(cx,cy,px,py);
      if(d<rMin||d>rMax) continue;
      if(!losClear(cx,cy,px,py,null)) continue;
      let cover=0; for(const dd of [[1,0],[-1,0],[0,1],[0,-1]]) if(visionTile(tx+dd[0],ty+dd[1])) cover++;
      out.push({x:cx,y:cy,cover});
    }
    out.sort((a,b)=>b.cover-a.cover);
    const picked=[];
    for(const c of out){ if(picked.length>=count)break; if(picked.every(p=>dist(p.x,p.y,c.x,c.y)>2.2*TILE)) picked.push(c); }
    return picked.map(p=>({x:p.x,y:p.y}));
  }
  #regenPositions(){
    this.postPos={A:[],B:[]}; this.guardPos=[];
    if(this.mode==='bomb' && MAP.sites){
      for(const k of ['A','B']) this.postPos[k]=this.#genAround(MAP.sites[k].plant.x, MAP.sites[k].plant.y, 3*TILE, 6.5*TILE, 6);
    } else if(this.mode==='hostage' && MAP.hostages && MAP.hostages.length){
      const cx=MAP.hostages.reduce((s,h)=>s+h.x,0)/MAP.hostages.length;
      const cy=MAP.hostages.reduce((s,h)=>s+h.y,0)/MAP.hostages.length;
      this.guardPos=this.#genAround(cx,cy,2.2*TILE,6*TILE,6);
    }
  }
  /* ================= BOT AI ================= */
  #botPerceive(p){
    const b=p.bot, D=DIFFS[this.diff];
    let best=null,bestD=Infinity;
    if(p.blindT<=0){
      for(const e of this.players.values()){
        if(!e.alive||e.team===p.team) continue;
        const d=dist(p.x,p.y,e.x,e.y); if(d>920||d>=bestD) continue;
        const toE=Math.atan2(e.y-p.y,e.x-p.x);
        const inFov = Math.abs(angDiff(p.angle,toE))<1.05 || d<80;
        const heardShot = (this.time-e.firedT)<0.4 && d<420;
        if(!inFov && !heardShot) continue;
        if(!losClear(p.x,p.y,e.x,e.y,this.smokes)) continue;
        best=e; bestD=d;
      }
    }
    if(best){
      if(!b.seenEnemy || b.seenEnemy.id!==best.id || (this.time-b.seenT)>0.8){ const rf = this.mode==='hostage' ? (p.team==='CT'?1.0:0.82) : (p.team==='T'?0.88:1.03);
        b.engageT=this.time + D.reaction*rf*(0.75+Math.random()*0.5); }
      b.seenEnemy={id:best.id,x:best.x,y:best.y}; b.seenT=this.time;
      const intel=this.intel[p.team]; intel.lastSeen={x:best.x,y:best.y,t:this.time};
      return best;
    }
    return null;
  }
  #botObjectiveHostage(p){
    const b=p.bot;
    const hs=this.hostages.filter(h=>h.alive);
    if(p.team==='CT'){
      const mine=hs.find(h=>h.state==='following'&&h.followId===p.id);
      if(mine) return {x:MAP.rescue.x,y:MAP.rescue.y,action:'move'};
      const carried=hs.find(h=>h.state==='following');
      if(carried){
        if(!b.siteOff) b.siteOff={x:Math.random()*70-35,y:Math.random()*70-35};
        return {x:carried.x+b.siteOff.x,y:carried.y+b.siteOff.y,action:'move'};
      }
      const idle=hs.filter(h=>h.state==='idle').sort((a,c)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,c.x,c.y));
      const target=idle[0]||hs[0];
      if(!target){
        const intel=this.intel.CT;
        if(intel.lastSeen&&(this.time-intel.lastSeen.t)<8) return {x:intel.lastSeen.x,y:intel.lastSeen.y,action:'move'};
        return {x:WORLD_W/2,y:WORLD_H/2,action:'move'};
      }
      if(target.state==='idle' && dist(p.x,p.y,target.x,target.y)<26) return {x:target.x,y:target.y,action:'untie'};
      return {x:target.x,y:target.y,action:'move'};
    }
    // T: guard hostages; intercept if one is taken
    const carried=hs.find(h=>h.state==='following');
    const intel=this.intel.T;
    if(carried && intel.lastSeen && (this.time-intel.lastSeen.t)<9) return {x:intel.lastSeen.x,y:intel.lastSeen.y,action:'move'};
    if(carried && MAP.rescue){
      if(!b.siteOff) b.siteOff={x:Math.random()*90-45,y:Math.random()*90-45};
      const cx=(carried.home.x+MAP.rescue.x)/2+b.siteOff.x, cy=(carried.home.y+MAP.rescue.y)/2+b.siteOff.y;
      return {x:cx,y:cy,action:'move'};
    }
    if(b.role==='flex' && intel.lastSeen && (this.time-intel.lastSeen.t)<7) return {x:intel.lastSeen.x,y:intel.lastSeen.y,action:'move'};
    if(b.holdPos){
      const home=hs[0]||{x:WORLD_W/2,y:100};
      return {x:b.holdPos.x,y:b.holdPos.y,action:'hold',face:{x:home.x,y:home.y}};
    }
    const h0=hs[0];
    return h0?{x:h0.x,y:h0.y+40,action:'hold',face:{x:h0.x,y:h0.y}}:{x:p.x,y:p.y,action:'hold'};
  }
  #botObjective(p){
    if(this.mode==='hostage') return this.#botObjectiveHostage(p);
    const b=p.bot;
    const planted=this.bomb.state==='planted';
    if(p.team==='T'){
      if(this.bomb.state==='dropped'){
        // nearest T retrieves, others escort toward it
        return {x:this.bomb.x,y:this.bomb.y,action:'move'};
      }
      if(planted){
        // hear the defuse -> swarm the bomb
        const defusing=[...this.players.values()].some(q=>q.team==='CT'&&q.alive&&q.channel.type==='defuse');
        if(defusing) return {x:this.bomb.x,y:this.bomb.y,action:'move'};
        const holds = (this.postPos[this.bomb.site]&&this.postPos[this.bomb.site].length)?this.postPos[this.bomb.site]:(this.bomb.site==='A'?MAP.holds.T_Apost:MAP.holds.T_Bpost);
        if(!b.postPos){ const mates=[...this.players.values()].filter(q=>q.team==='T'&&q.isBot); b.postPos=holds[Math.max(0,mates.indexOf(p))%holds.length]; }
        return {x:b.postPos.x,y:b.postPos.y,action:'hold',face:{x:this.bomb.x,y:this.bomb.y}};
      }
      const site=MAP.sites[this.targetSite];
      if(p.hasBomb){
        if(dist(p.x,p.y,site.plant.x,site.plant.y)<20) return {x:site.plant.x,y:site.plant.y,action:'plant'};
        return {x:site.plant.x,y:site.plant.y,action:'move'};
      }
      if(b.role==='lurk' && this.phaseT>55){ return {x:24.5*TILE,y:16.5*TILE,action:'hold',face:{x:site.cx,y:site.cy}}; }
      const off=()=> (Math.random()*70-35);
      if(!b.siteOff) b.siteOff={x:off(),y:off()};
      const carrierP=[...this.players.values()].find(q=>q.team==='T'&&q.alive&&q.hasBomb);
      if(carrierP && carrierP.id!==p.id && dist(carrierP.x,carrierP.y,site.plant.x,site.plant.y)>6*TILE)
        return {x:carrierP.x+b.siteOff.x, y:carrierP.y+b.siteOff.y, action:'move'};
      return {x:site.cx+b.siteOff.x, y:site.cy+b.siteOff.y, action:'move'};
    } else { // CT
      if(planted){
        if(dist(p.x,p.y,this.bomb.x,this.bomb.y)<26){
          // defuse if no visible enemy very recently OR last CT standing
          const anyT=[...this.players.values()].some(q=>q.team==='T'&&q.alive);
          if(!anyT || (this.time-b.seenT)>1.2 || this.bomb.timer< (p.hasKit?3.2:5.8))
            return {x:this.bomb.x,y:this.bomb.y,action:'defuse'};
          return {x:p.x,y:p.y,action:'hold',face:{x:this.bomb.x,y:this.bomb.y}};
        }
        return {x:this.bomb.x,y:this.bomb.y,action:'move'};
      }
      const intel=this.intel.CT;
      if(this.bomb.state==='dropped' && intel.lastSeen && (this.time-intel.lastSeen.t)<20){
        return {x:this.bomb.x,y:this.bomb.y,action:'hold',face:intel.lastSeen};
      }
      if(intel.lastSeen && (this.time-intel.lastSeen.t)<6 && Math.random()<0.75){
        return {x:intel.lastSeen.x,y:intel.lastSeen.y,action:'move'};
      }
      if(b.holdPos) return {x:b.holdPos.x,y:b.holdPos.y,action:'hold',face:{x:WORLD_W/2,y:WORLD_H/2}};
      return {x:p.x,y:p.y,action:'hold'};
    }
  }
  #botThink(p,dt){
    const b=p.bot, D=DIFFS[this.diff];
    const inp={mx:0,my:0,angle:p.angle,fire:false,walk:false,use:false,reload:false,slot:0};
    if(this.phase!=='live'){ p.input=inp; return; }
    const enemy=this.#botPerceive(p);
    const w=WEAPONS[p.current], st=p.weapons[p.current];
    // reload logic
    if(st && (st.ammo===0 || (!enemy && st.ammo<=w.mag*0.3)) ) inp.reload=true;
    // damaged recently -> face attacker
    if(!enemy && (this.time-p.lastDamageT)<1.2 && p.lastDamageFrom){
      const atk=this.players.get(p.lastDamageFrom);
      if(atk&&atk.alive) inp.angle=Math.atan2(atk.y-p.y,atk.x-p.x);
    }
    if(enemy){
      if(p.grenadeSel && b.nadeCd>1) inp.slot=1; // back to gun unless about to throw
      // combat
      const d=dist(p.x,p.y,enemy.x,enemy.y);
      const err=(D.aimErr*Math.PI/180)*(0.5+Math.random());
      const targetAngle=Math.atan2(enemy.y-p.y,enemy.x-p.x) + Math.sin(this.time*2.1+p.x)*err*0.4;
      inp.angle=angLerp(p.angle,targetAngle,clamp(dt*14,0,1));
      // movement: strafe, stop during burst
      b.strafeT-=dt; if(b.strafeT<=0){ b.strafeT=0.5+Math.random()*0.9; b.strafeDir*=-1; }
      const canFire = this.time>=b.engageT && st && st.ammo>0 && p.reloadT<=0;
      if(b.burstPauseT>0) b.burstPauseT-=dt;
      if(canFire && b.burstPauseT<=0){
        inp.fire=true;
        b.burst += dt*(w.rpm/60);
        const burstLen = w.auto? (3+Math.random()*4) : 1;
        if(b.burst>=burstLen){ b.burst=0; b.burstPauseT=D.burstPause*(0.7+Math.random()*0.6); }
      } else {
        // strafe while not firing
        const sa=inp.angle+Math.PI/2*b.strafeDir;
        inp.mx=Math.cos(sa); inp.my=Math.sin(sa);
        if(d>430){ inp.mx+=Math.cos(inp.angle)*0.8; inp.my+=Math.sin(inp.angle)*0.8; } // close distance
        if(d<110){ inp.mx-=Math.cos(inp.angle)*0.6; inp.my-=Math.sin(inp.angle)*0.6; } // back off a bit
      }
      // occasional HE at seen enemy
      b.nadeCd-=dt;
      if(b.nadeCd<=0 && p.grenades.he && d>150&&d<420 && Math.random()<0.5){
        inp.slot=4; inp.fire=true; inp.angle=Math.atan2(enemy.y-p.y,enemy.x-p.x); b.nadeCd=8+Math.random()*8;
      }
      p.input=inp; return;
    }
    // no enemy: objective
    const obj=this.#botObjective(p);
    b.repathT-=dt;
    const targetChanged = !b.lastTarget || dist(b.lastTarget.x,b.lastTarget.y,obj.x,obj.y)>40;
    if(targetChanged || b.repathT<=0 || !b.path.length){
      b.path=findPath(p.x,p.y,obj.x,obj.y); b.pathI=0; b.repathT=1.2+Math.random()*0.6; b.lastTarget={x:obj.x,y:obj.y};
    }
    if(obj.action==='plant'){
      if((this.time-b.seenT)>0.6){ inp.use=true; inp.angle=p.angle; }
      p.input=inp; return;
    }
    if(obj.action==='defuse'){ inp.use=true; p.input=inp; return; }
    if(obj.action==='untie'){ if((this.time-b.seenT)>0.4) inp.use=true; p.input=inp; return; }
    // follow path
    let dest=null;
    while(b.pathI<b.path.length){
      const n=b.path[b.pathI];
      if(dist(p.x,p.y,n.x,n.y)<10){ b.pathI++; continue; }
      dest=n; break;
    }
    const atDest = !dest && dist(p.x,p.y,obj.x,obj.y)<26;
    if(dest){
      // shortcut: skip nodes in direct line (movement LOS without smoke)
      let look=dest;
      for(let i=b.pathI+1;i<Math.min(b.pathI+4,b.path.length);i++){
        const n=b.path[i];
        let clear=true; const dd=dist(p.x,p.y,n.x,n.y), steps=Math.ceil(dd/8);
        const ux=(n.x-p.x)/(dd||1), uy=(n.y-p.y)/(dd||1), px2=-uy*(PLAYER_R-1), py2=ux*(PLAYER_R-1);
        for(let s=1;s<steps&&clear;s++){ const tx=p.x+(n.x-p.x)*s/steps, ty=p.y+(n.y-p.y)*s/steps;
          for(const o of [[0,0],[px2,py2],[-px2,-py2]]) if(solidTile(Math.floor((tx+o[0])/TILE),Math.floor((ty+o[1])/TILE))){clear=false;break;} }
        if(clear){ look=n; b.pathI=i; } else break;
      }
      const a=Math.atan2(look.y-p.y,look.x-p.x);
      inp.mx=Math.cos(a); inp.my=Math.sin(a);
      const faceA = (b.seenEnemy && (this.time-b.seenT)<3) ? Math.atan2(b.seenEnemy.y-p.y,b.seenEnemy.x-p.x) : a;
      inp.angle=angLerp(p.angle,faceA,clamp(dt*8,0,1));
      // stuck detection
      b.stuckT+=dt;
      if(b.stuckT>0.9){
        if(b.stuckPos && dist(p.x,p.y,b.stuckPos.x,b.stuckPos.y)<6){ b.path=[]; b.repathT=0; const sd=(Math.random()<0.5?-1:1), tx2=inp.mx; inp.mx=-inp.my*sd; inp.my=tx2*sd; }
        b.stuckPos={x:p.x,y:p.y}; b.stuckT=0;
      }
    } else if(atDest || obj.action==='hold'){
      if(obj.face) inp.angle=angLerp(p.angle, Math.atan2(obj.face.y-p.y,obj.face.x-p.x), clamp(dt*5,0,1));
      else if(b.seenEnemy&&(this.time-b.seenT)<4) inp.angle=angLerp(p.angle, Math.atan2(b.seenEnemy.y-p.y,b.seenEnemy.x-p.x), clamp(dt*5,0,1));
      // small patrol sway
      inp.angle += Math.sin(this.time*0.7+p.y)*0.002;
    }
    // investigate lastSeen if close & recent but not visible
    p.input=inp;
  }
  /* ---------- snapshot (per-viewer, fog of war) ---------- */
  visibleTo(viewP, e){
    if(!viewP) return false;
    if(e.team===viewP.team) return true;
    const d=dist(viewP.x,viewP.y,e.x,e.y);
    if(d<64) return losClear(viewP.x,viewP.y,e.x,e.y,this.smokes) || d<26;
    return d<1000 && losClear(viewP.x,viewP.y,e.x,e.y,this.smokes);
  }
  snapshotFor(viewerId){
    const viewer=this.players.get(viewerId);
    let viewP=viewer;
    if(viewer && !viewer.alive){
      const spec = viewer.spectateId ? this.players.get(viewer.spectateId) : null;
      if(spec&&spec.alive) viewP=spec;
      else { const mate=[...this.players.values()].find(q=>q.team===viewer.team&&q.alive); if(mate){ viewP=mate; viewer.spectateId=mate.id; } }
    }
    const players=[], radar=[];
    const mates = viewer ? [...this.players.values()].filter(q=>q.team===viewer.team&&q.alive) : [];
    for(const p of this.players.values()){
      const isSelf = viewer&&p.id===viewer.id;
      const teammate = viewer&&p.team===viewer.team;
      const vis = isSelf || (viewP? this.visibleTo(viewP,p) : teammate);
      if(vis){
        players.push({ id:p.id,name:p.name,team:p.team,isBot:p.isBot,x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,
          angle:Math.round(p.angle*100)/100, hp:Math.ceil(p.hp), armor:Math.ceil(p.armor), alive:p.alive,
          weapon:p.current, grenadeSel:p.grenadeSel, hasBomb:(teammate||isSelf)?p.hasBomb:false,
          channel:p.channel.type?{type:p.channel.type,t:p.channel.t,need:p.channel.need}:null,
          speed:Math.round(p.speedNow), blind:p.blindT>0,
          ammo:isSelf&&p.weapons[p.current]?p.weapons[p.current].ammo:null,
          reserve:isSelf&&p.weapons[p.current]?p.weapons[p.current].reserve:null,
          reloading:p.reloadT>0 });
      }
      // radar blips: teammates always; enemy if fired recently (heard) or visible
      if(viewer && p.alive){
        if(teammate) radar.push({x:p.x,y:p.y,team:p.team,self:isSelf,angle:p.angle,bomb:p.hasBomb});
        else {
          const spotted = mates.some(m=>this.visibleTo(m,p));
          const heard = (this.time-p.firedT)<0.9 && viewer && dist(viewer.x,viewer.y,p.x,p.y)<640;
          if(spotted||heard) radar.push({x:p.x,y:p.y,team:p.team,self:false,angle:p.angle});
        }
      }
    }
    let bombInfo=null;
    if(this.bomb.state==='planted') bombInfo={state:'planted',x:this.bomb.x,y:this.bomb.y,site:this.bomb.site,timer:Math.round(this.bomb.timer*10)/10};
    else if(this.bomb.state==='dropped'){
      const tSees = viewer&&viewer.team==='T';
      const visSee = viewP && dist(viewP.x,viewP.y,this.bomb.x,this.bomb.y)<900 && losClear(viewP.x,viewP.y,this.bomb.x,this.bomb.y,this.smokes);
      if(tSees||visSee) bombInfo={state:'dropped',x:this.bomb.x,y:this.bomb.y};
      else bombInfo={state:'dropped'};
    } else if(this.bomb.state==='carried') bombInfo={state:'carried'};
    const self = viewer? {
      id:viewer.id, team:viewer.team, money:viewer.money, alive:viewer.alive, hp:Math.ceil(viewer.hp), armor:Math.ceil(viewer.armor),
      hasBomb:viewer.hasBomb, hasKit:viewer.hasKit, weapons:Object.keys(viewer.weapons), current:viewer.current,
      grenades:viewer.grenades, grenadeSel:viewer.grenadeSel, canBuy:this.canBuy(viewer),
      blindT:Math.round(viewer.blindT*100)/100, blindFull:!!viewer.blindFull,
      channel:viewer.channel.type?{type:viewer.channel.type,t:viewer.channel.t,need:viewer.channel.need}:null,
      spectating: (!viewer.alive&&viewP&&viewP!==viewer)?{id:viewP.id,name:viewP.name}:null,
      lastDamageAngle:viewer.lastDamageAngle, lastDamageT:viewer.lastDamageT,
    } : null;
    const board=[...this.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,isBot:p.isBot,kills:p.kills,deaths:p.deaths,alive:p.alive,money:(viewer&&p.team===viewer.team)?p.money:null})).sort((a,b)=>b.kills-a.kills);
    return {
      t:this.time, phase:this.phase, phaseT:Math.round(this.phaseT*10)/10, round:this.round,
      score:this.score, winnerText:this.winnerText, matchOver:this.matchOver,
      players, radar, bomb:bombInfo, self,
      map:{ key:MAP.key, name:MAP.name, mode:MAP.mode },
      hostages: this.hostages.map(h=>({ id:h.id, x:Math.round(h.x), y:Math.round(h.y), angle:h.angle, alive:h.alive,
        state:h.state, followId:h.followId, hp:Math.ceil(h.hp),
        vis: viewP ? (dist(viewP.x,viewP.y,h.x,h.y)<46 || losClear(viewP.x,viewP.y,h.x,h.y,this.smokes)) : false })),
      ground: this.ground
        .filter(g=> !viewP || dist(viewP.x,viewP.y,g.x,g.y)<55 || losClear(viewP.x,viewP.y,g.x,g.y,this.smokes))
        .map(g=>({ id:g.id, key:g.key, x:Math.round(g.x), y:Math.round(g.y), ammo:g.ammo })),
      grenades: this.grenades.map(g=>({x:g.x,y:g.y,kind:g.kind})),
      smokes: this.smokes.map(s=>({x:s.x,y:s.y,r:s.r,t:s.t})),
      view: viewP?{x:viewP.x,y:viewP.y,id:viewP.id,angle:viewP.angle}:null,
      board,
      aliveCount:{ CT:[...this.players.values()].filter(p=>p.team==='CT'&&p.alive).length, T:[...this.players.values()].filter(p=>p.team==='T'&&p.alive).length },
    };
  }
}

/* decor (deterministic) for renderer */
function computeDecor(){
  const rnd=mulberry(1337); const items=[];
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    const t=MAP.grid[y*MAP_W+x];
    if(t===T_FLOOR && rnd()<0.05) items.push({k:'paper',x:(x+rnd())*TILE,y:(y+rnd())*TILE,a:rnd()*3.14});
    if(t===T_FLOOR && rnd()<0.02) items.push({k:'stain',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:6+rnd()*14});
    if(t===T_DESK) items.push({k:'deskstuff',x:x*TILE,y:y*TILE,mon:rnd()<0.7,paper:rnd()});
  }
  return items;
}

const API = { Game, TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, WEAPONS, WEAPON_TIER, ITEMS, DIFFS,
  T_FLOOR,T_WALL,T_CRATE,T_DESK,T_RACK,T_TREE,T_ROCK, tileAt, solidTile, visionTile, losClear, moveCircle,
  findPath, computeDecor, mulberry, PLAYER_R, MAP_LIST, setMap, getMap, buildMapData, floorSpeedAt, bulletBlockTile };
Object.defineProperty(API,'MAP',{ enumerable:true, get:()=>MAP });
if(typeof module!=='undefined' && module.exports) module.exports=API;
global.SilentEntrySim = API;
})(typeof window!=='undefined' ? window : globalThis);
