'use strict';
const assert=require('node:assert/strict');
const {Expedition,RELICS}=require('../clackworks/expedition.js');
const seed=n=>()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296;};
const fresh=()=>{const g=new Expedition(seed(319));g.choose('feather');return g;};
function sample(stage,saturated=false,noEquipment=false){
 const g=fresh();g.stage=stage;g.relics={behemoth:4,clover:4,echo:4,blackhole:1};g.equipment='blackhole';
 if(stage<21)g.relics={blackhole:1};
 if(saturated)for(const id of ['prism','shield','gasoline'])g.relics[id]=5;
 if(noEquipment){delete g.relics.blackhole;g.equipment=null;}
 let offers=0;const counts={},trials=12000;
 const red=id=>RELICS[id]&&g.relics[id]===4;
 for(let n=0;n<trials;n++){
  g.pendingReward=null;g.offerReward();const choices=g.pendingReward;
  assert.ok(choices.length>=1&&choices.length<=3);assert.equal(new Set(choices).size,choices.length);
  assert.ok(choices.filter(red).length<=1);
  assert.ok(choices.every(id=>!RELICS[id]||(g.relics[id]||0)<g.levelCap));
  if(noEquipment){assert.ok(choices.includes('blackhole'));assert.ok(choices.includes('radar'));}
  offers+=Number(choices.some(red));choices.forEach(id=>counts[id]=(counts[id]||0)+1);
 }
 const rate=offers/trials;assert.ok(Math.abs(rate-g.legendaryChance)<.012,`red rate ${rate}`);
 if(stage>=21)assert.ok(Math.abs(counts.behemoth/offers-60/145)<.035);
 return rate;
}
assert.equal(sample(3),0);assert.equal(sample(11),0);const rate=sample(21);sample(21,true);sample(21,false,true);
for(const [roll,expected]of[[.249999,true],[.25,false]]){
 const g=fresh();g.stage=21;g.relics={behemoth:4,blackhole:1};g.equipment='blackhole';g.random=()=>roll;g.offerReward();assert.equal(g.pendingReward.includes('behemoth'),expected);
}
for(let n=1;n<=100;n++){
 const g=fresh();g.rngState=n*19773;const replay=Expedition.fromSave(g.toSave());g.offerReward();replay.offerReward();assert.deepEqual(replay.pendingReward,g.pendingReward);assert.equal(replay.rngState,g.rngState);
 const choices=[...g.pendingReward],rng=g.rngState;g.offerReward();assert.deepEqual(g.pendingReward,choices);assert.equal(g.rngState,rng);assert.deepEqual(Expedition.fromSave(g.toSave()).pendingReward,choices);
}
console.log(`PASS: 60,000 supplies; no red before stage 21, ${(rate*100).toFixed(1)}% mythic offers afterwards, one red slot, weighted upgrades, capped-pool protection, active access and deterministic saves.`);
