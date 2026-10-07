'use strict';
const assert = require('node:assert/strict');
const { Expedition, RELICS, validSave, normalizeSave, stageSpec, bankedBefore } = require('../clackworks/expedition.js');
const { Game } = require('../clackworks/core.js');
function fixture(relics = {}, stage = 1) {
  const game = new Expedition(() => .8), spec = stageSpec(stage);
  game.stage = stage; game.banked = bankedBefore(stage); game.relics = { ...relics };
  game.equipment = ['blackhole', 'radar'].find(id => relics[id]) || null;
  game.pendingReward = null; game.midRewardTaken = true;
  game.tiles = Array.from({ length: spec.count }, (_, id) => ({ id, type: Math.floor(id / 3) % 12, x: id % 6 * 80, y: Math.floor(id / 6) % 6 * 75, z: 0, pile: 'main', zone: 'board' }));
  game.rack = []; game.reserve = []; game.random = () => .99;
  return game;
}
function match(game, ids) { let result; for (const id of ids) { result = game.pick(id); assert.ok(result.ok, `cannot pick ${id}`); } return result; }
function integrity(game) {
  const data = game.toSave(); assert.ok(validSave(data), `invalid stage ${game.stage} save`);
  assert.deepEqual(Expedition.fromSave(data).toSave(), data);
  assert.equal(game.cleared, game.tiles.filter(t => t.zone === 'matched').length);
}
assert.equal(Object.keys(RELICS).length, 16);
// Lightning guarantee, level-two multi-target discharge, explicit held-target state, one firing per action.
{
  const g = fixture({ ukulele: 2 }, 3); g.spark = 3;
  const result = match(g, [0,1,2]);
  assert.equal(result.events.filter(e => e.kind === 'ukulele').length, 2); assert.equal(g.lightningReady, false); integrity(g);
  g.lightningReady = true; g.beginBurst();
  for (const tile of g.tiles.filter(t => t.zone === 'board')) { tile.x = 0; tile.y = 0; tile.z = tile.id % 50; }
  assert.equal(g.lightningTarget, null); g.resolveCombos([]); assert.equal(g.lightningReady, true);
}
// A critical pierces one covering tile; repeatability survives Undo and reload.
{
  const g = fixture({ prism: 1 }); g.rngState = 1;
  // Use the saved RNG, rather than replacing it, for this replay check.
  const restored = Expedition.fromSave(g.toSave());
  restored.tiles[3].x = restored.tiles[6].x; restored.tiles[3].y = restored.tiles[6].y; restored.tiles[6].z = 1;
  match(restored, [0,1]); const before = restored.toSave(), result = restored.pick(2);
  assert.ok(result.events.some(e => e.kind === 'prism')); integrity(restored);
  const copy = Expedition.fromSave(before); assert.deepEqual(copy.pick(2), result);
  assert.ok(restored.use('undo')); assert.deepEqual(restored.pick(2), result);
}
// Rocket holds a full charge until a tray pair exists, then reaches below many covers.
{
  const g = fixture({ seeker: 1 }); g.seekerCharge = 4;
  match(g, [0,1,2]); assert.equal(g.seekerCharge, 4);
  g.tiles[5].x = 400; g.tiles[5].y = 375;
  for (const id of [12,15,18,21]) { g.tiles[id].x = 400; g.tiles[id].y = 375; g.tiles[id].z = id; }
  match(g, [3,4]); const result = match(g, [6,7,8]);
  assert.deepEqual(result.events.find(e => e.kind === 'seeker').ids, [3,4,5]);
  assert.equal(g.rack.length, 0); assert.equal(g.seekerCharge, 0); integrity(g);
}
// Fuse really waits, survives save/load, retargets after Shuffle, and clears on replacement.
{
  const g = fixture({ resin: 1 }); match(g, [0,1,2]); assert.equal(g.fuse.ticks, 3);
  const bomb = [...g.fuse.ids]; match(g, [6,7,8]); assert.equal(g.fuse.ticks, 2); integrity(g);
  match(g, [9,10,11]); assert.equal(g.fuse.ticks, 1);
  const result = match(g, [12,13,14]); assert.deepEqual(result.events.find(e => e.kind === 'resin').ids, bomb); integrity(g);
  assert.ok(g.use('shuffle')); integrity(g); assert.equal(new Set(g.fuse.ids.map(id => g.tiles[id].type)).size, 1);
  g.relics = { resin: 1, ukulele: 1, feather: 1, shield: 1, clover: 1, prism: 1 }; g.pendingReward = ['seeker'];
  assert.ok(g.choose('seeker', 'resin')); assert.equal(g.fuse, null); integrity(g);
}
// One critical starts Echo; extra recoveries feed Capacitor and Turbine, which bank lightning/energy.
{
  const g = fixture({ prism: 3, echo: 3, capacitor: 3, turbine: 3, ukulele: 3, blackhole: 1 }, 11);
  g.random = () => 0; g.spark = 3;
  const result = match(g, [0,1,2]);
  for (const kind of ['prism', 'echo', 'capacitor', 'turbine', 'ukulele']) assert.ok(result.events.some(e => e.kind === kind), kind);
  assert.ok(result.events.filter(e => e.kind === 'echo').length <= 3);
  assert.ok(result.events.filter(e => e.kind === 'capacitor').length <= 1);
  assert.ok(result.events.filter(e => e.kind === 'ukulele').length <= 3);
  assert.ok(g.energy > 0 || g.charge > 0); assert.ok(result.recovered >= 24); integrity(g);
}
// Cleanup is a threshold effect, and cannot activate before its owner is restored by the Boss.
{
  const g = fixture({ recycler: 1 });
  for (const tile of g.tiles.slice(0,24)) tile.zone = 'matched'; g.cleared = 24; g.manualMatches = 8; g.stageMatches = 8;
  const result = match(g, [24,25,26]); assert.equal(g.status, 'won'); assert.equal(result.events.filter(e => e.kind === 'recycler').length, 3); integrity(g);
}
// A capped proc chain still leaves the finisher its promised (at most five) triples.
{
 const g=fixture({recycler:1});g.tiles.slice(0,27).forEach(tile=>tile.zone='matched');g.cleared=27;
 g.manualMatches=9;g.stageMatches=9;g.beginBurst();g.burstLeft=0;
 const events=[];g.resolveCombos(events);assert.equal(g.status,'won');assert.equal(events.length,3);integrity(g);
}
// All new gear is sealed/reset at stage 10 and restores one level at a time.
{
  const g = fixture({ resin: 3, seeker: 3, capacitor: 3, turbine: 3, prism: 2, echo: 2, blackhole: 2 }, 9);
  g.tiles.forEach(tile => tile.zone = 'matched'); g.cleared = g.tiles.length; g.status = 'won';
  g.manualMatches = g.cleared / 3; g.stageMatches = g.manualMatches;
  g.seekerCharge = 2; g.capacitorCharge = 2; g.turbineCharge = 2;
  const original = { ...g.relics }; assert.ok(g.nextStage());
  assert.deepEqual(g.relics, {}); assert.deepEqual(g.sealed, original);
  assert.equal(g.seekerCharge + g.capacitorCharge + g.turbineCharge, 0); assert.equal(g.fuse, null); integrity(g);
  const events = []; g.beginBurst(); g.chargeSeal(events, true);
  assert.equal(events[0].kind, 'reclaim');
  assert.equal(g.relics[events[0].relic], events[0].relic === 'blackhole' ? 2 : 1); integrity(g);
  g.tiles.forEach(tile => tile.zone = 'matched'); g.rack = []; g.cleared = g.tiles.length;
  g.drainBurst(events); g.check(); assert.deepEqual(g.relics, original); integrity(g);
  assert.ok(g.nextStage()); assert.equal(g.stage, 11); integrity(g);
}
// Old v3 checkpoints (including Undo) gain additive defaults; malformed new state is rejected.
{
  const g = fixture({ feather: 1 }); g.pick(0); const old = g.toSave();
  for (const state of [old, old.previous]) for (const key of ['fuse','seekerCharge','capacitorCharge','turbineCharge']) delete state[key];
  assert.ok(validSave(normalizeSave(old))); assert.ok(Expedition.fromSave(old).use('undo'));
  const bad = fixture({ resin: 1 }).toSave(); bad.fuse = { ids: [0,1,3], ticks: 1 }; assert.equal(validSave(bad), false);
  bad.fuse = { ids: [0,1,2], ticks: 0 }; assert.equal(validSave(bad), false);
}
// Actual random boards with diverse builds: pickup, chain, undo, shuffle and save remain consistent.
let actions = 0;
for (let seed = 1; seed <= 70; seed++) {
  const stage = 11, g = new Expedition(() => seed / 71), spec = stageSpec(stage);
  const board = new Game(spec.mode, g.random, spec);
  for (const key of ['tiles','rack','reserve','cleared','moves','status','previous','solution']) g[key] = board[key];
  g.stage = stage; g.banked = bankedBefore(stage); g.pendingReward = null; g.midRewardTaken = true;
  const builds = [
    { prism: 3, echo: 3, capacitor: 3, turbine: 3, ukulele: 3, cell: 3, blackhole: 2 },
    { resin: 3, seeker: 3, gasoline: 3, recycler: 3, shield: 3, feather: 3, radar: 2 },
    { prism: 1, resin: 1, ukulele: 1, seeker: 1, turbine: 1, capacitor: 1, blackhole: 1 }
  ];
  g.relics = { ...builds[seed % builds.length] }; g.equipment = g.relics.radar ? 'radar' : 'blackhole'; g.charge = 1;
  for (let step = 0; step < 130 && g.status === 'playing'; step++) {
    integrity(g);
    const options = g.available().sort((a,b) => g.rack.filter(id=>g.tiles[id].type===b.type).length - g.rack.filter(id=>g.tiles[id].type===a.type).length);
    const next = options[0]; if (!next) break;
    const before = g.toSave(), result = g.pick(next.id); assert.ok(result.ok); integrity(g); actions++;
    assert.deepEqual(Expedition.fromSave(before).pick(next.id), result);
    if (step === 5 && g.canUse('shuffle')) { g.use('shuffle'); integrity(g); }
    if (g.pendingReward) { g.pendingReward = ['recharge']; g.choose('recharge'); }
  }
}
console.log(`PASS: 16 gear, critical/rocket/fuse/relay/echo/recharge/sweep mechanics, bounded synergies, old saves, undo determinism, Shuffle retargeting and ${actions} random-board actions.`);
