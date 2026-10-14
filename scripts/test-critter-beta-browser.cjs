'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let pending=false,delay=0;
 await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());
 await page.route('**/rest/v1/rpc/*',async r=>{
  const beta=r.request().url().endsWith('critter_beta_leaderboard'),body=r.request().postDataJSON(),mode=body.p_mode||(body.p_board?'expedition_'+body.p_board:'expedition');
  if(beta&&delay) await new Promise(done=>setTimeout(done,delay));
  if(beta&&pending)return r.fulfill({status:404,json:{code:'PGRST202'}});
  const entries=beta?[{playerId:'BetaPlayer',mode,cleared:36,elapsedMs:1000,createdAt:1,stage:10,completedStages:10,tenMs:1000,loadout:[{id:'feather',level:5}]}]:[];
  await r.fulfill({json:{entries,total:entries.length}});
 });
 await page.goto(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/?mode=expedition');await page.locator('[data-reward=ukulele]').click();
 const content=page.locator('#inline-ranking-content'),beta=page.locator('[data-ranking-period=beta]'),formal=page.locator('[data-ranking-period=formal]');
 await page.waitForFunction(()=>document.querySelector('#inline-ranking-content').getAttribute('aria-busy')==='false');assert.equal(await formal.getAttribute('aria-pressed'),'true');
 await beta.click();await page.locator('#ranking-rows tr').filter({hasText:'BetaPlayer'}).waitFor();
 for(const mode of ['drizzle','rain','monsoon']) {await page.locator(`[data-leaderboard-mode=${mode}]`).click();assert.equal(await page.locator('#ranking-period-tabs').isVisible(),false);}
 await page.locator('[data-leaderboard-mode=expedition]').click();await beta.click();await page.locator('#ranking-rows tr').filter({hasText:'BetaPlayer'}).waitFor();
 for(const mode of ['expedition_speed','expedition_legacy','expedition_distance']) {await page.locator(`[data-exp-board=${mode}]`).click();await page.locator('#ranking-rows tr').filter({hasText:'BetaPlayer'}).waitFor();}
 await formal.click();await page.waitForFunction(()=>document.querySelector('#inline-ranking-content').getAttribute('aria-busy')==='false');assert.ok(!(await content.innerText()).includes('BetaPlayer'));
 delay=400;await beta.click();await formal.click();await page.waitForTimeout(600);assert.ok(!(await content.innerText()).includes('BetaPlayer'),'stale beta response cannot overwrite formal');delay=0;
 pending=true;await beta.click();await page.getByText('内测榜迁移尚未完成，请稍后刷新。',{exact:true}).waitFor();pending=false;await page.locator('#refresh-rankings').click();await page.locator('#ranking-rows tr').filter({hasText:'BetaPlayer'}).waitFor();
 await page.locator('#language').click();assert.equal(await beta.innerText(),'Beta');assert.match(await page.locator('#ranking-period-note').innerText(),/Archived beta/);
 for(const width of [320,390,1366]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:390,height:950});await beta.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/critter-beta-phone.png'});assert.deepEqual(errors,[]);
 console.log('PASS: period and mode switching, response races, pending migration, bilingual labels and mobile layout. RPCs mocked; no real scores written.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
