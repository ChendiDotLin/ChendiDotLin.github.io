'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),errors=[];
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
await context.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await context.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));await context.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
await context.route('**/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  function render(enter = false) {','  window.clockProbe=()=>({elapsed,timerStarted,game,clockActive});\n  function render(enter = false) {')});});
const page=await context.newPage(),url=new URL(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');
const clock=()=>page.evaluate(()=>({elapsed:clockProbe().elapsed,started:clockProbe().timerStarted,moves:clockProbe().game.moves}));
for(const mode of ['drizzle','rain','monsoon']) {
 url.searchParams.set('mode',mode);await page.goto(url.href);await page.locator('#board button:enabled').first().waitFor();await page.waitForTimeout(1200);assert.equal((await clock()).elapsed,0);
 const blocked=page.locator('#board button.blocked').first();if(await blocked.count())await blocked.dispatchEvent('click');await page.locator('#help').click();await page.locator('#close-modal').click();assert.equal((await clock()).started,false);
 await page.locator('#board button:enabled').first().click();assert.equal((await clock()).started,true);await page.waitForFunction(()=>clockProbe().elapsed>=300);assert.ok((await clock()).elapsed>=300);const prev=(await clock()).elapsed;
 await page.locator('#undo').click();await page.waitForTimeout(350);assert.equal((await clock()).moves,0);assert.ok((await clock()).elapsed>prev,'Undo must not stop the clock');
}
url.searchParams.set('mode','expedition');await page.goto(url.href);await page.locator('[data-reward=feather]').click();await page.waitForTimeout(1200);assert.deepEqual(await clock(),{elapsed:0,started:false,moves:0});
await page.locator('#shuffle').click();await page.waitForTimeout(400);assert.equal((await clock()).started,false,'tools do not start tile timer');
await page.reload();await page.locator('#resume-confirm').click();await page.locator('#resume-confirm').waitFor({state:'hidden'});await page.waitForTimeout(1200);assert.deepEqual(await clock(),{elapsed:0,started:false,moves:0});
await page.locator('#board button:enabled').first().click();await page.waitForTimeout(400);await page.locator('#undo').click();const elapsed=(await clock()).elapsed;
await page.reload();await page.locator('#resume-confirm').click();await page.locator('#resume-confirm').waitFor({state:'hidden'});await page.waitForTimeout(350);assert.equal((await clock()).started,true);assert.equal((await clock()).moves,0);assert.ok((await clock()).elapsed>elapsed);
// Removing the optional flag simulates a checkpoint from before this release.
const oldRecord=await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem(RainSave.KEY));delete r.timerStarted;return r;});
url.searchParams.delete('mode');await page.goto(url.href);
await page.evaluate(r=>localStorage.setItem(RainSave.KEY,JSON.stringify(r)),oldRecord);
url.searchParams.set('mode','expedition');await page.goto(url.href);
await page.locator('#resume-confirm').click();await page.locator('#resume-confirm').waitFor({state:'hidden'});assert.equal((await clock()).started,true);
const legacy=page;
// Cancel an initial Continue dialog: return to chooser instead of a frozen board.
url.searchParams.delete('mode');await legacy.goto(url.href);await legacy.locator('#welcome-continue').click();await legacy.locator('#close-modal').click();assert.ok(await legacy.locator('#welcome-screen').isVisible());assert.equal(await legacy.locator('.play-space').isVisible(),false);
await legacy.locator('[data-welcome-mode=drizzle]').click();await legacy.locator('#board button[data-pile=left]:enabled').first().click();assert.equal(await legacy.evaluate(()=>clockProbe().game.moves),1);
await legacy.goto(url.href);await legacy.locator('#welcome-continue').click();await legacy.keyboard.press('Escape');assert.ok(await legacy.locator('#welcome-screen').isVisible());
assert.deepEqual(errors,[]);console.log('PASS: first successful pick starts all mode timers; inspection/blocked picks/tools excluded; Undo and reload preserve start state; legacy saves and cancelled Continue remain playable.');await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
