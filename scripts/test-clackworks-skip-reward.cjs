'use strict';
const assert = require('node:assert/strict');
const { Expedition } = require('../clackworks/expedition.js');
const game = new Expedition(() => .37);
assert.equal(game.skipReward(), false, 'starter must still be chosen');
game.choose('feather');
assert.equal(game.skipReward(), false, 'cannot skip without an offer');
// A full build must not force a replacement, grant energy or advance RNG.
game.relics = { feather: 1, ukulele: 1, shield: 1, cell: 1, seeker: 1, turbine: 1, blackhole: 1 };
game.equipment = 'blackhole'; game.charge = 0; game.energy = 2;
game.used.shuffle = true;
game.pendingReward = ['gasoline', 'prism', 'resin'];
assert.equal(game.choose('gasoline'), false);
const before = game.toSave();
assert.ok(game.skipReward());
assert.deepEqual(game.toSave(), { ...before, pendingReward: null, previous: null });
assert.deepEqual(Expedition.fromSave(game.toSave()).toSave(), game.toSave());
assert.equal(game.skipReward(), false, 'a consumed offer cannot be reused');
// Consume the real mid-stage offer, then finish and skip the stage-clear offer.
const run = new Expedition(() => .37); run.choose('feather');
for (const id of run.solution) {
  assert.ok(run.pick(id).ok);
  if (run.pendingReward) {
    assert.ok(run.skipReward());
    assert.equal(run.previous, null, 'Undo must not re-open a skipped offer');
    assert.ok(run.midRewardTaken);
  }
}
assert.equal(run.status, 'won'); run.offerReward();
assert.ok(run.skipReward());
const restored = Expedition.fromSave(run.toSave());
assert.ok(restored.nextStage()); assert.equal(restored.stage, 2);
restored.pendingReward = ['radar']; restored.finished = true;
assert.equal(restored.skipReward(), false, 'finished run is immutable');
console.log('PASS: optional supply, full build preservation, no refill/RNG change, Undo boundary, saves, mid-stage and next-stage continuation.');
