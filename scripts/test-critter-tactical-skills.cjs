'use strict';
const assert=require('node:assert/strict');
const R=require('../critter-cascade/expedition.js'),Core=require('../critter-cascade/core.js'),Copy=require('../critter-cascade/companions.js'),LB=require('../critter-cascade/leaderboard.js'),Save=require('../critter-cascade/expedition-save.js');
const seed=n=>()=>{n=(Math.imul(n,1664525)+1013904223)|0;return(n>>>0)/4294967296;};
function fresh(id,stage=1,level=1,n=13){const g=new R.Expedition(seed(n));g.pendingReward=[id];assert.ok(g.choose(id));if(stage>1){const b=new Core.Game('rain',seed(n),R.stageSpec(stage));for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];g.stage=stage;g.banked=R.bankedBefore(stage);}g.relics[id]=level;return g;}
function check(g){assert.ok(R.validSave(g.toSave()),'valid checkpoint');assert.deepEqual(R.Expedition.fromSave(g.toSave()).toSave(),g.toSave());}
const geometry=g=>g.tiles.filter(t=>t.zone==='board').map(t=>[t.x,t.y,t.z,t.pile].join(':')).sort();
const available=g=>new Set(g.available().map(t=>t.id));
// All levels: preview is pure, matches actual exposure, conserves board geometry,
// tile identities and counts, and cannot be used as a free covered pick or Undo.
let flips=0;
for(let level=1;level<=5;level++)for(let n=1;n<=20;n++){
 const g=fresh('feather',21,level,n),before=JSON.stringify(g.toSave()),targets=g.featherTargets();assert.ok(targets.length);
 assert.equal(JSON.stringify(g.toSave()),before);assert.equal(g.activate(-1).ok,false);assert.equal(JSON.stringify(g.toSave()),before);
 for(const target of [targets.find(t=>t.pile==='main'),targets.find(t=>t.pile==='left'),targets.find(t=>t.pile==='right')].filter(Boolean)){
  const h=R.Expedition.fromSave(g.toSave()),plan=h.flipPlan(target.id),oldAvailable=available(h),positions=geometry(h),types=h.tiles.map(t=>t.type),old=h.toSave();
  assert.equal(h.pick(target.id,true).ok,false);assert.deepEqual(h.toSave(),old);
  const result=h.activate(target.id);assert.ok(result.ok);assert.equal(result.recovered,0);assert.equal(result.events[0].action,'flip');assert.equal(h.charge,0);assert.equal(h.moves,0);assert.equal(h.cleared,0);assert.deepEqual(h.rack,[]);assert.deepEqual(h.reserve,[]);assert.deepEqual(geometry(h),positions);assert.deepEqual(h.tiles.map(t=>t.type),types);
  assert.deepEqual([...available(h)].filter(id=>!oldAvailable.has(id)).sort((a,b)=>a-b),[...plan.revealed].sort((a,b)=>a-b));
  assert.equal(h.previous,null);assert.equal(h.canUse('undo'),false);assert.equal(h.activate(target.id).ok,false);check(h);
  const revealed=plan.revealed[0];assert.ok(h.pick(revealed).ok);assert.ok(h.use('undo'));assert.equal(h.charge,0);assert.deepEqual(geometry(h),positions);check(h);flips++;
 }
}
// An area without buried tiles is not an eligible target; higher levels expand area and recharge faster.
{
 const g=fresh('feather');g.tiles.forEach((t,i)=>Object.assign(t,{x:i%6*80,y:Math.floor(i/6)*80,z:0,pile:'main'}));assert.equal(g.canActivate(),false);assert.equal(g.activate(0).ok,false);assert.equal(g.charge,1);check(g);
 const h=fresh('feather',21),radii=[],costs=[];for(let level=1;level<=5;level++){h.relics.feather=level;radii.push(h.flipRadius);costs.push(h.recharge);}assert.ok(radii.every((v,i)=>!i||v>radii[i-1]));assert.deepEqual(costs,[10,9,8,7,6]);
}
// Flip changes neither boss progress nor armed fuses; memory tracks newly exposed identities.
for(const stage of [15,20,30,70,100]){
 const g=fresh('feather',stage,3);g.trial=stage===20?{kind:'ward',types:[0,1,2],broken:[]}:stage===30?{kind:'armor',types:[],broken:[]}:stage===70?{kind:'echo',types:[],broken:[],lastType:null,open:false}:stage===100?{kind:'crown',types:[0,1,2],broken:[]}:null;
 if(stage===15){g.environment={kind:'memory',started:true,preview:0,cards:[],bonusClaimed:false};g.refreshEnvironment();}
 if(stage===70)g.pressure={started:true,hearts:3,remaining:1200};
 g.relics.resin=1;const type=g.tiles[0].type;g.fuse={ids:g.tiles.filter(t=>t.type===type).slice(0,3).map(t=>t.id),ticks:2};const fuse=structuredClone(g.fuse),trial=structuredClone(g.trial),pressure=structuredClone(g.pressure);
 const plan=g.flipPlan(g.featherTargets()[0].id);assert.ok(g.activate(g.featherTargets()[0].id).ok);assert.deepEqual(g.fuse,fuse);assert.deepEqual(g.trial,trial);assert.deepEqual(g.pressure,pressure);assert.equal(g.stageMatches,0);assert.equal(g.bossEnergy,0);
 if(g.environment)assert.ok(g.environment.cards.every(c=>available(g).has(c.id)));check(g);
}
// Both revised actives are sealed and returned at every boss, with the same slots.
for(const stage of Object.keys(R.BOSSES).map(Number))for(const active of ['feather','shield']){
 const g=fresh(active,stage-1,3);g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());assert.equal(g.tacticalCompanions,true);assert.equal(g.equipment,null);check(g);
 while(Object.keys(g.sealed).length)g.reclaim([]);assert.equal(g.equipment,active);assert.equal(g.relics[active],3);check(g);
}
function fullTray(g){g.tiles.forEach((t,i)=>Object.assign(t,{type:Math.floor(i/6),x:i%6*80,y:Math.floor(i/6)*80,z:0,pile:'main',zone:'board'}));g.rack=[0,6,12,18,24,30];g.rack.forEach(id=>g.tiles[id].zone='rack');g.moves=6;}
// Stash allows partial reserve space, moves leftmost tiles, never clears or spends the free tool.
for(let occupied=0;occupied<=3;occupied++){
 const g=fresh('shield');fullTray(g);g.reserve=[2,8,14].slice(0,occupied);g.reserve.forEach(id=>g.tiles[id].zone='reserve');const old=g.toSave(),result=g.activate();
 if(occupied===3){assert.equal(result.ok,false);assert.deepEqual(g.toSave(),old);continue;}
 assert.ok(result.ok);const moved=old.rack.slice(0,3-occupied);assert.deepEqual(g.reserve,[...old.reserve,...moved]);assert.deepEqual(g.rack,old.rack.slice(3-occupied));assert.equal(g.charge,0);assert.equal(g.used.remove,false);assert.equal(g.cleared,0);assert.equal(g.shieldArmed,false);assert.equal(result.events[0].action,'stash');assert.equal(result.recovered,0);assert.equal(g.previous,null);check(g);
 const h=R.Expedition.fromSave(g.toSave());assert.ok(h.pick(moved[0]).ok);assert.ok(h.use('undo'));assert.deepEqual(h.reserve,g.reserve);assert.equal(h.charge,0);check(h);
}
{
 const g=fresh('shield');assert.equal(g.activate().ok,false);assert.equal(g.charge,1);fullTray(g);g.pick(1);assert.equal(g.status,'lost');assert.equal(g.shieldArmed,false);assert.equal(g.activate().ok,false);check(g);
 const h=fresh('shield',22),costs=[];for(let level=1;level<=5;level++){h.relics.shield=level;costs.push(h.recharge);}assert.deepEqual(costs,[8,7,6,5,4]);h.relics.cell=2;assert.equal(h.recharge,2);
}
// Rules 1 and 2 keep their existing behavior and saves. New rules reject an armed guard.
{
 const g=fresh('shield');g.companionRules=2;fullTray(g);assert.ok(g.activate().ok);assert.ok(g.shieldArmed);check(g);const h=R.Expedition.fromSave(g.toSave());assert.equal(h.tacticalCompanions,false);h.pick(1);assert.equal(h.status,'playing');assert.equal(h.rack.length,6);check(h);
 const f=fresh('feather');f.companionRules=2;const target=f.featherTargets()[0];assert.ok(f.activate(target.id).ok);assert.equal(f.tiles[target.id].zone,'rack');check(f);
 const bad=h.toSave();bad.companionRules=3;bad.shieldArmed=true;assert.equal(R.validSave(bad),false);
}
for(const language of ['zh','en']){
 const g=fresh('feather');assert.match(Copy.profile('feather',1,g,language).effect,language==='zh'?/振翅翻面/:/Wing Flip/);assert.match(Copy.profile('shield',1,g,language).effect,language==='zh'?/龟壳收纳/:/Shell Stash/);
 g.companionRules=2;assert.match(Copy.profile('feather',1,g,language).effect,language==='zh'?/取出/:/pick/);assert.match(Copy.profile('shield',1,g,language).effect,language==='zh'?/守护/:/guard/);
}
(async()=>{
 const g=fresh('feather');g.pick(g.available()[0].id);g.end();const payload={runId:'12345678-1234-4123-8123-123456789abc',playerId:'test',mode:'expedition',rules:3,companionRules:3,stage:1,completedStages:0,cleared:0,elapsedMs:10000,tenMs:null,loadout:g.loadout()};
 const record={schema:3,savedAt:Date.now(),runId:payload.runId,elapsedMs:10000,timerStarted:true,finalized:true,stageRewardClaimed:false,playerDraft:'test',tenTime:null,tenRecord:null,game:g.toSave(),receipt:null,submissionPayload:payload};assert.ok(Save.valid(record));assert.deepEqual(Save.parse(JSON.stringify(record)),record);
 const calls=[];const lb=new LB.Leaderboard({supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_test'},async(url)=>{calls.push(url);return{ok:true,json:async()=>({ok:true,rank:1,improved:true,playerId:'test'})};});assert.ok((await lb.submit(payload)).ok);assert.match(calls[0],/critter_submit_expedition_v4$/);assert.equal((await lb.submit({...payload,loadout:[{id:'feather',level:1},{id:'shield',level:1}]})).ok,false);assert.equal(calls.length,1);
 console.log(`PASS: ${flips} reversible-layout flips; exact previews; no covered-pick bypass; boss/memory/fuse constraints; full/partial/empty stash; upgrades; undo and save/load; rules 1/2 compatibility; bilingual copy; rules 3 ranked submission.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
