'use strict';
const vm=require('node:vm'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
const source=readFileSync('critter-cascade/analytics.js','utf8'),config=readFileSync('_config.yml','utf8').match(/^gtag:\s*"([^"]+)"/m)[1];
function run(host,protocol='https:') {
 const scripts=[],window={},context={window,location:{hostname:host,protocol,origin:protocol+'//'+host,pathname:'/critter-cascade/',search:'?private=test',hash:'#ignored'},document:{createElement:()=>({}),head:{append:s=>scripts.push(s)}}};
 vm.runInNewContext(source,context);vm.runInNewContext(source,context);return{window,scripts};
}
for(const host of ['127.0.0.1','localhost','example.com']) assert.equal(run(host).scripts.length,0);
assert.equal(run('chendilin.com','http:').scripts.length,0);
const {window,scripts}=run('chendilin.com');assert.equal(scripts.length,1);assert.ok(scripts[0].async);assert.ok(scripts[0].src.endsWith('id='+config));
const commands=window.dataLayer.map(x=>Array.from(x));assert.equal(commands.length,2);assert.equal(commands[1][0],'config');assert.equal(commands[1][1],config);
assert.equal(commands[1][2].page_location,'https://chendilin.com/critter-cascade/');assert.equal(commands[1][2].page_title,'Critter Cascade');assert.equal(commands[1][2].user_id,undefined);
assert.equal(run('www.chendilin.com').scripts.length,1);
console.log('PASS: GA4 matches homepage measurement ID, initializes once, excludes preview hosts and page query/hash, no player IDs.');
