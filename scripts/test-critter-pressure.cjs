'use strict';
const assert=require('node:assert/strict'),R=require('../critter-cascade/expedition.js'),{Game}=require('../critter-cascade/core.js');
function enter(stage=70){const g=new R.Expedition(()=>.31),b=new Game('rain',()=>.37,R.stageSpec(stage-1));g.choose('feather');for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];Object.assign(g,{stage:stage-1,banked:R.bankedBefore(stage-1),pendingReward:null});g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());return g;}
{
 const g=enter();assert.deepEqual(g.pressure,{started:false,hearts:3,remaining:8000});g.advancePressure(9000);assert.equal(g.pressure.hearts,3);g.startPressure();g.advancePressure(7999);assert.equal(g.pressure.remaining,1);assert.equal(g.pick(-1).ok,false);assert.equal(g.pressure.remaining,1);assert.deepEqual(g.advancePressure(1),{lost:1,ended:false});assert.equal(g.pressure.hearts,2);assert.equal(g.pressure.remaining,8000);
 g.advancePressure(1000);assert.ok(g.pick(g.available()[0].id).ok);assert.equal(g.pressure.remaining,8000);g.advancePressure(9000);assert.equal(g.pressure.hearts,1);assert.equal(g.pressure.remaining,7000);assert.ok(g.use('undo'));assert.equal(g.pressure.hearts,1);assert.equal(g.pressure.remaining,7000,'Undo does not restore countdown');
 assert.ok(R.validSave(g.toSave()));assert.deepEqual(R.Expedition.fromSave(g.toSave()).toSave(),g.toSave());assert.deepEqual(g.advancePressure(7000),{lost:1,ended:true});assert.equal(g.finished,true);assert.equal(g.status,'lost');assert.equal(g.previous,null);for(const tool of ['undo','remove','shuffle'])assert.equal(g.canUse(tool),false);assert.equal(g.pick(g.available()[0].id).ok,false);assert.equal(g.advancePressure(100000),null);assert.ok(R.validSave(g.toSave()));assert.equal(R.Expedition.fromSave(g.toSave()).finished,true);
}
{
 const g=enter();g.startPressure();assert.deepEqual(g.advancePressure(24000),{lost:3,ended:true});assert.equal(g.pressure.remaining,0);
 const old=enter().toSave();delete old.pressure;assert.equal(R.Expedition.fromSave(old).pressure,null);
 for(const mutate of [p=>p.hearts=4,p=>p.remaining=0,p=>p.remaining=8001,p=>{p.hearts=0;p.remaining=0;},p=>p.started='yes']){const s=enter().toSave();mutate(s.pressure);assert.equal(R.validSave(s),false);}
}
{
 const g=enter();g.startPressure();g.advancePressure(3000);assert.ok(g.use('shuffle'));assert.equal(g.pressure.remaining,5000);g.pendingReward=['feather'];g.advancePressure(9000);assert.equal(g.pressure.remaining,5000);g.skipReward();
 g.tiles.forEach((t,id)=>Object.assign(t,{z:0,type:Math.floor(id/3)%12,zone:id<3?'board':'matched'}));g.cleared=g.tiles.length-3;g.rack=[];g.reserve=[];for(const id of [0,1,2])g.pick(id);assert.equal(g.status,'won');g.advancePressure(100000);assert.equal(g.pressure.hearts,3);assert.ok(g.nextStage());assert.equal(g.pressure,null);
}
for(const stage of [10,30,60,80,100])assert.equal(enter(stage).pressure,null);
console.log('PASS: 8-second countdown, three hearts, valid-pick-only reset, irreversible timeout/Undo, exact save/reload, legacy/corrupt saves, victory and stage cleanup.');
