/* SILENT ENTRY — LAN server: static files + authoritative WebSocket sim */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const Sim = require('./public/sim.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, path.normalize(url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---- game instance (always running; bots fill, humans swap in) ---- */
const START_MAP = process.env.START_MAP || 'office';
const ROTATE = process.env.ROTATE_MAPS !== '0';
Sim.setMap(START_MAP);
const game = new Sim.Game({ difficulty: process.env.BOT_DIFFICULTY || 'normal' });
game.fillWithBots();
game.startMatch();

/* map rotation: after each match, queue the next map */
let rotationQueued = false;
setInterval(() => {
  if (!ROTATE) return;
  if (game.matchOver && !rotationQueued) {
    const keys = Sim.MAP_LIST.map(m => m.key);
    const next = keys[(keys.indexOf(Sim.getMap().key) + 1) % keys.length];
    game.pendingMap = next;
    rotationQueued = true;
    console.log(`[map] next: ${next}`);
  }
  if (!game.matchOver) rotationQueued = false;
}, 500);

const wss = new WebSocketServer({ server });
const clients = new Map(); // ws -> { playerId, lastSeq }

function chooseTeamForHuman(pref) {
  const count = (team, botsOnly) => [...game.players.values()].filter(p => p.team === team && (!botsOnly || !p.isBot)).length;
  if (pref === 'CT' || pref === 'T') {
    if (count(pref, true) < 5) return pref;
  }
  return count('CT', true) <= count('T', true) ? 'CT' : 'T';
}

wss.on('connection', (ws) => {
  const state = { playerId: null, lastSeq: game.eventSeq };
  clients.set(ws, state);
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join') {
      if (state.playerId) return;
      const team = chooseTeamForHuman(msg.team);
      const p = game.addPlayer({ name: msg.name || 'Player', team, isBot: false });
      game.fillWithBots();
      state.playerId = p.id;
      state.lastSeq = game.eventSeq;
      ws.send(JSON.stringify({ t: 'welcome', id: p.id, team }));
      console.log(`[+] ${p.name} joined ${team} (${[...game.players.values()].filter(x => !x.isBot).length} humans)`);
    } else if (msg.t === 'input' && state.playerId) {
      game.setInput(state.playerId, msg.input);
    } else if (msg.t === 'buy' && state.playerId) {
      game.buy(state.playerId, msg.item);
    } else if (msg.t === 'spectate' && state.playerId) {
      game.cycleSpectate(state.playerId);
    }
  });
  ws.on('close', () => {
    if (state.playerId) {
      const p = game.players.get(state.playerId);
      console.log(`[-] ${p ? p.name : state.playerId} left`);
      game.removePlayer(state.playerId);
      game.fillWithBots();
    }
    clients.delete(ws);
  });
});

/* ---- loops: sim 30 Hz, snapshots 20 Hz ---- */
setInterval(() => game.tick(1 / 30), 1000 / 30);
setInterval(() => {
  for (const [ws, st] of clients) {
    if (ws.readyState !== 1 || !st.playerId) continue;
    if (!game.players.has(st.playerId)) continue;
    const snap = game.snapshotFor(st.playerId);
    snap.events = game.eventsSince(st.lastSeq);
    st.lastSeq = game.eventSeq;
    ws.send(JSON.stringify({ t: 'snap', snap }));
  }
}, 50);

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets).flat().find(n => n && n.family === 'IPv4' && !n.internal);
  console.log('==================================================');
  console.log('  SILENT ENTRY — top-down tactical shooter');
  console.log(`  Local:   http://localhost:${PORT}`);
  if (lan) console.log(`  LAN:     http://${lan.address}:${PORT}   <- share with friends on your Wi-Fi`);
  console.log(`  Map:     ${Sim.getMap().name}${ROTATE ? ' (rotation: ' + Sim.MAP_LIST.map(m => m.key).join(' -> ') + ')' : ''}`);
  console.log('==================================================');
});
