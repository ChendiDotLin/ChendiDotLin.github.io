'use strict';
const assert = require('node:assert/strict');
const R = require('../clackworks/expedition.js'), C = require('../clackworks/companions.js');
const {Game}=require('../clackworks/core.js');
const seed = n => () => { n=Math.imul(n,1664525)+1013904223|0; return (n>>>0)/4294967296; };
function at(stage,gear={feather:1}) {
 const g=new R.Expedition(seed(stage));g.choose('feather');const b=new Game('rain',seed(stage),R.stageSpec(stage));
 for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];
 Object.assign(g,{stage,banked:R.bankedBefore(stage),relics:{...gear},equipment:Object.keys(gear).find(id=>R.RELICS[id].kind==='active')||null,charge:0,energy:0,featherCharge:gear.feather?1:0});
 return g;
}
function enter(stage,gear,salt=1) { const g=at(stage-1,gear);g.rngState=12345+salt;g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());return g; }
function flat(g) { g.tiles.forEach((t,i)=>Object.assign(t,{z:0,type:Math.floor(i/3)%12})); }
function match(g,type) { const ids=g.tiles.filter(t=>t.zone==='board'&&(type===undefined||t.type===type)).slice(0,3).map(t=>t.id);assert.equal(ids.length,3);let r;for(const id of ids){r=g.pick(id);assert.ok(r.ok);}assert.ok(r.matched);assert.ok(R.validSave(g.toSave()),JSON.stringify({stage:g.stage,trial:g.trial}));return r; }
assert.equal(Object.keys(R.FAMILIES).length,4);
assert.equal(new Set(Object.values(R.FAMILIES).flat()).size,16);
for(const id of Object.keys(R.RELICS))for(const lang of ['zh','en']) {
 assert.equal(new Set([1,2,3,4,5].map(l=>C.name(id,l,lang))).size,5);
 for(let level=1;level<=5;level++)assert.ok(C.description(id,level,null,lang).length>8);
}
assert.deepEqual([1,3,6,11,21].map(R.levelCapAt),[1,2,3,4,5]);
assert.deepEqual([1,2,3,4,5].map(R.rarityAt),['common','uncommon','rare','void','legendary']);
for(const family of Object.keys(R.FAMILIES)) {
 const g=at(31,Object.fromEntries(R.FAMILIES[family].map(id=>[id,5])));
 if(!g.relics.feather)g.featherCharge=0;
 assert.equal(g.familyCount(family),4);assert.ok(R.validSave(g.toSave()));
 assert.deepEqual(R.Expedition.fromSave(g.toSave()).toSave(),g.toSave());
 if(family==='dragons')assert.equal(g.lightningLimit,3);
 if(family==='shells')assert.equal(g.capacity,7);
}
// Both new bosses are solvable with the original legal board witness and no damage procs.
for(const stage of [20,30])for(let i=0;i<12;i++) {
 const g=enter(stage,{feather:1},i);assert.ok(g.bossActive);assert.equal(g.pendingReward,null);
 for(const id of g.solution){assert.ok(g.pick(id).ok);assert.ok(R.validSave(g.toSave()));}
 assert.equal(g.status,'won');assert.equal(g.completedStages,stage);assert.equal(g.banked+g.cleared,R.bankedBefore(stage+1));
 if(stage===20)assert.equal(g.trial.broken.length,3);
 assert.ok(g.nextStage());assert.equal(g.trial,null);
}
// Ward targets resist every automatic targeting path, but manual matches unlock that type.
{
 const g=enter(20,{ukulele:4,gasoline:4,behemoth:4,capacitor:4,clover:4,echo:4});flat(g);
 const locked=new Set(g.trial.types);
 for(const kind of ['ukulele','gasoline','behemoth','prism','resin','echo','recycler']) {
  const ids=g.findProcTarget(kind,50,0);assert.ok(!ids||ids.every(id=>!locked.has(g.tiles[id].type)),kind);
 }
 const initial=g.toSave(), type=g.trial.types[0];
 const outcome=match(g,type);assert.ok(outcome.events.some(e=>e.kind==='wardBreak'));
 assert.ok(g.trial.broken.includes(type));assert.ok(!g.trial.broken.includes(g.trial.types[1]));
 const nextType=g.trial.types[1];const left=g.tiles.filter(t=>t.type===nextType&&t.zone==='board');assert.ok(left.length>=3,'other ward remains intact through a large chain');
 const after=g.toSave();assert.deepEqual(R.Expedition.fromSave(after).toSave(),after);
 assert.ok(g.use('undo'));assert.equal(g.trial.broken.length,0);
 const retry=g.pick(g.tiles.filter(t=>t.zone==='board'&&t.type===type)[0].id);assert.ok(retry.ok);assert.deepEqual(g.trial,after.trial);
 const old={...initial};delete old.trial;delete old.previous;old.previous=null;assert.equal(R.Expedition.fromSave(old).trial,null,'old mid-stage saves are not retroactively given wards');
}
// Armor budgets count all automatic paths; later phases restore huge chains.
{
 const g=enter(30,{prism:5,behemoth:5,clover:5,echo:5,gasoline:5,capacitor:5});flat(g);
 let sawFull=false;
 while(g.status==='playing') {
  const r=match(g);const cap=g.stageMatches<3?3:g.stageMatches<6?6:52;
  assert.ok(r.recovered<=3+cap*3,`armor leaked ${r.recovered} at match ${g.stageMatches}`);
  if(g.stageMatches>=6&&r.recovered>21)sawFull=true;
 }
 assert.ok(g.stageMatches>=6);assert.ok(sawFull);assert.equal(g.status,'won');
}
// Level-five fuse marks exactly the targets it will detonate, then survives a checkpoint.
{
 const g=at(31,{resin:5});g.featherCharge=0;g.tiles.forEach(t=>{t.z=0;t.type=0;});g.midRewardTaken=true;
 match(g);assert.equal(g.fuse.ids.length,9);assert.equal(g.fuse.ticks,1);
 const ids=[...g.fuse.ids];const restored=R.Expedition.fromSave(g.toSave());
 // Pick a triple away from the marked group, preserving its pending explosion.
 for(const id of restored.tiles.filter(t=>t.zone==='board'&&!ids.includes(t.id)).slice(-3).map(t=>t.id))restored.pick(id);
 assert.ok(ids.every(id=>restored.tiles[id].zone==='matched'));assert.ok(R.validSave(restored.toSave()));
}
console.log('PASS: 80 bilingual forms, five-level gates/saves, four families, both full Boss witnesses, ward immunity/manual break/Undo, armor budgets and full-power phase, nine-target fuse.');
module.exports={at,enter};
