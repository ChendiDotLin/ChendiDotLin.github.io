'use strict';
const assert = require('node:assert/strict');
const { Leaderboard, validId, normalizeId, compare } = require('../yang/leaderboard.js');
const { messages } = require('../yang/i18n.js');
(async () => {
 assert.deepEqual(Object.keys(messages.zh).sort(), Object.keys(messages.en).sort());
 for (const id of ['幸存者_1', 'Player-42', 'a']) assert.ok(validId(id));
 for (const id of ['', 'a b', '<script>', 'a'.repeat(21), 'x\n']) assert.equal(validId(id), false);
 assert.equal(normalizeId('  ＡＢＣ  '), 'ABC');
 const scores=[{cleared:3,elapsedMs:1,createdAt:1,playerId:'a'},{cleared:6,elapsedMs:9999,createdAt:1,playerId:'b'},{cleared:6,elapsedMs:10,createdAt:1,playerId:'c'}];
 assert.deepEqual(scores.sort(compare).map(row=>row.playerId),['c','b','a']);
 const missing = new Leaderboard();
 assert.equal((await missing.submit({runId:'x',playerId:'A',mode:'rain',cleared:3,elapsedMs:500})).error,'notConfigured');
 const config={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'};
 let call;
 const client = new Leaderboard(config, async (url,options)=>{
  call={url,...options};return {ok:true,json:async()=>({ok:true,improved:true,rank:1,playerId:'玩家'})};
 });
 assert.equal((await client.submit({runId:'run',playerId:'玩家',mode:'rain',cleared:6,elapsedMs:1000})).rank,1);
 assert.ok(call.url.endsWith('/rpc/rain_submit_score'));
 assert.equal(call.headers.apikey,config.supabasePublishableKey);assert.equal(call.headers.Authorization,undefined);
 assert.equal(JSON.parse(call.body).p_elapsed_ms,1000);
 for (const bad of [{mode:'fake'},{cleared:109},{cleared:-3},{cleared:5},{elapsedMs:-1},{elapsedMs:Infinity}]) {
  assert.equal((await client.submit({runId:'r',playerId:'a',mode:'rain',cleared:6,elapsedMs:1000,...bad})).ok,false);
 }
 const failed = new Leaderboard(config, async()=>{throw Error('offline')});
 assert.equal((await failed.submit({runId:'r',playerId:'a',mode:'rain',cleared:6,elapsedMs:10})).error,'networkError');
 const malformed = new Leaderboard(config,async()=>({ok:true,json:async()=>({entries:[{playerId:'<img>'}],total:1})}));
 await assert.rejects(()=>malformed.list('rain'),/networkError/);
 const secret = new Leaderboard({...config,supabasePublishableKey:'sb_secret_nope'});assert.equal(secret.configured,false);
 console.log('PASS: language parity, player IDs, score ordering, RPC requests, validation, failed requests, malformed responses, and missing configuration.');
})().catch(error=>{console.error(error);process.exit(1)});
