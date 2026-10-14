'use strict';
const assert = require('node:assert/strict');
const {Eclipse} = require('../critter-cascade/eclipse.js');
const random = seed => () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
for (let seed=0; seed<100; seed++) {
  const game = new Eclipse(random(seed));
  assert.equal(game.tiles.length,180);
  game.advanceEnvironment(100000); game.advancePressure(100000);
  assert.equal(game.pressure.started,false); assert.equal(game.environment.preview,5000);
  const blocked=game.tiles.find(t=>!game.available().includes(t));
  assert.equal(game.pick(blocked.id).ok,false); assert.equal(game.pressure.started,false);
  for (const id of game.solution) {
    game.advanceEnvironment(1000); game.advancePressure(1000);
    assert.equal(game.pick(id).ok,true); assert.equal(game.pressure.remaining,8000);
    assert.ok(game.environment.cards.length<=5); assert.notEqual(game.status,'lost');
  }
  assert.equal(game.status,'won'); assert.equal(game.pressure.hearts,3);
  assert.equal(game.advancePressure(100000),null);
}
const g=new Eclipse(random(3));
g.pick(g.solution[0]);g.advanceEnvironment(5000);
assert.ok(g.environment.cards.every(c=>g.memoryHidden(c.id)));
g.advancePressure(8500);assert.equal(g.pressure.hearts,2);assert.equal(g.pressure.remaining,7500);
assert.ok(g.use('undo'));assert.equal(g.moves,0);assert.equal(g.pressure.hearts,2);assert.equal(g.pressure.started,true);assert.equal(g.pressure.remaining,7500);
assert.ok(g.use('shuffle'));assert.equal(g.environment.preview,3000);assert.equal(g.pressure.remaining,7500);
assert.ok(g.environment.cards.every(c=>!g.memoryHidden(c.id)));
g.advancePressure(15500);assert.equal(g.pressure.hearts,0);assert.equal(g.status,'lost');
for (const tool of ['undo','remove','shuffle']) assert.equal(g.canUse(tool),false);
assert.equal(g.pick(g.available()[0].id).ok,false);
const memory=new Eclipse(random(6));let matched=false;
for (const id of memory.solution) {
  memory.advanceEnvironment(6000); const result=memory.pick(id);
  if(result.matched){matched=true;assert.ok(memory.environment.preview>=2000);break;}
}
assert.ok(matched);
console.log('PASS: 100 solvable Eclipse boards; first-pick activation, bounded memory marks/reveals, triple/shuffle relief, permanent hearts, nonrewinding Undo and terminal timeout.');
