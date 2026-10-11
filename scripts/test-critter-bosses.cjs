'use strict';
const assert=require('node:assert/strict');
const R=require('../critter-cascade/expedition.js'),{Game}=require('../critter-cascade/core.js');
const seed=n=>()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296;};
function enter(stage,gear={feather:1},n=1){const g=new R.Expedition(seed(n));g.choose('feather');const b=new Game('rain',seed(n),R.stageSpec(stage-1));for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];Object.assign(g,{stage:stage-1,banked:R.bankedBefore(stage-1),relics:{...gear},pendingReward:null,midRewardTaken:true});g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());return g;}
function flat(g){g.tiles.forEach(t=>{t.z=0;t.type=0;});}
function triple(g){let r;for(let i=0;i<3;i++){r=g.pick(g.available()[0].id);assert.ok(r.ok);}assert.ok(r.matched);return r;}
// Upgrade all seven companions independently, including the formerly competing seventh Lv3 slot.
{
 const g=enter(30);g.stage=31;g.banked=R.bankedBefore(31);g.trial=null;g.sealed={};g.relics={feather:2,shield:2,ukulele:2,cell:2,gasoline:2,behemoth:2,blackhole:2};g.equipment='blackhole';g.charge=1;
 for(let level=3;level<=5;level++)for(const id of Object.keys(g.relics)){const before={...g.relics};g.pendingReward=[id];assert.ok(g.choose(id));for(const other of Object.keys(before))assert.equal(g.relics[other],other===id?level:before[other]);}
 assert.ok(R.validSave(g.toSave()));assert.deepEqual(R.Expedition.fromSave(g.toSave()).relics,g.relics);
 // Replace a full passive slot only after an explicit choice; active replacement remains independent.
 g.pendingReward=['clover'];const before={...g.relics};assert.equal(g.choose('clover'),false);assert.deepEqual(g.relics,before);assert.ok(g.choose('clover','feather'));assert.equal(Object.keys(g.relics).length,7);assert.equal(g.relics.blackhole,5);
 g.pendingReward=['radar'];assert.ok(g.choose('radar'));assert.equal(g.relics.blackhole,undefined);assert.equal(g.relics.shield,5);assert.equal(Object.keys(g.relics).length,7);
}
// All ten Boss stages retain the exact legal manual witness, seal first, save/Undo and restore on victory.
for(const stage of Object.keys(R.BOSSES).map(Number))for(let n=1;n<=6;n++){
 const g=enter(stage,{feather:1},n);assert.deepEqual(g.relics,{});assert.deepEqual(g.sealed,{feather:1});assert.ok(g.bossActive);assert.equal(g.pendingReward,null);assert.ok(R.validSave(g.toSave()));
 for(const id of g.solution){const before=g.toSave(),r=g.pick(id);assert.ok(r.ok);assert.ok(R.validSave(g.toSave()),`stage ${stage} invalid after pick ${id}`);if(r.matched){assert.deepEqual(R.Expedition.fromSave(g.toSave()).toSave(),g.toSave());if(!g.used.undo){const after=g.toSave();assert.ok(g.use('undo'));assert.deepEqual(g.trial,before.trial);const retry=g.pick(id);assert.deepEqual(retry.events,r.events);assert.deepEqual(g.sealed,after.sealed);}}}
 assert.equal(g.status,'won');assert.deepEqual(g.sealed,{});assert.deepEqual(g.relics,{feather:1});assert.equal(g.banked+g.cleared,R.bankedBefore(stage+1));assert.ok(g.nextStage());assert.equal(g.stage,stage+1);assert.equal(g.trial,null);
}
// Level 4/5 seals and full seven-member builds survive checkpoints and victory at every later guardian.
for(const stage of [20,30,40,50,60,70,80,90,100]){
 const l=R.levelCapAt(stage),gear={feather:l,shield:l,cell:l,ukulele:l,behemoth:l,clover:l,blackhole:l},g=enter(stage,gear);flat(g);
 assert.ok(R.validSave(g.toSave()));assert.deepEqual(R.Expedition.fromSave(g.toSave()).loadout(),g.loadout());
 const first=triple(g);assert.equal(first.events.filter(e=>e.kind==='reclaim').length,1);assert.ok(R.validSave(g.toSave()));
 // Final manual triple restores all not-yet-returned levels, regardless of special rules or pace.
 g.tiles.forEach((t,i)=>t.zone=i<3?'board':'matched');g.rack=[];g.reserve=[];g.cleared=g.tiles.length-3;g.previous=null;g.status='playing';
 const win=triple(g);assert.deepEqual(g.relics,gear);assert.deepEqual(g.sealed,{});assert.equal(win.events.filter(e=>e.kind==='bossBreak').length,1);assert.ok(R.validSave(g.toSave()));
}
// The new restrictions are functional and every target path uses procAllowed / trialBurstLimit.
{
 const g=enter(40);flat(g);g.trial.lastType=1;assert.equal(g.findProcTarget('gasoline',50,0),null);g.trial.lastType=0;assert.equal(g.findProcTarget('gasoline',50,0).length,3);
}
{
 const g=enter(50);flat(g);g.tiles[0].z=1;g.tiles[6].x=g.tiles[0].x;g.tiles[6].y=g.tiles[0].y;assert.equal(g.procAllowed(g.tiles[6]),false);g.trial.broken=[0,1,2,3];assert.equal(g.procAllowed(g.tiles[6]),true);
}
{
 const g=enter(60);assert.equal(g.trialBurstLimit,2);g.stageMatches=2;assert.equal(g.trialBurstLimit,g.normalBurstLimit);g.stageMatches=4;assert.equal(g.trialBurstLimit,2);
 g.relics={recycler:5};g.sealed={};flat(g);g.tiles.forEach((t,i)=>t.zone=i<21?'board':'matched');g.cleared=g.tiles.length-21;g.beginBurst();g.resolveCombos([]);assert.equal(g.cleared,g.tiles.length-15,'finisher must respect high tide cap');
}
{
 const g=enter(70);g.advanceTrial(0,[]);assert.equal(g.trialBurstLimit,0);g.advanceTrial(1,[]);assert.equal(g.trialBurstLimit,g.normalBurstLimit);g.advanceTrial(1,[]);assert.equal(g.trialBurstLimit,0);
 g.relics={blackhole:5};g.equipment='blackhole';g.charge=1;flat(g);g.pick(0);g.pick(1);assert.ok(g.cubeTargets().length);assert.equal(g.canActivate(),false,'active cannot bypass silence');
}
{
 const g=enter(80);assert.deepEqual(g.protectedTypes,[0,1]);g.stageMatches=2;assert.deepEqual(g.protectedTypes,[2,3]);g.stageMatches=12;assert.deepEqual(g.protectedTypes,[0,1]);
}
{
 const g=enter(90,{feather:5,shield:5});flat(g);triple(g);triple(g);assert.equal(g.bossEnergy,1);triple(g);assert.equal(g.bossEnergy,2);triple(g);assert.equal(g.bossEnergy,0);
}
{
 const g=enter(100);assert.equal(g.trialBurstLimit,2);g.trial.broken=[...g.trial.types];assert.equal(g.trialBurstLimit,3);g.stageMatches=9;assert.equal(g.trialBurstLimit,g.normalBurstLimit);
}
// No retroactive confiscation for ongoing saves from before the new guardians existed.
for(const stage of [20,30,40,100]){const g=enter(stage);g.relics={...g.sealed};g.sealed={};g.featherCharge=1;g.trial=null;const s=g.toSave();assert.ok(R.validSave(s));assert.deepEqual(R.Expedition.fromSave(s).toSave(),s);assert.equal(g.bossActive,false);}
console.log('PASS: independent seven-companion upgrades/replacement, 60 complete Boss witnesses, all ten seal/recovery/victory paths, level-5 checkpoints, Undo, legacy saves, seven new restrictions and finisher/active bypass guards.');
module.exports={enter,flat,triple};
