'use strict';
const assert=require('node:assert/strict');
const Rules=require('../critter-cascade/expedition.js'),Save=require('../critter-cascade/expedition-save.js'),Copy=require('../critter-cascade/companions.js'),LB=require('../critter-cascade/leaderboard.js');
const {Expedition,RELICS,FAMILIES,validSave,bankedBefore,stageSpec}=Rules;
const seed=n=>()=>{n=(Math.imul(n,1664525)+1013904223)|0;return(n>>>0)/4294967296;};
const fresh=id=>{const g=new Expedition(seed(13));g.pendingReward=[id];assert.ok(g.choose(id));return g;};
function check(g){assert.ok(validSave(g.toSave()),`invalid: ${JSON.stringify({rules:g.companionRules,equipment:g.equipment,relics:g.relics,sealed:g.sealed,charge:g.charge,radarCharge:g.radarCharge,stage:g.stage})}`);assert.deepEqual(Expedition.fromSave(g.toSave()).toSave(),g.toSave());}
function flat(g,rack=[]){g.tiles.forEach((t,i)=>{t.type=Math.floor(i/6);t.z=0;t.x=(i%6)*80;t.y=Math.floor(i/6)*80;t.zone=rack.includes(i)?'rack':'board';t.pile='main';});g.rack=[...rack];g.moves=rack.length;g.cleared=0;g.previous=null;g.status='playing';}
for(const [family,ids] of Object.entries(FAMILIES)){
 assert.equal(ids.filter(id=>RELICS[id].kind==='active').length,1,family);assert.equal(ids.filter(id=>RELICS[id].kind==='passive').length,3);
 const g=fresh(ids[0]);for(const id of ids.slice(1)){g.pendingReward=[id];assert.ok(g.choose(id));}assert.equal(g.familyCount(family),4);assert.equal(g.loadout().length,4);check(g);
}
assert.equal(Object.values(RELICS).filter(r=>r.kind==='active').length,4);
// Only one active slot: replacement never charges a free use or alters passive levels.
{
 const g=fresh('feather');g.charge=0;g.relics.ukulele=1;
 for(const id of ['capacitor','shield','blackhole','feather']){g.pendingReward=[id];assert.ok(g.choose(id));assert.equal(g.equipment,id);assert.equal(g.charge,0);assert.equal(g.relics.ukulele,1);assert.equal(g.loadout().filter(x=>RELICS[x.id].kind==='active').length,1);check(g);}
}
// Reach uses the same charges as every other active; invalid targets spend nothing; Undo restores it.
{
 const g=fresh('feather'),target=g.featherTargets()[0];assert.ok(target);const before=g.toSave();assert.equal(g.activate(-1).ok,false);assert.deepEqual(g.toSave(),before);
 assert.ok(g.activate(target.id).ok);assert.equal(g.charge,0);assert.equal(g.featherCharge,0);assert.equal(g.tiles[target.id].zone,'rack');check(g);
 assert.ok(g.use('undo'));assert.equal(g.charge,1);assert.equal(g.tiles[target.id].zone,'board');check(g);
}
// Viper fires only on demand, prefers covered board triples, chains, and respects boss budgets.
{
 const g=fresh('capacitor');flat(g);for(const i of [0,1,2])g.tiles[i].z=1;for(const i of [6,7,8]){g.tiles[i].x=g.tiles[i-6].x;g.tiles[i].y=g.tiles[i-6].y;g.tiles[i].z=2;}
 const target=g.findProcTarget('capacitor',1);assert.ok(target.some(id=>g.blockers(g.tiles[id]).length));
 const out=g.activate();assert.ok(out.ok);assert.equal(out.events[0].kind,'capacitor');assert.equal(g.charge,0);assert.equal(g.cleared,3);check(g);
 assert.equal(g.activate().ok,false);
 const h=fresh('capacitor');flat(h);for(const id of [0,1,2])h.pick(id);assert.equal(h.cleared,3);assert.equal(h.charge,1);assert.equal(h.capacitorCharge,0);check(h);
 const noTarget=fresh('capacitor');noTarget.trial={kind:'echo',types:[],broken:[],lastType:null,open:false};assert.equal(noTarget.canActivate(),false);assert.equal(noTarget.activate().ok,false);assert.equal(noTarget.charge,1);
 const chain=fresh('capacitor');flat(chain);chain.relics.behemoth=1;chain.blastCharge=3;const r=chain.activate();assert.ok(r.events.some(e=>e.kind==='behemoth'));assert.ok(chain.cleared>=6);check(chain);
}
// Turtle must be armed; a rescue consumes the guard, cannot be undone, and persists across save/reload.
{
 const unarmed=fresh('shield');flat(unarmed,[0,6,12,18,24,30]);unarmed.pick(1);assert.equal(unarmed.status,'lost');check(unarmed);
 const g=fresh('shield');flat(g,[0,6,12,18,24,30]);assert.ok(g.activate().ok);assert.equal(g.shieldArmed,true);assert.equal(g.charge,0);assert.equal(g.activate().ok,false);check(g);
 const resumed=Expedition.fromSave(g.toSave());const result=resumed.pick(1);assert.ok(result.events.some(e=>e.kind==='shield'));assert.equal(resumed.status,'playing');assert.equal(resumed.rack.length,6);assert.equal(resumed.shieldArmed,false);assert.equal(resumed.previous,null);assert.equal(resumed.charge,0);check(resumed);
 resumed.charge=1;assert.ok(resumed.activate().ok);resumed.pendingReward=['feather'];assert.ok(resumed.choose('feather'));assert.equal(resumed.shieldArmed,false);check(resumed);
}
// Owlet is passive and begins scouting only after four manual triples at level one.
{
 const g=fresh('radar');assert.equal(g.equipment,null);assert.equal(g.canActivate(),false);const ids=[...g.solution];
 for(let i=0;g.manualMatches<4;i++){const r=g.pick(ids[i]);assert.ok(r.ok);if(g.manualMatches<4)assert.equal(g.radarActive,false);}
 assert.equal(g.radarActive,true);assert.equal(g.radarCharge,0);assert.equal(g.previewIds().length,4);assert.equal(g.radarUntil-g.moves,4);check(g);
 assert.ok(g.use('undo'));assert.equal(g.radarActive,false);assert.equal(g.radarCharge,3);check(g);
}
// Six passives plus an active, including former active Owlet, remains serializable and rankable.
{
 const g=fresh('feather');for(const id of ['radar','seeker','echo','cell','turbine','recycler']){g.pendingReward=[id];assert.ok(g.choose(id));}check(g);assert.equal(g.loadout().length,7);assert.ok(LB.validLoadout(g.loadout(),2));
 g.pendingReward=['ukulele'];assert.equal(g.choose('ukulele'),false);assert.ok(g.choose('ukulele','radar'));assert.equal(g.relics.feather,1);check(g);
}
// Every boss seals and restores a valid four-family loadout under the new classification.
for(const stage of [10,20,30,40,50,60,70,80,90,100])for(const active of ['feather','capacitor','shield','blackhole']){
 const g=fresh(active),before=stage-1,b=new (require('../critter-cascade/core.js').Game)('rain',seed(stage),stageSpec(before));
 for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];g.stage=before;g.banked=bankedBefore(before);g.relics={[active]:3,radar:2,cell:2};g.equipment=active;
 g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';assert.ok(g.nextStage());assert.equal(g.equipment,null);assert.deepEqual(g.relics,{});check(g);
 const events=[];while(Object.keys(g.sealed).length)g.reclaim(events);assert.equal(g.equipment,active);assert.equal(g.relics[active],3);check(g);
}
// Historical checkpoints retain their exact loadout, old dual-skill controls and independent charge.
{
 const old=fresh('feather');old.companionRules=1;old.relics={feather:1,shield:1,capacitor:1,radar:1};old.equipment='radar';old.charge=1;old.featherCharge=1;
 const data=old.toSave();delete data.companionRules;delete data.shieldArmed;delete data.radarCharge;
 const g=Expedition.fromSave(data);assert.equal(g.companionRules,1);assert.deepEqual(g.relics,old.relics);assert.equal(g.definitions.feather.kind,'passive');assert.ok(g.activate().ok);assert.equal(g.radarActive,true);assert.equal(g.featherCharge,1);check(g);
 assert.match(Copy.profile('radar',1,g,'en').effect,/Activate/);assert.match(Copy.profile('radar',1,{companionRules:2},'en').effect,/automatically/);
}
// Narrative says click only for actives, and automatic for the changed passive.
for(const lang of ['zh','en']){
 const modern={companionRules:2};assert.match(Copy.profile('shield',1,modern,lang).effect,lang==='zh'?/点击/:/Activate/);assert.match(Copy.profile('capacitor',1,modern,lang).effect,lang==='zh'?/点击/:/Activate/);assert.match(Copy.profile('radar',1,modern,lang).effect,lang==='zh'?/自动/:/automatically/);
}
console.log('PASS: four balanced families, active replacement, shared Reach charges/Undo, manual piercing/chains/boss limits, armed guard, passive scouting, 6+1 saves, all bosses, legacy saves and bilingual descriptions.');
// Ten-stage snapshots and finalized receipts accept the new six-passive roster.
{
 const g=fresh('blackhole'),b=new (require('../critter-cascade/core.js').Game)('rain',seed(88),stageSpec(10));
 for(const k of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[k]=b[k];
 g.stage=10;g.banked=bankedBefore(10);g.relics={blackhole:3,radar:3,ukulele:3,gasoline:3,prism:3,cell:3,turbine:3};
 g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';check(g);
 const record={schema:3,savedAt:Date.now(),runId:'12345678-1234-4123-8123-123456789abc',elapsedMs:10000,timerStarted:true,finalized:false,stageRewardClaimed:false,playerDraft:'player',tenTime:10000,tenRecord:{runId:'12345678-1234-4123-8123-123456789abd',elapsedMs:10000,cleared:g.recovered,loadout:g.loadout(),playerId:null,receipt:null},game:g.toSave(),receipt:null,submissionPayload:null};
 assert.ok(Save.valid(record));assert.deepEqual(Save.parse(JSON.stringify(record)),record);
 g.end();record.finalized=true;record.game=g.toSave();record.submissionPayload={runId:record.runId,playerId:'player',mode:'expedition',rules:3,companionRules:2,stage:10,completedStages:10,cleared:g.recovered,elapsedMs:10000,tenMs:10000,loadout:g.loadout()};assert.ok(Save.valid(record));
 const calls=[];const lb=new LB.Leaderboard({supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_test'},async(url,options)=>{calls.push(url);return {ok:true,json:async()=>({ok:true,rank:1,speedRank:1,improved:true,playerId:JSON.parse(options.body).p_player_id})};});
 (async()=>{assert.ok((await lb.submit(record.submissionPayload)).ok);assert.match(calls[0],/critter_submit_expedition_v4$/);
 const legacy={...record.submissionPayload,companionRules:1,loadout:[{id:'feather',level:3},{id:'radar',level:3}]};assert.ok((await lb.submit(legacy)).ok);assert.match(calls[1],/rain_submit_expedition_v3$/);assert.equal((await lb.submit({...legacy,companionRules:2,loadout:[{id:'feather',level:3},{id:'shield',level:3}]})).ok,false);assert.equal(calls.length,2);console.log('PASS: new ten-stage/finalized checkpoint and strict old/new submission routing.');})().catch(e=>{console.error(e);process.exitCode=1;});
}
