'use strict';
const assert = require('node:assert/strict');
const { Expedition, stageSpec } = require('../rain_match/expedition.js');
const { Game, exposed } = require('../rain_match/core.js');
const seed = n => () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; };
const fresh = () => { const game = new Expedition(seed(13)); game.choose('feather'); return game; };
function counts(game) {
  const result = {};
  for (const tile of game.tiles.filter(t => t.zone !== 'matched')) result[tile.type] = (result[tile.type] || 0) + 1;
  for (const n of Object.values(result)) assert.equal(n % 3, 0);
  assert.equal(game.rack.length, game.tiles.filter(t => t.zone === 'rack').length);
  assert.equal(game.reserve.length, game.tiles.filter(t => t.zone === 'reserve').length);
  assert.equal(game.cleared, game.tiles.filter(t => t.zone === 'matched').length);
}
// Every stage template has a legal full-clear witness, including capped and fog boards.
for (let stage = 1; stage <= 32; stage++) for (let n = 1; n <= 20; n++) {
  const spec = stageSpec(stage), game = new Game(spec.mode, seed(stage * 1000 + n), spec);
  assert.equal(game.tiles.length, spec.count);
  for (const id of game.solution) { assert.equal(game.pick(id).ok, true); assert.notEqual(game.status, 'lost'); }
  assert.equal(game.status, 'won'); counts(game);
}
// Multiple stages retain loadout, charges and spent powers, while banking actual clears.
{
  const game = fresh(); game.used.shuffle = true;
  let expected = 0;
  for (let stage = 1; stage <= 12; stage++) {
    const solution = [...game.solution];
    for (const id of solution) {
      if (game.pendingReward) {
        // Controlled non-proc supplies keep the original deal witness applicable.
        game.pendingReward = ['recharge']; const choice = 'recharge';
        assert.ok(choice); assert.ok(game.choose(choice));
      }
      if (game.tiles[id].zone === 'matched') continue;
      assert.ok(game.pick(id).ok, `stage ${stage} id ${id} status ${game.status} pending ${game.pendingReward}`); counts(game);
    }
    assert.equal(game.status, 'won'); expected += game.tiles.length; assert.equal(game.recovered, expected);
    game.offerReward(); assert.equal(game.nextStage(), false);
    game.pendingReward = ['recharge']; assert.ok(game.choose('recharge'));
    const relics = JSON.stringify(game.ownedRelics()), charge = game.charge;
    assert.ok(game.nextStage()); assert.equal(game.cleared, 0); assert.equal(game.recovered, expected);
    assert.equal(JSON.stringify(game.ownedRelics()), relics); assert.equal(game.charge, game.stage === 10 ? 0 : charge); assert.ok(game.used.shuffle);
  }
}
function fixture(game, types, rack = []) {
  game.tiles = types.map((type, id) => ({ id, type, x: id * 90, y: 0, z: 0, pile: 'main', zone: rack.includes(id) ? 'rack' : 'board' }));
  game.rack = rack; game.reserve = []; game.status = 'playing'; game.cleared = 0; game.previous = null; game.pendingReward = null;
}
// Shield returns the offending tile without deleting it or erasing the previous six.
{
  const game = fresh(); game.relics = { shield: 1 }; fixture(game, [0,1,2,3,4,5,6,...Array.from({length:14},(_,i)=>Math.floor(i/2))], [0,1,2,3,4,5]);
  const before = game.snapshot(); const result = game.pick(6);
  assert.equal(result.events[0].kind, 'shield'); assert.equal(game.status, 'playing');
  assert.deepEqual(game.rack, before.rack); assert.equal(game.tiles[6].zone, 'board'); assert.equal(game.moves, before.moves);
  assert.equal(game.shieldSpent, true); assert.equal(game.previous, null); counts(game);
  game.pick(6); assert.equal(game.status, 'lost');
}
// Feather permits exactly one blocker, consumes a charge and Undo restores the pickup state.
{
  const game = fresh(); fixture(game, [0,0,0,1,1,1]);
  game.tiles[0].x = game.tiles[1].x = 0; game.tiles[1].z = 1;
  assert.equal(exposed(game.tiles[0], game.tiles), false);
  assert.equal(game.pick(0).ok, false); assert.ok(game.pick(0, true).ok);
  assert.equal(game.featherCharge, 0); assert.equal(game.tiles[0].zone, 'rack');
  assert.ok(game.use('undo')); assert.equal(game.tiles[0].zone, 'board'); assert.equal(game.featherCharge, 1);
  assert.equal(exposed(game.tiles[0], game.tiles), false); counts(game);
}
// Cube consumes exactly a triple (two tray + one covered); no reward/charge feedback loop.
{
  const game = fresh(); game.equipment = 'blackhole'; game.relics.blackhole = 1; game.charge = 1;
  fixture(game, [0,0,0,1,1,1], [0,1]); game.tiles[2].x = game.tiles[3].x; game.tiles[3].z = 1;
  assert.ok(game.canActivate()); assert.equal(game.activate(4).ok, false); assert.equal(game.charge, 1);
  assert.ok(game.activate(2).ok); assert.equal(game.cleared, 3); assert.equal(game.charge, 0);
  assert.equal(game.manualMatches, 0); assert.equal(game.previous, null); counts(game);
}
// A proc may clear one exposed triple only; Undo restores score, charge and random cursor.
{
  const game = fresh(); fixture(game, [0,0,0,1,1,1,2,2,2], [0,1]); game.relics.ukulele = 1; game.rngState = 1;
  const before = game.snapshot(), result = game.pick(2);
  assert.equal(result.events.filter(e => e.kind === 'ukulele').length, 1);
  assert.equal(game.cleared, 6); assert.equal(game.manualMatches, 1); counts(game);
  assert.ok(game.use('undo')); assert.equal(game.cleared, 0); assert.equal(game.manualMatches, 0); assert.equal(game.rngState, before.rngState);
  assert.equal(game.pick(2).events[0].kind, 'ukulele'); counts(game);
}
// Radar exposes information for pickups, not wall-clock time, and cannot bypass blockers.
{
  const game = fresh(); game.relics.radar = 1; game.equipment = 'radar'; game.charge = 1;
  assert.ok(game.activate().ok); assert.equal(game.radarUntil, 4); assert.equal(game.previewIds().length, 4);
  const hidden = game.previewIds()[0]; assert.equal(game.pick(hidden).ok, false);
  for (const id of game.solution.slice(0,4)) assert.ok(game.pick(id).ok);
  assert.equal(game.radarActive, false);
}
// Pending rewards stop play and are stable across reads; upgrades and replacements respect caps.
{
  const game = fresh(); game.stage = 6; game.relics = { feather: 3, shield: 2, ukulele: 2, gasoline: 2, behemoth: 2, clover: 1, blackhole: 2 }; game.equipment = 'blackhole';
  game.pendingReward = ['cell']; assert.equal(game.pick(game.available()[0].id).ok, false); assert.equal(game.choose('cell'), false);
  assert.ok(game.choose('cell', 'ukulele')); assert.equal(game.relics.ukulele, undefined); assert.equal(game.relics.cell, 1);
  game.pendingReward = ['radar']; assert.ok(game.choose('radar')); assert.equal(game.relics.blackhole, undefined);
  game.used.remove = true; game.pendingReward = ['restore_remove']; assert.ok(game.choose('restore_remove')); assert.equal(game.used.remove, false);
  game.offerReward(); const choices = [...game.pendingReward]; assert.deepEqual(game.pendingReward, choices); assert.equal(game.use('shuffle'), false);
  game.choose(choices[0], 'feather');
  assert.ok(game.end()); assert.equal(game.canUse('remove'), false); assert.equal(game.pick(0).ok, false); assert.equal(game.nextStage(), false);
}
console.log('PASS: 640 stage witnesses; stage carryover; triple conservation; Shield, Feather, Cube, Radar, Lightning; Undo replay; reward gating, replacement, refills and extraction.');
// Growth gates, a single evolution, once-per-stage protection and limited refills.
{
  const game = fresh();
  game.pendingReward = ['feather']; assert.equal(game.choose('feather'), false);
  game.stage = 3; assert.ok(game.choose('feather')); assert.equal(game.relics.feather, 2);
  game.pendingReward = ['feather']; assert.equal(game.choose('feather'), false);
  game.stage = 6; assert.ok(game.choose('feather')); assert.equal(game.evolved, 'feather');
  game.relics.ukulele = 2; game.pendingReward = ['ukulele']; assert.ok(game.choose('ukulele'));
  assert.equal(game.relics.feather, 3); assert.equal(game.relics.ukulele, 3);
  game.relics.shield = 2; game.pendingReward = ['shield']; assert.ok(game.choose('shield')); assert.equal(game.relics.feather, 2);
  delete game.relics.shield; game.shieldSpent = true; game.pendingReward = ['shield']; assert.ok(game.choose('shield')); assert.equal(game.shieldSpent, true);
  game.pendingReward = ['shield']; assert.ok(game.choose('shield')); assert.equal(game.shieldSpent, true);
  for (let n = 0; n < 3; n++) {
    game.used.undo = true; game.pendingReward = ['restore_undo']; assert.equal(game.choose('restore_undo'), n < 2);
  }
  game.pendingReward = ['blackhole']; assert.ok(game.choose('blackhole')); assert.equal(game.charge, 1);
  game.charge = 0; game.pendingReward = ['blackhole']; assert.ok(game.choose('blackhole')); assert.equal(game.charge, 0);
  game.pendingReward = ['radar']; assert.ok(game.choose('radar')); assert.equal(game.charge, 0);
  game.pendingReward = ['recharge']; assert.ok(game.choose('recharge')); assert.equal(game.charge, 1); assert.equal(game.shieldSpent, true);
  assert.equal(game.recharge, 10); game.stage = 7; assert.equal(game.recharge, 8);
}
// A stage cannot issue repeated mid-stage rewards, even after Undo.
{
  const game = fresh(); let rewards = 0;
  for (const id of game.solution) {
    game.pick(id);
    if (game.pendingReward) { rewards++; assert.equal(game.previous, null); game.choose('blackhole'); }
  }
  assert.equal(rewards, 1); assert.ok(game.midRewardTaken);
}
// Banked lightning waits for a complete triple; it can clear rack/reserve cards too.
{
  const game = fresh(); game.relics.ukulele = 1; game.lightningReady = true;
  fixture(game, [0,0,0,1,1,1]);
  game.tiles.forEach((t, i) => { t.x = 0; t.z = i; });
  const events = []; game.resolveCombos(events); assert.equal(events.length, 0); assert.ok(game.lightningReady);
  game.tiles.forEach((t, i) => { t.x = i * 90; t.z = 0; });
  game.resolveCombos(events); assert.equal(game.cleared, 3); assert.equal(game.lightningReady, false); counts(game);
}
// A marked leap triggers radar follow-ups and lightning; one manual match, finite chain.
{
  const game = fresh(); game.relics = { feather: 1, ukulele: 3, radar: 2, cell: 2 }; game.equipment = 'radar';
  fixture(game, [0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6], [0,1]);
  game.tiles[2].x = game.tiles[3].x; game.tiles[3].z = 1;
  game.radarUntil = 10; game.radarMark = 0; game.charge = 0;
  const before = game.snapshot(), result = game.pick(2, true);
  assert.equal(result.recovered, 18); assert.equal(game.bestChain, 18); assert.equal(game.manualMatches, 1);
  assert.equal(result.events.filter(e => e.kind === 'radar').length, 2);
  assert.equal(result.events.filter(e => e.kind === 'ukulele').length, 3); assert.equal(game.charge, 0); counts(game);
  // Undo must restore the entire chain, including scan and leap state.
  assert.ok(game.use('undo')); assert.equal(game.cleared, before.cleared);
  assert.equal(game.radarMark, before.radarMark); assert.equal(game.featherCharge, before.featherCharge);
}
// Evolved cube consumes three tray pairs but cannot pay for another activation.
{
  const game = fresh(); game.relics = { blackhole: 3, cell: 2 }; game.equipment = 'blackhole'; game.charge = 1;
  fixture(game, [0,0,0,1,1,1,2,2,2], [0,1,3,4,6,7]);
  const result = game.activate(2); assert.equal(result.recovered, 9); assert.equal(game.charge, 0);
  assert.equal(game.energy, .75); assert.equal(game.manualMatches, 0); assert.equal(game.canActivate(), false); counts(game);
}
// Evolved radar marks after the entire chain, never a type lightning just removed.
{
  const game = fresh(); game.relics = { radar: 3, ukulele: 2 }; game.equipment = 'radar';
  fixture(game, [0,0,0,1,1,1,2,2,2,3,3,3,4,4,4], [0,1]);
  game.radarUntil = 6; game.radarMark = 0;
  assert.equal(game.pick(2).recovered, 12); assert.equal(game.radarMark, 4); counts(game);
}
console.log('PASS: growth gates, stage-based evolution slots, limited protection/refills, one mid-stage supply, banked lightning, marked leap chain, evolved cube and bounded energy feedback.');
