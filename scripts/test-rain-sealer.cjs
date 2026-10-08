'use strict';
const assert = require('node:assert/strict');
const { Expedition, stageSpec, bankedBefore, validSave } = require('../critter-cascade/expedition.js');
const { Game } = require('../critter-cascade/core.js');
const Save = require('../critter-cascade/expedition-save.js');
const seed = n => () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; };
function boss(gear, n = 7) {
  const g = new Expedition(seed(n)); g.choose('feather');
  const board = new Game('rain', seed(n), stageSpec(9));
  for (const k of ['tiles', 'rack', 'reserve', 'cleared', 'moves', 'status', 'previous', 'solution']) g[k] = board[k];
  g.stage = 9; g.banked = bankedBefore(9); g.relics = { ...gear };
  g.tiles.forEach(t => t.zone = 'matched'); g.cleared = g.tiles.length; g.status = 'won'; g.nextStage();
  // A legal flat board isolates recovery pacing from match-finding and proc luck.
  g.tiles.forEach(t => { t.z = 0; t.type = 0; });
  return g;
}
function triple(g) {
  let result;
  for (let i = 0; i < 3; i++) result = g.pick(g.available()[0].id);
  assert.ok(result.ok && result.matched); assert.ok(validSave(g.toSave())); return result;
}
const quietGear = { feather: 3, shield: 3, cell: 2, radar: 2 };
for (let n = 1; n <= 60; n++) {
  const g = boss(quietGear, n);
  const first = triple(g); const item = first.events.find(e => e.kind === 'reclaim').relic;
  assert.equal(first.events.filter(e => e.kind === 'reclaim').length, 1);
  assert.equal(g.relics[item], item === 'radar' ? 2 : 1);
  assert.equal(g.bossEnergy, 0); assert.equal(g.bossStarted, true);
  if (item === 'radar') { assert.equal(g.charge, 1); assert.equal(g.equipment, 'radar'); }
  const second = triple(g); assert.equal(second.events.filter(e => e.kind === 'reclaim').length, 0); assert.equal(g.bossEnergy, 2);
  const checkpoint = g.toSave(); const restored = Expedition.fromSave(checkpoint); assert.deepEqual(restored.toSave(), checkpoint);
  const third = triple(g); assert.equal(third.events.filter(e => e.kind === 'reclaim').length, 1); assert.equal(g.bossEnergy, 1);
  // Saving and replaying the same move or Undo preserves which level is returned.
  const replay = triple(restored); assert.deepEqual(replay.events, third.events);
  const before = g.previous; const lastId = g.moves - 1;
  assert.ok(g.use('undo')); assert.equal(g.bossEnergy, before.bossEnergy);
  assert.deepEqual(g.sealed, before.sealed); assert.deepEqual(g.pick(lastId).events, third.events);
  // All distinct items must be activated before any passive receives its second level.
  while (Object.keys(g.relics).length < 4) triple(g);
  for (const id of ['feather', 'shield', 'cell']) assert.equal(g.relics[id], 1);
  while (g.sealedLevels) triple(g);
  assert.deepEqual(g.relics, quietGear); assert.equal(g.bossEnergy, 0);
  assert.equal(g.pendingReward, null); assert.equal(g.status, 'playing');
  while (g.status === 'playing') triple(g);
  assert.ok(g.nextStage()); assert.equal(g.stage, 11); assert.deepEqual(g.relics, quietGear);
  assert.equal(g.bossStarted, false); assert.ok(validSave(g.toSave()));
}
// A real 144-tile proc burst can earn only one point and still restores everything on victory.
{
  const gear = { feather: 3, cell: 2, ukulele: 3, gasoline: 2, behemoth: 2, clover: 2, blackhole: 2 };
  const g = boss(gear); g.relics = { ...gear }; g.relics.feather = 1; g.relics.cell = 1;
  g.sealed = { feather: 3, cell: 2 }; g.equipment = 'blackhole'; g.charge = 1; g.featherCharge = 1;
  g.bossStarted = true; g.spark = 3; g.rngState = new Expedition(seed(1)).rngState;
  g.pick(0); g.pick(1); const result = g.pick(2);
  assert.ok(result.recovered >= 30, `burst ${result.recovered}`);
  assert.equal(result.events.filter(e => e.kind === 'sealEnergy').reduce((n,e) => n + e.amount,0), 3);
  assert.ok(result.events.filter(e => e.kind === 'reclaim').length <= (g.status === 'won' ? 3 : 1));
  assert.ok(validSave(g.toSave()));
}
// Active casts also share the same one-point chain allowance; a large cast is not a manual triple.
{
  const g = boss({ feather: 3, radar: 2 });
  g.relics = { blackhole: 3 }; g.sealed = { feather: 3 }; g.equipment = 'blackhole'; g.charge = 1;
  g.pick(0); g.pick(1); const result = g.activate(2);
  assert.ok(result.ok); assert.equal(g.bossEnergy, 1); assert.equal(g.bossStarted, false);
  assert.equal(result.events.filter(e => e.kind === 'reclaim').length, 0);
}
// Final clear restores levels even when not enough energy was earned.
{
  const gear = { feather: 3, shield: 2, cell: 2, radar: 3 }, g = boss(gear);
  g.tiles.forEach((t,i) => t.zone = i < 3 ? 'board' : 'matched'); g.cleared = g.tiles.length - 3;
  const result = triple(g);
  assert.deepEqual(g.relics, gear); assert.deepEqual(g.sealed, {});
  assert.equal(result.events.filter(e => e.kind === 'bossBreak').length, 1);
}
// Existing v3 Boss saves migrate without resealing recovered gear or changing their RNG/Undo.
{
  const g = boss(quietGear); triple(g); triple(g); const original = g.toSave();
  // Original v3 had only wholly sealed or wholly returned items.
  const old = structuredClone(original);
  for (const state of [old, old.previous]) {
    for (const id of Object.keys(state.relics)) { state.relics[id] = quietGear[id]; delete state.sealed[id]; }
    delete state.bossEnergy; delete state.bossStarted;
  }
  const record = { schema: 3, savedAt: 100, runId: '12345678-1234-4123-8123-123456789abc', elapsedMs: 200,
    finalized: false, receipt: null, submissionPayload: null, stageRewardClaimed: false, playerDraft: '', tenTime: null, tenRecord: null, game: old };
  const parsed = Save.parse(JSON.stringify(record)); assert.ok(parsed);
  const migrated = Expedition.fromSave(parsed.game);
  assert.deepEqual(migrated.relics, old.relics); assert.equal(migrated.rngState, old.rngState);
  assert.equal(migrated.bossEnergy, 0); assert.equal(migrated.bossStarted, true); assert.ok(migrated.use('undo'));
  const valid = original;
  for (const mutate of [s=>s.bossEnergy=3, s=>s.bossStarted='yes', s=>{s.relics.cell=3;s.sealed.cell=2;}, s=>{s.relics.radar=1;s.sealed.radar=2;}, s=>s.previous.bossEnergy=-1]) {
    const bad=structuredClone(valid); mutate(bad); assert.equal(validSave(bad),false);
  }
}
console.log('PASS: 60 Boss runs: first unlock, 2/3 pacing, level-one priority, active return, deterministic Undo/reload, one chain point per action, final restoration, stage 11, old checkpoints, malformed states.');
