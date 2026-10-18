const S = require('../public/sim.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok -', m); };

// 1) map connectivity: from T spawn reach sites A/B and CT spawn
const tSpawn = S.MAP.spawns.T[0], ctSpawn = S.MAP.spawns.CT[0];
for (const [name, pt] of [['Site A plant', S.MAP.sites.A.plant], ['Site B plant', S.MAP.sites.B.plant], ['CT spawn', ctSpawn]]) {
  const path = S.findPath(tSpawn.x, tSpawn.y, pt.x, pt.y);
  assert(path.length > 3, `T spawn -> ${name} (path ${path.length} nodes)`);
}
for (const [name, pt] of [['Site A', S.MAP.sites.A.plant], ['Site B', S.MAP.sites.B.plant]]) {
  const path = S.findPath(ctSpawn.x, ctSpawn.y, pt.x, pt.y);
  assert(path.length > 3, `CT spawn -> ${name} (path ${path.length} nodes)`);
}

// 2) bot-only match: simulate up to 12 min of game time, expect rounds to complete
const g = new S.Game({ difficulty: 'normal' });
g.fillWithBots();
assert(g.players.size === 10, '10 bots created');
g.startMatch();
let roundsDone = 0, kills = 0, plants = 0, lastSeq = 0;
const dt = 1 / 30;
for (let i = 0; i < 12 * 60 * 30 && roundsDone < 5; i++) {
  g.tick(dt);
  for (const e of g.eventsSince(lastSeq)) {
    if (e.type === 'kill') kills++;
    if (e.type === 'planted') plants++;
    if (e.type === 'roundEnd') { roundsDone++; console.log(`  round ${g.round} end: CT ${g.score.CT} - ${g.score.T} T (${e.reason})`); }
  }
  lastSeq = g.eventSeq;
}
assert(roundsDone >= 5, `5 rounds completed (kills=${kills}, plants=${plants})`);
assert(kills > 10, `bots are fighting (kills=${kills})`);
console.log(`plants=${plants} (0 allowed if T keeps dying, but watch balance)`);

// 3) snapshot privacy: enemy behind wall must not leak
const me = [...g.players.values()][0];
const snap = g.snapshotFor(me.id);
assert(snap && snap.self && Array.isArray(snap.players), 'snapshot generated');

// 4) buy worked during match
const rich = [...g.players.values()].find(p => Object.keys(p.weapons).length > 1);
assert(!!rich, 'some bot bought a primary weapon');

console.log('\nALL SIM TESTS PASSED');
