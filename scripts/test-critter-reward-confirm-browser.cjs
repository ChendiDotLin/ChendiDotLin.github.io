'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 await page.route('**/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  function render(enter = false) {','  window.rewardTest={game:()=>game,render:()=>render(),offer:()=>showExpeditionReward()};\n  function render(enter = false) {')});});
 const url=new URL(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');url.searchParams.set('mode','expedition');await page.goto(url.href);
 const gear=()=>page.evaluate(()=>rewardTest.game().relics);
 assert.ok(await page.locator('#reward-confirm').isDisabled());
 await page.locator('[data-reward=ukulele]').click();await page.locator('[data-reward=ukulele]').click();assert.deepEqual(await gear(),{});
 await page.locator('[data-reward=feather]').click();assert.equal(await page.locator('[data-reward=feather]').getAttribute('aria-pressed'),'true');assert.deepEqual(await gear(),{});
 await page.locator('#modal-language').click();assert.equal(await page.locator('[data-reward=feather]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#reward-confirm').innerText(),/Confirm/);
 await page.locator('#modal-language').click();await page.locator('#reward-confirm').click();assert.deepEqual(await gear(),{feather:1});
 let offers=0;
 for(let stage=1;stage<=6;stage++){
  // Play the complete constructive solution; any unsolicited reward breaks the run.
  await page.evaluate(()=>{const g=rewardTest.game();for(const id of g.solution){const result=g.pick(id);if(!result.ok||g.pendingReward)throw Error('Unexpected reward during stage');}rewardTest.render();});
  assert.equal(await page.evaluate(()=>rewardTest.game().status),'won');await page.locator('#expedition-continue').click();
  if(stage%2===0){
   assert.match(await page.locator('#stage-next').innerText(),/补给/);await page.locator('#stage-next').click();offers++;
   assert.ok(await page.locator('#reward-confirm').isDisabled());
   const pending=await page.evaluate(()=>rewardTest.game().pendingReward);
   if(stage===2){
    await page.locator('[data-reward]').first().click();assert.deepEqual(await gear(),{feather:1});await page.reload();await page.locator('#resume-confirm').click();await page.waitForFunction(()=>rewardTest.game().mode==='expedition');
    assert.deepEqual(await page.evaluate(()=>rewardTest.game().pendingReward),pending);assert.ok(await page.locator('#reward-confirm').isDisabled());
   }
   await page.locator('#reward-skip').click();assert.match(await page.locator('#stage-next').innerText(),/下一关/);
   if(stage===4){await page.reload();await page.locator('#resume-confirm').click();await page.waitForFunction(()=>rewardTest.game().mode==='expedition');assert.match(await page.locator('#stage-next').innerText(),/下一关/);assert.equal(await page.locator('#reward-confirm').count(),0);}
  }else assert.match(await page.locator('#stage-next').innerText(),/下一关/);
  await page.locator('#stage-next').click();await page.waitForFunction(n=>rewardTest.game().stage===n&&!document.querySelector('.fx-layer > *'),stage+1);
 }
 assert.equal(offers,3);assert.deepEqual(await gear(),{feather:1});
 // A replacement is not applied by selecting either the incoming or outgoing card.
 await page.evaluate(()=>{const g=rewardTest.game();g.relics={feather:2,seeker:2,ukulele:2,gasoline:2,clover:1,prism:1,radar:2};g.equipment='feather';g.pendingReward=['behemoth','blackhole'];rewardTest.offer();});
 const original=await gear();await page.locator('[data-reward=behemoth]').click();assert.deepEqual(await gear(),original);await page.locator('#reward-confirm').click();
 assert.ok(await page.locator('#replacement-confirm').isDisabled());await page.locator('[data-replace=ukulele]').click();await page.locator('[data-replace=seeker]').click();assert.deepEqual(await gear(),original);
 await page.locator('#modal-language').click();assert.equal(await page.locator('[data-replace=seeker]').getAttribute('aria-pressed'),'true');
 for(const width of [320,390,1366]){await page.setViewportSize({width,height:844});assert.ok(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/critter-confirm-replacement.png'});
 await page.locator('#reward-back').click();assert.deepEqual(await gear(),original);await page.locator('[data-reward=blackhole]').click();await page.locator('#reward-confirm').click();await page.locator('[data-replace=feather]').click();assert.deepEqual(await gear(),original);
 await page.locator('#replacement-confirm').click();assert.equal(await page.evaluate(()=>rewardTest.game().equipment),'blackhole');assert.equal((await gear()).blackhole,1);assert.equal((await gear()).feather,undefined);
 // Legacy pending rewards still load and require explicit confirmation.
 await page.evaluate(()=>{const g=rewardTest.game();g.pendingReward=['ukulele'];rewardTest.render();});await page.reload();await page.locator('#resume-confirm').click();await page.waitForFunction(()=>rewardTest.game().mode==='expedition');
 assert.ok(await page.locator('#reward-confirm').isDisabled());await page.locator('[data-reward=ukulele]').click();assert.equal((await gear()).ukulele,2);await page.locator('#reward-confirm').click();assert.equal((await gear()).ukulele,3);
 assert.deepEqual(errors,[]);console.log('PASS: select/change/double tap never commits; explicit starter/upgrade/active replacement confirmation; bilingual mobile layout; supplies only after stages 2/4/6; pending and skipped offers survive reload without duplication; legacy pending rewards honored.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
