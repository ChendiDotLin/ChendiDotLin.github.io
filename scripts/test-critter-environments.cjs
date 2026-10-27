'use strict';
const assert=require('node:assert/strict'),R=require('../critter-cascade/expedition.js'),{Game}=require('../critter-cascade/core.js');
const seed=n=>()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296;};
function enter(stage,n=1){const g=new R.Expedition(seed(n)),b=new Game('rain',seed(n),R.stageSpec(stage-1));g.choose('feather');for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];Object.assign(g,{stage:stage-1,banked:R.bankedBefore(stage-1),pendingReward:null});g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());return g;}
for(let stage=1;stage<=115;stage++)assert.equal(R.environmentAt(stage),stage>=15&&stage%10===5?(stage%20===15?'memory':'mono'):null);
for(const stage of [15,25,35,45,55,65,75,85,95,105])for(let n=1;n<=3;n++){
 const g=enter(stage,n);assert.ok(R.validSave(g.toSave()));assert.equal(g.environment.kind,R.environmentAt(stage));assert.equal(g.bossActive,false);g.startEnvironment();
 for(const id of g.solution){const r=g.pick(id);assert.ok(r.ok);g.advanceEnvironment(333);if(g.pendingReward)g.skipReward();assert.ok(R.validSave(g.toSave()),`stage ${stage}`);}
 assert.equal(g.status,'won');assert.equal(g.stageRewardDue,false);assert.equal(g.claimEnvironmentBonus(),false);assert.equal(g.pendingReward,null);
 const saved=g.toSave(),restored=R.Expedition.fromSave(saved);assert.deepEqual(restored.toSave(),saved);assert.equal(restored.claimEnvironmentBonus(),false);assert.ok(restored.nextStage());assert.equal(restored.environment,null);

}
{
 const g=enter(15);const ids=g.environment.cards.map(c=>c.id);assert.equal(ids.length,5);g.advanceEnvironment(10000);assert.equal(g.environment.preview,5000,'intro paused');g.startEnvironment();g.advanceEnvironment(4999);assert.ok(!g.memoryHidden(ids[0]));g.advanceEnvironment(1);assert.ok(ids.every(id=>g.memoryHidden(id)));
 assert.deepEqual(R.Expedition.fromSave(g.toSave()).environment,g.environment);
 const before=g.toSave();assert.ok(g.pick(ids[0]).ok);assert.equal(g.memoryHidden(ids[0]),false);const fresh=g.environment.cards.find(c=>!ids.includes(c.id));assert.ok(fresh&&fresh.remaining===2000);assert.ok(g.use('undo'));assert.deepEqual(g.environment,before.environment);
 g.pendingReward=['feather'];const paused=JSON.stringify(g.environment);g.advanceEnvironment(3000);assert.equal(JSON.stringify(g.environment),paused);g.skipReward();
 g.relics.radar=1;g.radarCharge=g.radarRecharge-1;g.tiles.forEach((t,id)=>Object.assign(t,{z:0,type:Math.floor(id/3)%12}));for(const id of [0,1,2])g.pick(id);assert.ok(g.radarActive);assert.ok(ids.every(id=>!g.memoryHidden(id)));const scout=JSON.stringify(g.environment);g.advanceEnvironment(10000);assert.equal(JSON.stringify(g.environment),scout);
 g.radarUntil=0;assert.ok(g.use('shuffle'));assert.equal(g.environment.preview,2000);g.advanceEnvironment(2000);assert.ok(g.environment.cards.every(c=>g.memoryHidden(c.id)));
 // Remove an unknown tile into the tray, then manually complete a triple: visibility is earned again.
 g.tiles.forEach((t,id)=>Object.assign(t,{z:0,type:Math.floor(id/3)%12,zone:'board'}));g.rack=[];g.reserve=[];g.cleared=0;g.previous=null;g.environment.preview=0;g.environment.cards=[];g.refreshEnvironment();
 for(const id of [0,1,2])assert.ok(g.pick(id).ok);assert.equal(g.environment.preview,2000);
}
{
 const old=enter(15).toSave();delete old.environment;assert.equal(R.Expedition.fromSave(old).environment,null,'legacy stages do not change midway');
 for(const mutate of [e=>e.preview=-1,e=>e.cards.push({...e.cards[0]}),e=>e.kind='mono',e=>e.bonusClaimed=true]){const g=enter(15),s=g.toSave();mutate(s.environment);assert.equal(R.validSave(s),false);}
}
console.log('PASS: alternating environments, 30 complete stage witnesses, no special-stage bonus offers, save/reload/Undo, 5s and 2s windows, refill/Scout/Shuffle visibility and legacy/corrupt saves.');
