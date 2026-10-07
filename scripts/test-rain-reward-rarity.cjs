'use strict';
const assert = require('node:assert/strict');
const { Expedition, RELICS } = require('../clackworks/expedition.js');
const seed = n => () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; };
const red = id => RELICS[id]?.rarity === 'legendary';
const fresh = () => { const game = new Expedition(seed(319)); game.choose('feather'); return game; };

function sample(stage, saturated = false, noEquipment = false) {
  const game = fresh(), counts = {}, trials = 12000;
  game.stage = stage;
  game.relics = { blackhole: 1 };
  game.equipment = 'blackhole';
  if (saturated) for (const id of ['feather', 'shield', 'ukulele', 'cell', 'gasoline', 'blackhole']) game.relics[id] = game.levelCap;
  if (noEquipment) { game.relics = {}; game.equipment = null; }
  let offers = 0;
  for (let n = 0; n < trials; n++) {
    game.pendingReward = null; game.offerReward();
    const choices = game.pendingReward;
    assert.equal(new Set(choices).size, choices.length);
    assert.ok(choices.length >= 1 && choices.length <= 3);
    assert.ok(choices.filter(red).length <= 1);
    if (noEquipment) { assert.ok(choices.includes('blackhole')); assert.ok(choices.includes('radar')); }
    offers += Number(choices.some(red));
    choices.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  }
  const rate = offers / trials, behemothShare = counts.behemoth / offers;
  assert.ok(Math.abs(rate - game.legendaryChance) < .012, `red rate ${rate}`);
  assert.ok(Math.abs(behemothShare - 60 / 145) < .035, `Behemoth share ${behemothShare}`);
  return { rate, counts };
}
const normal = sample(3);
assert.ok(normal.counts.gasoline > normal.counts.feather);
assert.ok(normal.counts.feather > normal.counts.shield);
sample(3, true); // Maxed lower tiers must not make red gear guaranteed.
sample(3, false, true); // The first active equipment remains available.
const late = sample(11);
assert.ok(late.rate > normal.rate);
for (const [roll, expected] of [[.179999, true], [.18, false]]) {
  const game = fresh(); game.random = () => roll; game.offerReward();
  assert.equal(game.pendingReward.some(red), expected);
}
{
  const game = fresh(); game.stage = 11; game.relics = { behemoth: 2, clover: 3, echo: 3, blackhole: 1 }; game.equipment = 'blackhole'; game.random = () => 0;
  game.offerReward(); assert.ok(game.pendingReward.includes('behemoth')); assert.ok(!game.pendingReward.includes('clover'));
  assert.ok(game.choose('behemoth')); assert.equal(game.relics.behemoth, 3);
  game.offerReward(); assert.ok(!game.pendingReward.some(red));
  game.pendingReward = null; game.stage = 10; game.offerReward(); assert.equal(game.pendingReward, null);
}
for (let n = 1; n <= 100; n++) {
  const game = fresh(); game.rngState = n * 19773;
  const restored = Expedition.fromSave(game.toSave());
  game.offerReward(); restored.offerReward();
  assert.deepEqual(restored.pendingReward, game.pendingReward);
  assert.equal(restored.rngState, game.rngState);
  const pending = [...game.pendingReward], rng = game.rngState;
  game.offerReward(); assert.deepEqual(game.pendingReward, pending); assert.equal(game.rngState, rng);
  assert.deepEqual(Expedition.fromSave(game.toSave()).pendingReward, pending);
}
console.log(`PASS: 48,000 supplies; red offers ${(normal.rate * 100).toFixed(1)}% / ${(late.rate * 100).toFixed(1)}%; rarity weights, one red maximum, capped-pool protection, upgrade caps, equipment access, Boss gating and deterministic save/resume.`);
