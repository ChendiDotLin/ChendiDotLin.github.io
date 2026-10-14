'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 // Keep browser tests from generating real Analytics traffic, including live QA.
 await page.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));
 await page.route('**/expedition.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst Base=RainExpedition.Expedition;RainExpedition.Expedition=class extends Base {constructor(){super();window.testGame=this;}};'});});
 await page.goto(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');await page.locator('[data-reward=ukulele]').click();
 const panel=page.locator('#expedition-panel'),board=page.locator('#board');
 for(const width of [1024,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});
  const left=await page.locator('#leaderboard-panel').boundingBox(),middle=await board.boundingBox(),right=await panel.boundingBox();
  assert.ok(left.x+left.width<middle.x&&middle.x+middle.width<right.x,'rankings - board - companions');
  assert.ok(middle.y<300,'board no longer pushed down by loadout');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:1440,height:1000});
 const initial=await board.boundingBox();
 await page.evaluate(()=>{testGame.relics={ukulele:5,behemoth:5,feather:5,shield:5,clover:5,gasoline:5,radar:5};testGame.equipment='radar';});
 await page.locator('#language').click();await page.locator('#language').click();assert.equal(await panel.locator('.relic-chip').count(),7);
 assert.deepEqual(await board.boundingBox(),initial,'full loadout does not shift the board');
 await panel.locator('[data-relic=ukulele]').click();await page.locator('#modal').waitFor();assert.ok(await page.locator('#modal').evaluate(e=>e.open));await page.locator('#close-modal').click();
 await page.screenshot({path:'/tmp/critter-three-columns.png',fullPage:true});
 for(const width of [390,320,768,1024,390]){
  await page.setViewportSize({width,height:1000});
  await page.waitForFunction(w=>document.querySelector('#expedition-panel').parentElement.matches(w>=1024?'.play-space':'.game-panel'),width);
  assert.equal(await page.locator('#expedition-panel').count(),1);assert.equal(await panel.locator('.relic-chip').count(),7);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width<1024){const p=await panel.boundingBox(),b=await board.boundingBox();assert.ok(p.y+p.height<=b.y);}
 }
 await page.setViewportSize({width:1440,height:1000});await panel.locator('[data-relic=radar]').click();await page.locator('#close-modal').click();
 await page.evaluate(()=>{window.beforePick=testGame.moves;});await page.locator('#board button:enabled').first().click();assert.equal(await page.evaluate(()=>testGame.moves),1);
 await page.locator('[data-mode=drizzle]').click();
 assert.equal(await panel.isVisible(),false);assert.deepEqual(errors,[]);
 console.log('PASS: desktop columns, stable board with seven companions, functional details and tiles, mobile restoration, breakpoint resize and classic mode.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
