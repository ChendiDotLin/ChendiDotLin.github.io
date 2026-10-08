'use strict';
const assert = require('node:assert/strict');
const { Game, MODES } = require('../critter-cascade/core.js');
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function counts(game) {
  return game.tiles.reduce((all, t) => { all[t.type] = (all[t.type] || 0) + 1; return all; }, {});
}
// Every seeded layout must admit its constructed solution and retain triples.
for (const mode of Object.keys(MODES)) for (let seed = 0; seed < 100; seed++) {
  const game = new Game(mode, random(seed));
  assert.equal(game.tiles.length, MODES[mode].count);
  assert.ok(Object.values(counts(game)).every(count => count % 3 === 0));
  assert.ok(game.tiles.every(t => t.x >= 0 && t.y >= 0 && t.x + 72 <= 600 && t.y + 72 <= 590));
  if (mode !== 'drizzle') {
    const core = game.tiles.filter(t => t.pile === 'main');
    assert.equal(new Set(core.map(t => t.z)).size, mode === 'rain' ? 9 : 12);
    assert.equal(game.tiles.filter(t => t.pile === 'shelf').length, 12);
    assert.equal(new Set(Object.values(counts(game))).size, 1); // Balanced item counts.
    // Each shelf has two layers; deep core cards begin underneath real blockers.
    assert.equal(game.available().filter(t => t.pile === 'shelf').length, 6);
    assert.ok(core.some(t => t.z === 0 && !game.available().includes(t)));
  }
  for (const pile of ['left', 'right']) {
    assert.equal(game.available().filter(t => t.pile === pile).length, 1);
    const expected = mode === 'drizzle' ? 6 : mode === 'monsoon' ? 12 : 9;
    assert.equal(game.tiles.filter(t => t.pile === pile).length, expected);
  }
  const blocked = game.tiles.find(t => !game.available().includes(t));
  assert.equal(game.pick(blocked.id).ok, false);
  for (const id of game.solution) {
    assert.equal(game.pick(id).ok, true);
    assert.notEqual(game.status, 'lost');
    assert.ok(game.rack.length < 7);
  }
  assert.equal(game.status, 'won'); assert.equal(game.rack.length, 0);
  assert.equal(game.pick(0).ok, false);
}
// Undo reverses a match, preserving exact zones and counts.
{
  const game = new Game('rain', random(3));
  let before;
  for (const id of game.solution) {
    before = game.snapshot();
    if (game.pick(id).matched) break;
  }
  assert.ok(game.use('undo')); assert.deepEqual(game.snapshot(), before);
  assert.equal(game.use('undo'), false); assert.equal(game.used.undo, true);
}
// A power never accidentally refunds another power or allows stale undo.
{
  const game = new Game('rain', random(18));
  game.pick(game.solution[0]); const id = game.rack[0];
  assert.ok(game.use('remove')); assert.equal(game.rack.length, 0);
  assert.deepEqual(game.reserve, [id]); assert.equal(game.canUse('undo'), false);
  assert.equal(game.use('remove'), false); assert.ok(game.pick(id).ok);
  assert.ok(game.use('undo')); assert.deepEqual(game.reserve, [id]);
  assert.equal(game.used.remove, true); assert.equal(game.used.undo, true);
  game.pick(id);
  const before = counts(game), positions = game.tiles.map(t => [t.x, t.y, t.z]);
  assert.ok(game.use('shuffle')); assert.deepEqual(counts(game), before);
  assert.deepEqual(game.tiles.map(t => [t.x, t.y, t.z]), positions);
  assert.equal(game.use('shuffle'), false); assert.equal(game.previous, null);
}
// Exhaustion, seventh-slot matches, and rescue from a full rack.
function flatGame(types) {
  const game = new Game('rain', random(0));
  game.tiles = types.map((type, id) => ({ id, type, x: id * 80, y: 0, z: 0, zone: 'board' }));
  return game;
}
{
  const game = flatGame([0, 0, 1, 1, 2, 2, 0]);
  for (let id = 0; id < 7; id++) game.pick(id);
  assert.equal(game.status, 'playing'); assert.equal(game.rack.length, 4); assert.equal(game.cleared, 3);
}
for (const tool of ['remove', 'undo']) {
  const game = flatGame([0, 1, 2, 3, 4, 5, 6, 7]);
  for (let id = 0; id < 7; id++) game.pick(id);
  assert.equal(game.status, 'lost'); assert.equal(game.pick(7).ok, false);
  assert.equal(game.canUse('shuffle'), false); assert.ok(game.use(tool));
  assert.equal(game.status, 'playing'); assert.ok(game.rack.length < 7);
}
// Reserve cards must be reclaimed before victory.
{
  const game = flatGame([0, 0, 0]);
  game.pick(0); game.use('remove'); game.pick(1); game.pick(2);
  assert.equal(game.status, 'playing'); game.pick(0); assert.equal(game.status, 'won');
}
const fresh = new Game(); assert.deepEqual(fresh.used, { remove: false, undo: false, shuffle: false });
assert.equal(fresh.use('remove'), false); assert.equal(fresh.use('undo'), false);
// Supply piles uncover one card at a time and undo puts the same top card back.
{
  const game = new Game('rain', random(24));
  const top = game.available().find(t => t.pile === 'left');
  assert.ok(game.pick(top.id).ok);
  const next = game.available().filter(t => t.pile === 'left');
  assert.equal(next.length, 1); assert.notEqual(next[0].id, top.id);
  assert.ok(game.use('undo'));
  assert.deepEqual(game.available().filter(t => t.pile === 'left').map(t => t.id), [top.id]);
}
console.log('PASS: 300 solvable deals, main and supply stacks, blocked tiles, matching, inventory limits, all powers, rescue, reserve, and resets.');
