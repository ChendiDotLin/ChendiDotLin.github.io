'use strict';
const assert = require('node:assert/strict');
const { Expedition } = require('../critter-cascade/expedition.js');
function board(types, relics = {}) {
 const g = new Expedition(() => .8); g.pendingReward = null; g.midRewardTaken = true;
 g.relics = relics; g.tiles = types.map((type, id) => ({ id, type, x: id % 6 * 85, y: Math.floor(id / 6) * 85, z: 0, pile: 'main', zone: 'board' }));
 g.rack = []; g.reserve = []; g.cleared = 0; g.random = () => 0;
 return g;
}
const match = (g, ids) => { let result; for (const id of ids) { result = g.pick(id); assert.ok(result.ok); } return result; };
// Fixed, visible charge counter: luck and high levels never hide an early discharge.
for (const level of [1, 2, 3]) {
 const g = board(Array.from({ length: 36 }, (_, id) => Math.floor(id / 3)), { ukulele: level, clover: 3 });
 for (let n = 0; n < 3; n++) { const r = match(g, [n * 3, n * 3 + 1, n * 3 + 2]); assert.equal(r.events.length, 0); assert.equal(g.spark, n + 1); }
 const r = match(g, [9, 10, 11]); assert.equal(r.events.filter(e => e.kind === 'ukulele').length, level); assert.equal(g.spark, 0);
}
// Coil never borrows tray pairs or clears covered tiles, even at level 3.
{
 const g = board([0,0,0,1,1,1,2,2,2], { ukulele: 3 });
 g.rack = [0,1];g.tiles[0].zone=g.tiles[1].zone='rack';g.tiles[3].x=g.tiles[2].x;g.tiles[3].y=g.tiles[2].y;g.tiles[2].z=1;
 g.lightningReady=true;g.beginBurst();const events=[];g.releaseLightning(events);
 assert.deepEqual(events[0].ids,[6,7,8]);assert.deepEqual(g.rack,[0,1]);assert.equal(g.tiles[3].zone,'board');
}
// Fire chooses the cleared TYPE, not the first convenient group; buried targets count.
{
 const g=board([1,1,1,0,0,0,1,1,1,2,2,2],{gasoline:1});
 for(const [id,cover] of [[6,9],[7,10],[8,11]]){g.tiles[id].x=g.tiles[cover].x;g.tiles[id].y=g.tiles[cover].y;g.tiles[cover].z=1;}
 const r=match(g,[0,1,2]);assert.deepEqual(r.events.filter(e=>e.kind==='gasoline').map(e=>e.ids),[[6,7,8]]);
 assert.equal(g.tiles[3].zone,'board');assert.equal(g.tiles[9].zone,'board');
}
// Boiler prioritizes a covered triple over an earlier exposed triple.
{
 const g=board([0,0,0,1,1,1,2,2,2]);
 for(const [id,cover] of [[3,6],[4,7],[5,8]]){g.tiles[id].x=g.tiles[cover].x;g.tiles[id].y=g.tiles[cover].y;g.tiles[cover].z=1;}
 assert.deepEqual(g.findProcTarget('behemoth',1),[3,4,5]);assert.deepEqual(g.findProcTarget('ukulele',0),[0,1,2]);
}
// Echo copies the source's targeting, rather than turning a rocket into a board wipe.
{
 const g=board([0,0,0,1,1,1,2,2,2,3,3,3],{echo:3});
 g.rack=[0,1,3,4];for(const id of g.rack)g.tiles[id].zone='rack';g.beginBurst();const events=[];
 g.pulse(events,'seeker',1,50);g.drainBurst(events);
 assert.deepEqual(events.filter(e=>e.kind==='echo').map(e=>e.ids),[[3,4,5]]);
 assert.equal(events.find(e=>e.kind==='echo').source,'seeker');assert.equal(g.tiles[6].zone,'board');
}
{
 const g=board([0,0,0,1,1,1,1,1,1,2,2,2],{echo:2});g.beginBurst();const events=[];
 g.pulse(events,'gasoline',1,50,{type:1});g.drainBurst(events);
 assert.deepEqual(events.map(e=>e.ids),[[3,4,5],[6,7,8]]);assert.equal(g.tiles[0].zone,'board');
}
// Capacitor has one job: a piercing follow-up, without secretly banking lightning.
{
 const g=board([0,0,0,1,1,1,2,2,2],{capacitor:3,ukulele:1});g.capacitorCharge=1;g.beginBurst();const events=[];
 g.pulse(events,'prism',1);g.drainBurst(events);
 assert.ok(events.some(e=>e.kind==='capacitor'));assert.equal(g.lightningReady,false);assert.equal(g.spark,0);
}
// An evolved timed charge detonates its marked triple only (no unmarked extra blast).
{
 const g=board([0,0,0,1,1,1,2,2,2],{resin:3});g.fuse={ids:[3,4,5],ticks:1};
 const r=match(g,[0,1,2]);assert.deepEqual(r.events.filter(e=>e.kind==='resin').map(e=>e.ids),[[3,4,5]]);assert.equal(g.tiles[6].zone,'board');
}
console.log('PASS: deterministic Coil charge, board-only lightning, type-specific burning, covered-first blasts, source-specific Echo, independent Capacitor and exact timed-charge targets.');
