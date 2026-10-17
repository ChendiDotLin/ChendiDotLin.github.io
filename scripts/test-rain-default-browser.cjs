// Welcome / mode selection / preserved checkpoints. No real scores or analytics.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],reads=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));
  await context.route('**/rest/v1/rpc/*',r=>{assert.ok(!r.request().url().includes('submit'));reads.push(r.request().postDataJSON());return r.fulfill({json:{entries:[],total:0}});});
  await context.routeWebSocket(/\/realtime\/v1\//,s=>s.close());
  const page=await context.newPage(),url=new URL(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');url.searchParams.delete('mode');
  const saved=()=>page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)));
  const welcome=async()=>{await page.locator('[data-welcome-mode=drizzle]:enabled').waitFor();assert.ok(await page.locator('#welcome-screen').isVisible());assert.equal(await page.locator('.play-space').isVisible(),false);assert.equal(await page.locator('dialog').evaluate(e=>e.open),false);};
  await page.goto(url.href);await welcome();assert.equal(await saved(),null);assert.equal(reads.length,0);
  await page.waitForTimeout(1100);await page.keyboard.press('3');assert.equal(await page.locator('#timer').textContent(),'00:00');assert.equal(await saved(),null);
  await page.locator('#welcome-language').click();assert.match(await page.locator('.welcome-prompt').textContent(),/Start with Drizzle/);await page.locator('#welcome-language').click();
  for(const width of [320,390,768,1366]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:'/tmp/critter-welcome-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/critter-welcome-phone.png',fullPage:true});
  for(const mode of ['drizzle','rain','monsoon']) {
   await page.locator(`[data-welcome-mode=${mode}]`).click();await page.locator('#board button:enabled').first().waitFor();
   assert.equal(await page.locator(`[data-mode=${mode}]`).getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#ranking-period-tabs').isVisible(),false);assert.equal(await saved(),null);
   await page.reload();await welcome();
  }
  await page.locator('[data-welcome-mode=expedition]').click();await page.locator('[data-reward=feather]').click();await page.locator('#reward-confirm').click();
  await page.locator('#board button:enabled').first().click();let before=await saved();assert.ok(before);
  await page.reload();await welcome();assert.ok(await page.locator('#welcome-resume').isVisible());assert.deepEqual((await saved()).game,before.game);assert.equal((await saved()).runId,before.runId);before=await saved();await page.waitForTimeout(600);assert.deepEqual(await saved(),before);
  // Learning a classic mode must never overwrite an existing Expedition.
  await page.locator('[data-welcome-mode=drizzle]').click();await page.locator('#board button:enabled').first().click();assert.deepEqual(await saved(),before);
  await page.reload();await welcome();await page.locator('#welcome-continue').click();await page.locator('#resume-confirm').click();await page.locator('#resume-confirm').waitFor({state:'hidden'});
  assert.deepEqual((await saved()).game,before.game);assert.equal((await saved()).runId,before.runId);
  // A second welcome screen doesn't take the lock. Trying to resume respects it.
  const second=await context.newPage();await second.goto(url.href);await second.locator('#welcome-continue').click();await second.locator('#resume-confirm').click();await second.locator('#save-lock-retry').waitFor();assert.equal(await second.locator('#board button:enabled').count(),0);await second.close();
  url.searchParams.set('mode','expedition');await page.goto(url.href);await page.locator('#resume-confirm').waitFor();assert.equal(await page.locator('#welcome-screen').isVisible(),false);await page.locator('#resume-confirm').click();
  // Beta selection applies to expedition only, never the classic boards.
  await page.locator('[data-ranking-period=beta]').click();await page.locator('[data-leaderboard-mode=rain]').click();assert.equal(await page.locator('#ranking-period-tabs').isVisible(),false);
  await page.locator('[data-leaderboard-mode=expedition]').click();assert.equal(await page.locator('[data-ranking-period=formal]').getAttribute('aria-pressed'),'true');
  url.searchParams.set('mode','unknown');await page.goto(url.href);await welcome();assert.equal((await saved()).runId,before.runId);
  await context.close();
  const noStorage=await browser.newContext();await noStorage.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));await noStorage.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await noStorage.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
  await noStorage.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  const fresh=await noStorage.newPage();fresh.on('pageerror',e=>errors.push(e.message));await fresh.goto(url.href);await fresh.locator('[data-welcome-mode=drizzle]').click();await fresh.locator('#board button:enabled').first().click();
  assert.deepEqual(errors,[]);await noStorage.close();
  console.log('PASS: welcome, no auto-play/save/timer, all mode choices, bilingual/mobile layout, preserved Expedition, continuation and locks, classic-only formal boards, explicit links and blocked storage.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
