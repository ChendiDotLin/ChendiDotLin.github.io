'use strict';
const assert = require('node:assert/strict');
const { Expedition, validSave, bankedBefore, stageSpec } = require('../clackworks/expedition.js');
const { Store, KEY, BACKUP, valid, parse } = require('../clackworks/expedition-save.js');
const seed = n => () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; };
let checkpoints = 0;
function roundtrip(game) {
  const data = game.toSave();
  assert.ok(validSave(data), `invalid checkpoint at stage ${game.stage}, ${game.status}, ${game.cleared} recovered`);
  const restored = Expedition.fromSave(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.toSave(), data); checkpoints++;
  return restored;
}
function choose(game) {
  // Keep the witness intact: these passives/actives do not automatically clear cards.
  let id = game.pendingReward.find(id => !['ukulele','gasoline','behemoth'].includes(id) && !id.startsWith('restore_'));
  // A controlled recharge supply avoids changing the deal witness in this serialization test.
  if (!id) { game.pendingReward = ['recharge']; id = 'recharge'; }
  const replacement = Object.keys(game.relics).find(id => ['shield', 'cell', 'feather'].includes(id));
  assert.ok(game.choose(id, replacement));
}
// Checkpoint every pickup and both reward boundaries across board-size cycles.
for (let n = 1; n <= 12; n++) {
  let game = new Expedition(seed(n));
  for (let stage = 1; stage <= 15; stage++) {
    const solution = [...game.solution];
    roundtrip(game); if (game.pendingReward) { choose(game); roundtrip(game); }
    for (const id of solution) {
      if (game.tiles[id].zone === 'matched') continue;
      const restored = roundtrip(game);
      assert.deepEqual(restored.pick(id), game.pick(id));
      assert.deepEqual(restored.toSave(), game.toSave());
      if (game.pendingReward) { roundtrip(game); choose(game); roundtrip(game); }
    }
    assert.equal(game.status, 'won'); roundtrip(game);
    assert.equal(game.banked, bankedBefore(stage));
    game.offerReward(); game = roundtrip(game); choose(game); roundtrip(game);
    assert.ok(game.nextStage()); roundtrip(game);
  }
}
// RNG, stash, shuffle, undo and extraction survive serialization.
for (let n = 1; n <= 80; n++) {
  let game = new Expedition(seed(n)); game.choose(n % 2 ? 'ukulele' : 'feather');
  for (let i = 0; i < 90 && game.status === 'playing'; i++) {
    if (game.pendingReward) { choose(game); }
    else {
      const available = game.available();
      if (!available.length) break;
      game.pick(available[(n + i) % available.length].id);
      game = roundtrip(game);
      if (i === 2 && game.canUse('remove')) game.use('remove');
      if (i === 4 && game.canUse('shuffle')) game.use('shuffle');
      if (i === 7 && game.canUse('undo')) game.use('undo');
    }
    roundtrip(game);
  }
  if (game.pendingReward) choose(game);
  if (n % 2) game.end(); roundtrip(game);
}
// Late-game equipment states: real layered boards, scan expiry, leap charges,
// automatic chains, shield rollback, rescue and equipment activation checkpoints.
for (let n = 1; n <= 100; n++) {
  const { Game } = require('../clackworks/core.js');
  const game = new Expedition(seed(n)); game.choose('feather'); game.stage = 6 + n % 4;
  const spec = stageSpec(game.stage), board = new Game(spec.mode, seed(n * 19), spec);
  for (const key of ['tiles', 'rack', 'reserve', 'cleared', 'moves', 'status', 'previous']) game[key] = board[key];
  game.banked = bankedBefore(game.stage);
  game.relics = n % 2 ? { feather: 2, shield: 2, ukulele: 3, radar: 2 } : { feather: 2, cell: 2, shield: 1, blackhole: 3 };
  game.equipment = n % 2 ? 'radar' : 'blackhole'; game.charge = game.capacity;
  for (let i = 0; i < 150 && game.status !== 'won'; i++) {
    roundtrip(game);
    if (game.pendingReward) choose(game);
    else if (game.status === 'lost') {
      if (game.canUse('remove')) game.use('remove');
      else if (game.canUse('undo')) game.use('undo');
      else break;
    } else if (game.canActivate()) game.activate(game.cubeTargets()[0]?.id);
    else if (i % 5 === 0 && game.featherTargets().length) game.pick(game.featherTargets()[0].id, true);
    else {
      const available = game.available();
      available.sort((a,b) => game.rack.filter(id => game.tiles[id].type === b.type).length - game.rack.filter(id => game.tiles[id].type === a.type).length);
      if (!available.length) break;
      game.pick(available[0].id);
    }
    roundtrip(game);
  }
}
let banked = 0;
for (let stage = 1; stage <= 1000; stage++) { assert.equal(bankedBefore(stage), banked); banked += stageSpec(stage).count; }
const game = new Expedition(seed(5)); game.choose('blackhole');
const record = () => ({ schema: 3, tenTime: null, tenRecord: null, savedAt: Date.now(), runId: '12345678-1234-4123-8123-123456789abc', elapsedMs: 1256.4,
  finalized: false, receipt: null, submissionPayload: null, stageRewardClaimed: false, playerDraft: '玩家', game: game.toSave() });
