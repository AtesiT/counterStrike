const S = require('../public/sim.js');
let failures = 0;
const assert = (c, m) => { if (!c) { failures++; console.error('FAIL:', m); } else console.log('ok -', m); };

function runBotMatch(g, wantRounds, maxMinutes) {
  let rounds = 0, kills = 0, plants = 0, untied = 0, rescued = 0, lastSeq = 0;
  const dt = 1 / 30;
  for (let i = 0; i < maxMinutes * 60 * 30 && rounds < wantRounds; i++) {
    g.tick(dt);
    for (const e of g.eventsSince(lastSeq)) {
      if (e.type === 'kill') kills++;
      if (e.type === 'planted') plants++;
      if (e.type === 'untied') untied++;
      if (e.type === 'rescued') rescued++;
      if (e.type === 'roundEnd') rounds++;
    }
    lastSeq = g.eventSeq;
  }
  return { rounds, kills, plants, untied, rescued };
}

for (const meta of S.MAP_LIST) {
  console.log(`\n=== MAP ${meta.key} (${meta.mode}) ===`);
  S.setMap(meta.key);
  const M = S.getMap();
  const tS = M.spawns.T[0], ctS = M.spawns.CT[0];
  assert(S.findPath(tS.x, tS.y, ctS.x, ctS.y).length > 3, 'T spawn <-> CT spawn connected');
  if (M.mode === 'bomb') {
    for (const k of ['A', 'B']) {
      assert(S.findPath(tS.x, tS.y, M.sites[k].plant.x, M.sites[k].plant.y).length > 3, `T -> plant ${k}`);
      assert(S.findPath(ctS.x, ctS.y, M.sites[k].plant.x, M.sites[k].plant.y).length > 3, `CT -> plant ${k}`);
    }
  } else {
    for (const h of M.hostages) {
      assert(S.findPath(ctS.x, ctS.y, h.x, h.y).length > 3, 'CT -> hostage');
      assert(S.findPath(h.x, h.y, M.rescue.x, M.rescue.y).length > 3, 'hostage -> rescue zone');
    }
  }
  const g = new S.Game({ difficulty: 'normal' });
  assert(g.mode === M.mode, `game mode ${g.mode}`);
  g.fillWithBots(); g.startMatch();
  const r = runBotMatch(g, 6, 25);
  console.log(`  score CT ${g.score.CT} - ${g.score.T} T | kills=${r.kills} plants=${r.plants} untied=${r.untied} rescued=${r.rescued} rounds=${r.rounds}`);
  assert(r.rounds >= 6, '6 rounds completed');
  assert(r.kills > 10, 'bots are fighting');
  if (M.mode === 'bomb') assert(r.plants >= 1, 'bomb planted at least once');
  if (M.mode === 'hostage') console.log(`  (hostage activity: untied=${r.untied}, rescued=${r.rescued} — mechanic asserted deterministically below)`);
}

/* ---- hostage rescue mechanic, deterministic (winter, 1v1, T pinned away) ---- */
console.log('\n=== HOSTAGE MECHANIC: untie -> follow -> rescue ===');
S.setMap('winter');
{
  const g2 = new S.Game({ teamSize: 1, difficulty: 'normal' });
  g2.fillWithBots(); g2.startMatch();
  const ct = [...g2.players.values()].find(p => p.team === 'CT');
  const tt = [...g2.players.values()].find(p => p.team === 'T');
  let untied = 0, rescued = 0, lastSeq = 0, teleported = false;
  for (let i = 0; i < 90 * 30 && !rescued; i++) {
    if (g2.phase === 'live' && !teleported) {
      const h = g2.hostages[0];
      ct.x = h.x + 10; ct.y = h.y; teleported = true;
    }
    if (tt.alive) { tt.x = 4.5 * 32; tt.y = 3.5 * 32; } // pin T in its cabin
    g2.tick(1 / 30);
    for (const e of g2.eventsSince(lastSeq)) {
      if (e.type === 'untied') untied++;
      if (e.type === 'rescued') rescued++;
    }
    lastSeq = g2.eventSeq;
  }
  assert(teleported, 'CT bot placed at hostage');
  assert(untied >= 1, 'CT bot untied the hostage');
  assert(rescued >= 1, 'hostage escorted to rescue zone (round won by rescue)');
  assert(g2.score.CT >= 1, 'CT scored the rescue round');
}

/* ---- weapon drop / pickup / knife unit test (office) ---- */
console.log('\n=== WEAPONS: drop / pickup / knife ===');
S.setMap('office');
const g = new S.Game({});
const human = g.addPlayer({ name: 'Tester', team: 'CT', isBot: false });
const enemy = g.addPlayer({ name: 'Target', team: 'T', isBot: true });
g.startMatch(); // freeze phase
human.money = 9000;
assert(g.buy(human.id, 'rifle') && human.current === 'rifle', 'buy rifle');
assert(g.buy(human.id, 'deagle') && human.weapons.deagle && !human.weapons.pistol, 'buy deagle replaces pistol (dropped)');
assert(g.ground.some(w => w.key === 'pistol'), 'old pistol dropped on ground');
// to live phase
for (let i = 0; i < 60 * 5 && g.phase !== 'live'; i++) g.tick(1 / 30);
assert(g.phase === 'live', 'live phase reached');
human.current = 'rifle';
g.setInput(human.id, { mx: 0, my: 0, angle: 0, drop: true });
g.tick(1 / 30);
assert(!human.weapons.rifle && human.current === 'deagle', 'G drops rifle, switches to deagle');
const rw = g.ground.find(w => w.key === 'rifle');
assert(!!rw, 'rifle is on the ground');
human.x = rw.x; human.y = rw.y;
g.setInput(human.id, { mx: 0, my: 0, angle: 0 });
g.tick(1 / 30);
assert(human.weapons.rifle && human.current === 'rifle', 'walk-over picks rifle back up');
// knife
g.setInput(human.id, { mx: 0, my: 0, angle: 0, slot: 3 });
g.tick(1 / 30);
assert(human.current === 'knife', 'slot 3 = knife');
enemy.x = human.x + 26; enemy.y = human.y; enemy.alive = true; enemy.hp = 100;
const hpBefore = enemy.hp;
g.setInput(human.id, { mx: 0, my: 0, angle: 0, fire: true });
g.tick(1 / 30);
assert(enemy.hp < hpBefore, `knife hits (hp ${hpBefore} -> ${enemy.hp})`);
// snapshot sanity
const snap = g.snapshotFor(human.id);
assert(snap.map.key === 'office' && Array.isArray(snap.ground) && Array.isArray(snap.hostages), 'snapshot has map/ground/hostages');

if (failures) { console.error(`\n${failures} FAILURE(S)`); process.exit(1); }
console.log('\nALL SIM TESTS PASSED');
