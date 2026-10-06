// Optional: serve the repo on localhost:8765, install Playwright, then run this file.
// RAIN_PLAYWRIGHT, RAIN_BROWSER_PATH and RAIN_GAME_URL can override local test tools.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const fs = require('node:fs'); const assert = require('node:assert/strict');
const URL = process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/rain_match/';
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
 try {
 const context = await browser.newContext({ viewport: {width:1366,height:1000}, reducedMotion:'reduce' });
 await context.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
 const errors=[], submissions=[]; let failSubmit=true;
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/expedition.js*',async r=>{
   const body=fs.readFileSync(require('node:path').join(__dirname, '../rain_match/expedition.js'),'utf8')+`\nconst Base=RainExpedition.Expedition; RainExpedition.Expedition=class extends Base { constructor(){let n=16; super(()=>{n=Math.imul(n,1664525)+1013904223|0;return(n>>>0)/4294967296}); window.testGame=this;} static fromSave(data){const game=Base.fromSave(data);window.testGame=game;return game;} };`;
   await r.fulfill({contentType:'text/javascript',body});
 });
 await context.route('**/rest/v1/rpc/*',async r=>{
   const data=r.request().postDataJSON();
   if(r.request().url().includes('submit')) { submissions.push(data); if(failSubmit)return r.fulfill({status:503,json:{message:'test offline'}}); return r.fulfill({json:{ok:true,improved:true,rank:1,playerId:data.p_player_id}}); }
   return r.fulfill({json:{entries:[],total:0}});
 });
 const page=await context.newPage(); await page.goto(URL+'?mode=expedition');
 await page.locator('[data-reward=feather]').click();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(RainSave.KEY)));
 assert.equal((await saved()).game.relics.feather,1);
 assert.match(await page.locator('#expedition-save-status').textContent(),/已自动保存/);
 const solution=await page.evaluate(()=>testGame.solution); let cursor=0;
 while(!(await saved()).game.pendingReward) await page.locator(`#board [data-id="${solution[cursor++]}"]`).click();
 const before=await saved(); assert.equal(before.game.stageMatches,3);
 await page.reload();await page.locator('#resume-confirm').click();
 assert.deepEqual((await saved()).game,before.game);assert.equal((await saved()).runId,before.runId);
 await page.locator('[data-reward=blackhole]').click();
 // Full first stage and reward checkpoint, then reload pending stage-clear supply.
 for(;cursor<solution.length;cursor++)await page.locator(`#board [data-id="${solution[cursor]}"]`).click();
 await page.locator('#stage-next').click();const stageReward=await saved();assert.equal(stageReward.stageRewardClaimed,true);
 await page.reload();await page.locator('#resume-confirm').click();assert.deepEqual((await saved()).game.pendingReward,stageReward.game.pendingReward);
 await page.locator('[data-reward]').first().click(); await page.locator('#stage-next').click();assert.equal((await saved()).game.stage,2);
 const stable=await saved(); await page.locator('#help').click();await page.waitForTimeout(1100);await page.reload();
 await page.waitForTimeout(1100);await page.locator('#resume-confirm').click();const resumed=await saved();
 assert.equal(resumed.runId,stable.runId); assert.deepEqual(resumed.game,stable.game);assert.ok(resumed.elapsedMs-stable.elapsedMs<1000);
 // Reload releases the lock; another live tab cannot acquire it.
 const other=await context.newPage();await other.goto(URL+'?mode=expedition');await other.locator('#resume-confirm').click();
 await other.locator('#save-lock-retry').waitFor();assert.match(await other.locator('#modal-title').textContent(),/另一页面/);
 await page.locator('[data-mode=rain]').click();await page.locator('#resume-banner').waitFor();
 await other.locator('#save-lock-retry').click();await other.waitForFunction(()=>window.testGame?.stage===2);assert.equal(await other.evaluate(()=>testGame.stage),2);
 await other.locator('[data-mode=rain]').click();await page.locator('#resume-expedition').click();await page.locator('#resume-confirm').click();
 const original=(await saved()).runId; await page.locator('#restart').click();await page.locator('#restart-cancel').click();assert.equal((await saved()).runId,original);
 // Mobile bilingual layout and pause/continue banner.
 await page.locator('#language').click();assert.match(await page.locator('#expedition-save-status').textContent(),/Autosaved/);
 await page.screenshot({path:'/tmp/rain-v2-desktop.png',fullPage:true});
 for(const width of [1024,768,390,320]) { await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);if(width===390)await page.screenshot({path:'/tmp/rain-v2-phone.png',fullPage:true}); }
 await page.setViewportSize({width:1366,height:1000});
 // Finalized failed request persists; a manual retry sends the identical payload.
 await page.locator('#expedition-extract').click();await page.locator('#extract-confirm').click();await page.locator('#player-id').fill('v2_mock');
 await page.locator('#score-form button').click();await page.waitForFunction(()=>document.querySelector('#score-error')?.textContent.length>0);
 const frozen=await saved();assert.ok(frozen.finalized);assert.ok(frozen.submissionPayload);assert.equal(submissions.length,1);
 await page.reload();await page.locator('#resume-confirm').click();assert.equal(await page.locator('#player-id').inputValue(),'v2_mock');assert.ok(await page.locator('#player-id').getAttribute('readonly')!==null);
 assert.equal(submissions.length,1);failSubmit=false;await page.locator('#score-form button').click();await page.locator('#save-feedback').waitFor();
 assert.deepEqual(submissions[1],submissions[0]);assert.ok((await saved()).receipt);
 await page.reload();await page.locator('#resume-confirm').click();await page.locator('#save-feedback').waitFor();assert.equal(submissions.length,2);
 await page.locator('[data-new-run]').click();await page.locator('[data-reward=feather]').click();assert.notEqual((await saved()).runId,original);
 await page.locator('#restart').click();await page.locator('#restart-confirm').click();await page.locator('[data-reward=ukulele]').click();
 assert.equal((await saved()).game.relics.ukulele,1);
 // Corrupt current checkpoint falls back to a valid backup without crashing.
 await page.locator('[data-mode=rain]').click();await page.evaluate(()=>localStorage.setItem(RainSave.KEY,'{broken'));
 await page.reload();await page.locator('#resume-confirm').waitFor();assert.match(await page.locator('#modal-content').textContent(),/backup|备份/);
 await page.locator('#resume-confirm').click();await page.waitForFunction(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)));assert.ok(await page.evaluate(()=>RainSave.valid(JSON.parse(localStorage.getItem(RainSave.KEY)))));
 // A browser that refuses persistence reports failure while still allowing play.
 const unavailable=await browser.newContext({reducedMotion:'reduce'});await unavailable.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 await unavailable.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}}));
 const blocked=await unavailable.newPage();blocked.on('pageerror',e=>errors.push(e.message));await blocked.goto(URL+'?mode=expedition');await blocked.locator('[data-reward=feather]').click();
 assert.match(await blocked.locator('#expedition-save-status').textContent(),/未能自动保存/);assert.ok(await blocked.locator('#board button:enabled').count());await unavailable.close();
 assert.deepEqual(errors,[]);console.log('PASS: real play, reward and stage checkpoints, refresh/resume, active time, multi-tab locks, classic-mode return, restart cancel/replace, bilingual 320–1366px layouts, frozen failed submission retry, receipt recovery, backup recovery and storage denial. All score writes mocked.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
