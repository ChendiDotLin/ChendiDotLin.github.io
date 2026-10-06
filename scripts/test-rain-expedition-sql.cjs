'use strict';
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite(), admin = 'cf51ed16-ab31-41a7-8134-154688dfca14';
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.query('insert into auth.users values ($1)', [admin]);
  // Upgrade the pre-expedition deployment, including real previous-mode data.
  await db.exec(readFileSync(join(__dirname, 'fixtures/rain-admin-before-expedition.sql'), 'utf8'));
  await db.query("select public.rain_submit_score($1,'previous','rain',108,8000)", [randomUUID()]);
  const migration = readFileSync(join(__dirname, 'rain-expedition.sql'), 'utf8');
  await db.exec(migration); await db.exec(migration);
  await db.exec('set role anon');
  const list = async () => (await db.query('select public.rain_expedition_leaderboard() result')).rows[0].result;
  const submit = async (id, score, time, stage, loadout, run = randomUUID()) =>
    (await db.query('select public.rain_submit_expedition($1,$2,$3,$4,$5,$6) result', [run,id,score,time,stage,JSON.stringify(loadout)])).rows[0].result;
  const loadout = [{id:'feather',level:2},{id:'blackhole',level:1}];
  await submit('slow', 252, 12000, 4, loadout); await submit('fast', 252, 10000, 4, loadout);
  const run = randomUUID(), once = await submit('highest', 300, 15000, 5, loadout, run);
  assert.deepEqual(await submit('highest',300,15000,5,loadout,run), once);
  assert.deepEqual((await list()).entries.map(x=>x.playerId), ['highest','fast','slow']);
  assert.equal((await list()).entries[0].stage, 5); assert.deepEqual((await list()).entries[0].loadout, loadout);
  await submit('highest', 297, 900, 5, [{id:'shield',level:1}]); assert.deepEqual((await list()).entries[0].loadout, loadout);
  await assert.rejects(()=>submit('highest',300,15000,6,loadout,run), /Run already submitted/);
  await assert.rejects(()=>submit('highest',300,15000,5,[{id:'shield',level:1}],run), /Run already submitted/);
  for (const args of [[3,100,0,loadout],[999,100,1,loadout],[3,100,1,[]],[3,100,1,[{id:'fake',level:1}]],
    [3,100,1,[{id:'feather',level:4}]],[3,100,1,[{id:'feather',level:'1'}]],
    [3,100,1,[{id:'radar',level:1},{id:'blackhole',level:1}]]]) await assert.rejects(()=>submit('bad', ...args),/Invalid/);
  await assert.rejects(()=>db.query('select * from rain_private.scores'), /permission denied/);
  await assert.rejects(()=>db.query("select public.rain_admin_delete('mode','expedition',null,'CLEAR expedition')"), /permission denied/);
  await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]); await db.exec('set role authenticated');
  assert.equal((await db.query('select public.rain_admin_status() result')).rows[0].result.counts.expedition,3);
  assert.equal((await db.query("select public.rain_admin_delete('mode','expedition',null,'CLEAR expedition') result")).rows[0].result.deleted,3);
  assert.equal((await list()).total,0);
  assert.equal((await db.query("select public.rain_leaderboard('rain') result")).rows[0].result.entries[0].playerId,'previous');
  await assert.rejects(()=>submit('highest',300,15000,5,loadout,run), /Run removed/);
  await submit('highest',300,15000,5,loadout);
  console.log('PASS: old-schema upgrade twice preserves scores; expedition sorting, metadata, best-only, retries, validation, admin scope, and revoked-run protection.');
  await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
