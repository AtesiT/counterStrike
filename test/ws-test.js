/* Connects to a running server (PORT env or 3000), joins, moves, fires, buys. */
const WebSocket = require('ws');
const port = process.env.PORT || 3000;
const ws = new WebSocket(`ws://127.0.0.1:${port}`);
let snaps = 0, gotWelcome = false, sawSelf = false, sawEvents = false;
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const timer = setTimeout(() => fail(`timeout (welcome=${gotWelcome} snaps=${snaps} self=${sawSelf})`), 15000);

ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: 'TestHuman', team: 'CT' })));
ws.on('error', (e) => fail(e.message));
ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.t === 'welcome') {
    gotWelcome = true;
    console.log('ok - welcome, id =', msg.id, 'team =', msg.team);
    // move + fire loop
    const iv = setInterval(() => ws.send(JSON.stringify({
      t: 'input',
      input: { mx: 1, my: 0.3, angle: 0.5, fire: true, walk: false, use: false, reload: false, slot: 0 }
    })), 50);
    setTimeout(() => { clearInterval(iv); ws.send(JSON.stringify({ t: 'buy', item: 'armor' })); }, 2500);
  }
  if (msg.t === 'snap') {
    snaps++;
    if (msg.snap.self) sawSelf = true;
    if (msg.snap.events && msg.snap.events.length) sawEvents = true;
    if (snaps === 5) console.log(`ok - snapshots flowing (phase=${msg.snap.phase}, round=${msg.snap.round}, players visible=${msg.snap.players.length})`);
    if (snaps >= 90) {
      clearTimeout(timer);
      console.log(`ok - ${snaps} snapshots, events seen: ${sawEvents}, self: ${JSON.stringify(msg.snap.self && { team: msg.snap.self.team, money: msg.snap.self.money, alive: msg.snap.self.alive })}`);
      console.log('WS TEST PASSED');
      ws.close(); process.exit(0);
    }
  }
});
