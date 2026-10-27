'use strict';
const {PGlite}=require(process.argv[2]||'@electric-sql/pglite'),{readFileSync}=require('node:fs'),{join}=require('node:path'),{randomUUID}=require('node:crypto'),assert=require('node:assert/strict');
const {bankedBefore}=require('../critter-cascade/expedition.js');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.query('insert into auth.users values ($1)',['cf51ed16-ab31-41a7-8134-154688dfca14']);
 for(const file of ['fixtures/rain-admin-before-expedition.sql','rain-expedition.sql','rain-expedition-boss.sql','clackworks-companions.sql','critter-eclipse.sql','critter-beta-leaderboard.sql','critter-restore-classic-leaderboards.sql'])await db.exec(readFileSync(join(__dirname,file),'utf8'));
 const old=[{id:'feather',level:3},{id:'shield',level:3},{id:'capacitor',level:3},{id:'radar',level:3}];
 const submit=async(fn,id,gear,run=randomUUID(),time=10000)=>(await db.query(`select public.${fn}($1,$2,$3,$4,31,30,5000,$5) r`,[run,id,bankedBefore(31),time,JSON.stringify(gear)])).rows[0].r;
 await submit('rain_submit_expedition_v3','legacy',old);
 const migration=readFileSync(join(__dirname,'critter-active-companions.sql'),'utf8');await db.exec(migration);await db.exec(migration);
 await db.exec('set role anon');
 for(const active of ['feather','capacitor','shield','blackhole']){
  const gear=[active,'radar','ukulele','gasoline','prism','cell','turbine'].map(id=>({id,level:5})),run=randomUUID();
  const r=await submit('critter_submit_expedition_v4',active,gear,run);assert.ok(r.ok);assert.deepEqual(await submit('critter_submit_expedition_v4',active,gear,run),r);
  await assert.rejects(()=>submit('critter_submit_expedition_v4',active,gear,run,11000),/Run already/);
 }
 assert.ok((await submit('rain_submit_expedition_v3','legacy2',old)).ok,'old RPC remains unchanged');
 for(const gear of [old,[{id:'feather',level:1},{id:'shield',level:1}],['ukulele','gasoline','resin','radar','seeker','echo','prism'].map(id=>({id,level:1})),[{id:'radar',level:6}],[{id:'fake',level:1}]])await assert.rejects(()=>submit('critter_submit_expedition_v4','invalid',gear),/Invalid/);
 const board=(await db.query("select public.rain_expedition_v3_leaderboard('distance') r")).rows[0].r;assert.equal(board.total,6);assert.ok(board.entries.some(x=>x.playerId==='legacy'));
 await assert.rejects(()=>db.query('select * from rain_private.scores'),/permission denied/);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",['cf51ed16-ab31-41a7-8134-154688dfca14']);await db.exec('set role authenticated');
 await db.query("select public.rain_admin_delete('player','expedition_distance','shield','DELETE shield')");
 assert.equal((await db.query("select public.rain_expedition_v3_leaderboard('distance') r")).rows[0].r.total,5);
 console.log('PASS: repeatable migration, four active types with six passives, old submissions preserved, shared rankings, invalid loadouts rejected, retries, private table access and admin controls.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
