'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));
 await page.route('**/rest/v1/rpc/*',r=>{requests.push({url:r.request().url(),data:r.request().postDataJSON()});return r.fulfill({json:r.request().url().includes('submit')?{ok:true,rank:1,improved:true,playerId:'test'}:{entries:[],total:0}});});
 await page.route('**/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  function render(enter = false) {','  window.gameProbe=()=>game;window.rewardProbe=()=>showExpeditionReward();\n  function render(enter = false) {')});});
 const url=new URL(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');
 await page.goto(url.href);await page.locator('[data-welcome-mode=eclipse]:enabled').waitFor();
 await page.locator('[data-welcome-mode=eclipse]').click();await page.locator('#eclipse-start').click();
 assert.equal(await page.locator('#board .tile').count(),180);assert.equal(await page.locator('#leaderboard-title').innerText(),'蚀夜排行榜');assert.ok(await page.locator('#eclipse-status').isVisible());
 await page.waitForTimeout(700);assert.equal(await page.locator('#timer').innerText(),'00:00');assert.equal(await page.evaluate(()=>gameProbe().pressure.started),false);
 for(const width of [320,390,1366]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`layout ${width}`);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/critter-eclipse-phone.png',fullPage:true});
 await page.locator('#board button:enabled').first().click();await page.waitForFunction(()=>gameProbe().pressure.remaining<7800);
 await page.locator('#pressure-pause').click();const pause=await page.evaluate(()=>structuredClone(gameProbe().pressure));await page.waitForTimeout(600);assert.deepEqual(await page.evaluate(()=>gameProbe().pressure),pause);
 await page.locator('#pressure-resume').click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const bg=await page.evaluate(()=>gameProbe().pressure.remaining);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>gameProbe().pressure.remaining),bg);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));gameProbe().advanceEnvironment(6000);});
 await page.waitForFunction(()=>document.querySelectorAll('.memory-hidden').length>0);assert.ok(await page.locator('.memory-hidden').count()<=5);
 const hidden=page.locator('.memory-hidden').first();assert.equal(await hidden.getAttribute('title'),'迷雾牌（可点击，凭记忆选择）');
 await page.evaluate(()=>{gameProbe().pressure.remaining=50;});await page.waitForFunction(()=>gameProbe().pressure.hearts===2);
 await page.locator('#undo').click();assert.equal(await page.evaluate(()=>gameProbe().pressure.hearts),2);
 await page.evaluate(()=>{gameProbe().pressure.hearts=1;gameProbe().pressure.remaining=50;});await page.waitForFunction(()=>gameProbe().status==='lost');await page.locator('#score-form').waitFor();assert.match(await page.locator('#modal-title').innerText(),/追猎失败/);assert.match(await page.locator('#modal-content').innerText(),/本次蚀夜挑战结束/);
 assert.equal(await page.locator('[data-rescue]').count(),0);await page.locator('#player-id').fill('test');await page.locator('#score-form button').click();await page.locator('#save-feedback').waitFor();
 assert.ok(requests.some(r=>r.url.endsWith('/critter_eclipse_leaderboard')));assert.ok(requests.some(r=>r.url.endsWith('/critter_submit_eclipse')&&r.data.p_player_id==='test'&&!('p_mode' in r.data)));
 await page.locator('#close-modal').click();await page.locator('[data-mode=monsoon]').click();await page.locator('#board button:enabled').first().waitFor();assert.equal(await page.locator('#eclipse-status').isVisible(),false);assert.equal(await page.locator('#pressure-status').isVisible(),false);
 // Passive replacement must show actual current-level abilities before mutation.
 url.searchParams.set('mode','expedition');await page.goto(url.href);await page.locator('[data-reward=feather]').click();await page.locator('#reward-confirm').click();
 await page.evaluate(()=>{const g=gameProbe();Object.assign(g,{relics:{feather:2,ukulele:3,shield:1,gasoline:2,clover:1,prism:1,radar:2},equipment:'radar',pendingReward:['behemoth','blackhole','recharge']});rewardProbe();});
 await page.locator('[data-reward=behemoth]').click();await page.locator('#reward-confirm').click();assert.equal(await page.locator('[data-replace]').count(),6);
 for(const id of ['feather','ukulele','shield','gasoline','clover','prism']) {
  const expected=await page.evaluate(id=>ClackCompanions.profile(id,gameProbe().relics[id],gameProbe(),'zh'),id);
  const text=await page.locator(`[data-replace=${id}]`).innerText();assert.ok(text.includes(expected.effect));assert.ok(text.includes(expected.rules));
 }
 assert.equal(await page.evaluate(()=>gameProbe().relics.behemoth),undefined);
 await page.screenshot({path:'/tmp/critter-replacement-phone.png',fullPage:true});
 await page.locator('#modal-language').click();
 for (const width of [320,390,1366]) {await page.setViewportSize({width,height:844});assert.ok(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 assert.match(await page.locator('.replacement-incoming').innerText(),/Level 1/);
 await page.locator('#reward-back').click();await page.locator('[data-reward=blackhole]').click();await page.locator('#reward-confirm').click();assert.equal(await page.locator('[data-replace]').count(),1);assert.equal(await page.evaluate(()=>gameProbe().equipment),'radar');
 await page.locator('[data-replace=radar]').click();await page.locator('#replacement-confirm').click();assert.equal(await page.evaluate(()=>gameProbe().equipment),'blackhole');assert.equal(await page.evaluate(()=>gameProbe().relics.blackhole),1);assert.equal(await page.evaluate(()=>gameProbe().relics.radar),undefined);
 await page.evaluate(()=>{gameProbe().pendingReward=['behemoth','recharge'];rewardProbe();});await page.locator('[data-reward=behemoth]').click();await page.locator('#reward-confirm').click();await page.locator('[data-replace=shield]').click();await page.locator('#replacement-confirm').click();
 assert.equal(await page.evaluate(()=>gameProbe().relics.behemoth),1);assert.equal(await page.evaluate(()=>gameProbe().relics.shield),undefined);assert.equal(await page.evaluate(()=>gameProbe().relics.ukulele),3);
 await page.evaluate(()=>{gameProbe().pendingReward=['resin','recharge'];rewardProbe();});await page.locator('[data-reward=resin]').click();await page.locator('#reward-confirm').click();await page.locator('#reward-skip').click();assert.equal(await page.evaluate(()=>gameProbe().relics.resin),undefined);
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem(RainSave.KEY)));
 await page.locator('[data-mode=eclipse]').click();await page.locator('#eclipse-start').click();await page.waitForTimeout(400);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem(RainSave.KEY)));assert.deepEqual(after.game,save.game);assert.equal(after.runId,save.runId);
 assert.deepEqual(errors,[]);console.log('PASS: Eclipse entry/HUD/mobile layouts, first-pick clocks, real timeout, pause/background, fog, irreversible defeat, dedicated score RPCs; full-level passive/active comparisons, language, back, skip and safe replacement.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