assert.ok(valid(record()));
for (const mutate of [r => r.game.tiles[0].type = 99, r => r.game.rack.push(999), r => r.game.relics.bad = 1,
  r => r.game.tiles[0].x = Infinity, r => r.game.banked++, r => r.game.previous = {}, r => r.game.version = 1,
  r => r.runId = 'bad', r => r.elapsedMs = -1, r => r.submissionPayload = undefined, r => r.receipt = {}]) {
  const r = record(); mutate(r); assert.equal(valid(r), false);
}
assert.equal(parse('{bad'), null); assert.equal(parse('x'.repeat(160001)), null);
(async () => {
  const map = new Map(), storage = { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) };
  const store = new Store(storage); assert.equal(store.write(record()).error, 'locked');
  await store.acquire(); store.adopt(null); const first = record(); assert.ok(store.write(first).ok);
  const second = record(); second.elapsedMs += 300; assert.ok(store.write(second).ok);
  assert.deepEqual(JSON.parse(map.get(BACKUP)), first);
  map.set(KEY, '{broken'); const recovered = store.read(); assert.equal(recovered.recovered, true); assert.deepEqual(recovered.record, first);
  assert.equal(store.write(second).error, 'conflict'); store.adopt(recovered.raw); assert.ok(store.write(second).ok);
  const other = new Store(storage); await other.acquire(); other.adopt(map.get(KEY));
  second.elapsedMs++; assert.ok(store.write(second).ok); assert.equal(other.write(first).error, 'conflict');
  const failing = new Store({ getItem: () => null, setItem: () => { throw Error('quota'); } });
  await failing.acquire(); assert.equal(failing.write(first).error, 'unavailable');
  assert.equal(new Store(null).read().error, 'unavailable');
  game.end(); const frozen = record(); frozen.finalized = true;
  frozen.submissionPayload = { runId: frozen.runId, playerId: frozen.playerDraft, mode: 'expedition', cleared: game.recovered,
    rules: 3, completedStages: game.completedStages, tenMs: null, elapsedMs: Math.round(frozen.elapsedMs), stage: game.stage, loadout: game.loadout() };
  assert.ok(valid(frozen)); assert.deepEqual(parse(JSON.stringify(frozen)), frozen);
  frozen.receipt = { ok: true, improved: true, rank: 1, playerId: frozen.playerDraft }; assert.ok(valid(frozen));
  frozen.submissionPayload.cleared += 3; assert.equal(valid(frozen), false);
  console.log(`PASS: ${checkpoints} valid round trips, deterministic replay, reward/stage/terminal states, tools, 1000 banking boundaries, corrupt saves, backup recovery, write conflict, unavailable storage and frozen submission receipts.`);
})().catch(error => { console.error(error); process.exit(1); });
