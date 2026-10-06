'use strict';
const assert=require('node:assert/strict');const {Expedition,stageSpec,bankedBefore,validSave}=require('../rain_match/expedition.js');const {Game}=require('../rain_match/core.js');const Save=require('../rain_match/expedition-save.js');
const seed=n=>()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296};
function stage(n,gear) {const g=new Expedition(seed(9)),b=new Game('rain',seed(19),stageSpec(n));g.choose('feather');for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];g.stage=n;g.banked=bankedBefore(n);g.relics={...gear};g.equipment=Object.keys(gear).find(id=>['radar','blackhole'].includes(id))||null;g.featherCharge=gear.feather?1:0;g.charge=g.equipment?1:0;return g;}
const gear={feather:2,shield:2,cell:2,clover:2,gasoline:2,behemoth:2,radar:2};
{
 const g=stage(9,gear);g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());
 assert.equal(g.stage,10);assert.deepEqual(g.relics,{});assert.deepEqual(g.sealed,gear);assert.equal(g.equipment,null);assert.equal(g.canActivate(),false);assert.equal(g.featherCharge,0);assert.ok(validSave(g.toSave()));
 const solution=[...g.solution];let match,id,before;
 for(id of solution) {before=g.toSave();match=g.pick(id);if(match.matched)break;}
 const first=g.toSave();assert.equal(match.events.filter(e=>e.kind==='reclaim').length,1);assert.equal(Object.keys(g.relics).length,1);assert.equal(g.sealedLevels,12);assert.ok(validSave(first));
 const reload=Expedition.fromSave(first);assert.deepEqual(reload.toSave(),first);assert.ok(reload.use('undo'));assert.deepEqual(reload.sealed,before.sealed);assert.deepEqual(reload.relics,before.relics);
 const replay=reload.pick(id);assert.deepEqual(replay.events,match.events);assert.equal(reload.cleared,g.cleared);assert.equal(g.pendingReward,null);
 // Finish real triples through the same return/chain path and verify the travel boundary.
 while(g.cleared<g.tiles.length) {g.beginBurst();const type=g.tiles.find(t=>t.zone!=='matched').type,ids=g.tiles.filter(t=>t.zone!=='matched'&&t.type===type).slice(0,3).map(t=>t.id);g.clearTriple(ids);g.onTriple([]);g.drainBurst([]);g.check();}
 assert.deepEqual(g.sealed,{});assert.deepEqual(g.ownedRelics(),gear);assert.equal(g.completedStages,10);assert.ok(validSave(g.toSave()));
 assert.ok(g.nextStage());assert.equal(g.stage,11);assert.equal(g.bossActive,false);assert.deepEqual(g.ownedRelics(),gear);
}
// Six passives fit; a seventh requires an explicit replacement. Evolutions expand.
{
 const g=stage(11,{feather:3,shield:3,cell:3,ukulele:3,gasoline:3,behemoth:3,radar:2});assert.ok(validSave(g.toSave()));
 g.pendingReward=['clover'];assert.equal(g.choose('clover'),false);assert.ok(g.choose('clover','shield'));assert.equal(Object.keys(g.relics).length,7);assert.equal(g.relics.clover,1);assert.equal(g.relics.shield,undefined);
}
// A mature build can recover almost a whole page in one action, with a hard cap.
let largest=0;
for(let n=1;n<=80;n++) {
 const g=stage(21,{feather:3,cell:3,ukulele:3,gasoline:3,behemoth:3,clover:3,blackhole:2});
 g.tiles.forEach(t=>{t.type=0;t.z=0;});g.rngState=n;
 g.pick(0);g.pick(1);const result=g.pick(2);largest=Math.max(largest,result.recovered);
 assert.ok(result.recovered<=144);assert.ok(validSave(g.toSave()));assert.equal(result.events.filter(e=>e.ids.length===3).reduce((n,e)=>n+e.ids.length,3),g.cleared);
}
assert.ok(largest>=132,`largest burst ${largest}`);
// The same payoff also occurs on an unmodified layered, twelve-item deal.
{
 const g=stage(21,{feather:3,cell:2,ukulele:3,gasoline:3,behemoth:3,clover:3,blackhole:3});
 g.rngState=new Expedition(seed(1)).rngState;g.charge=3;g.midRewardTaken=true;let burst=0;
 for(let i=0;i<200&&g.status==='playing';i++) {
  let result;const pairs=new Set(g.rack.map(id=>g.tiles[id].type).filter((type,_,all)=>all.filter(t=>t===type).length===2));
  if(g.canActivate())result=g.activate(g.cubeTargets()[0].id);
  else {const leap=g.featherTargets().find(t=>pairs.has(t.type));if(leap)result=g.pick(leap.id,true);
   else {const available=g.available();available.sort((a,b)=>g.rack.filter(id=>g.tiles[id].type===b.type).length-g.rack.filter(id=>g.tiles[id].type===a.type).length);if(!available.length)break;result=g.pick(available[0].id);}}
  burst=Math.max(burst,result.recovered||0);assert.ok(validSave(g.toSave()));
 }
 assert.equal(burst,144);assert.equal(g.status,'won');
}
// Migrate a real v2-shaped checkpoint in place; keep its board, tools and Undo.
{
 const g=new Expedition(seed(12));g.choose('feather');g.pick(g.solution[0]);const data=g.toSave();data.version=2;delete data.competitive;delete data.sealed;delete data.blastCharge;
 for(const key of ['relics','equipment','sealed','blastCharge'])delete data.previous[key];
 const old={schema:2,savedAt:100,runId:'12345678-1234-4123-8123-123456789abc',elapsedMs:200,finalized:false,receipt:null,submissionPayload:null,stageRewardClaimed:false,playerDraft:'',game:data};
 const converted=Save.parse(JSON.stringify(old));assert.ok(converted);assert.equal(converted.game.competitive,false);assert.deepEqual(converted.game.tiles,data.tiles);assert.ok(Expedition.fromSave(converted.game).use('undo'));
}
console.log(`PASS: six passive slots, expanded evolution limits, Boss sealing and random returns, Undo/reload replay, full restoration, endless continuation, v2 save migration, bounded mature burst (${largest} tiles).`);
