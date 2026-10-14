'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width:touch?390:1366,height:1000},hasTouch:touch,isMobile:touch});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
  await page.route('**/expedition.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst Base=RainExpedition.Expedition;RainExpedition.Expedition=class extends Base {constructor(){super();window.testGame=this;}};'});});
  await page.goto(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');await page.locator('[data-reward=ukulele]').click();
  await page.evaluate(touch=>{const g=testGame;g.relics={behemoth:1};g.blastCharge=3;g.midRewardTaken=true;g.tiles.forEach((t,id)=>Object.assign(t,{type:Math.floor(id/3),x:id%6*80,y:Math.floor(id/6)*75,z:0,pile:'main'}));if(touch){g.tiles[35].zone='reserve';g.reserve=[35];}document.getElementById('board').replaceChildren();},touch);
  await page.locator('#language').click();
  const press=async selector=>{const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox();const start=Date.now();if(touch)await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);return Date.now()-start;};
  for(const id of [0,1,2])await press(`#board [data-id="${id}"]`);
  await page.locator('.fx-blast-core').first().waitFor();
  assert.ok(await page.locator('#board button').first().isDisabled());
  const id=await page.evaluate(()=>testGame.available()[0].id),before=await page.evaluate(()=>testGame.moves);
  const ms=await press(touch ? '#reserve [data-id="35"]' : `#board [data-id="${id}"]`);
  assert.equal(await page.evaluate(()=>testGame.moves),before+1,'press during blast is committed exactly once');assert.ok(ms<600,`input took ${ms}ms`);
  // Next key press can consume a tool while the previous tool animation is running.
  await press('#shuffle');await page.locator('.fx-portal').first().waitFor();
  if(touch)await press('#remove');else await page.keyboard.press('1');
  assert.equal(await page.evaluate(()=>testGame.used.remove),true);assert.equal(await page.evaluate(()=>testGame.reserve.length),1);
  assert.ok(await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY))));
  await page.waitForFunction(()=>!document.querySelector('.fx-layer > *'));
  // Hundreds of proc events cannot create hundreds of live animations. Reset must settle everything.
  const peak=await page.evaluate(async()=>{RainEffects.reset();const before=RainEffects.snapshot();const events=Array.from({length:150},(_,i)=>({kind:['behemoth','ukulele','gasoline'][i%3],ids:[6,7,8]}));const p=RainEffects.relic(events,before,144);const n=document.getAnimations().filter(a=>!(a instanceof CSSAnimation)&&!(a instanceof CSSTransition)).length;RainEffects.reset();await p;return n;});
  assert.ok(peak<=96,`too many animations: ${peak}`);assert.equal(await page.locator('.fx-layer > *').count(),0);
  assert.equal(await page.locator('#board').evaluate(el=>getComputedStyle(el).opacity),'1');assert.deepEqual(errors,[]);
  // Finishing a chain must open its reward once, without passing the same press
  // through to a tool behind the newly opened modal.
  await page.evaluate(()=>{const g=testGame;Object.assign(g,{relics:{ukulele:1},spark:3,lightningReady:false,midRewardTaken:false,stageMatches:2,manualMatches:2,cleared:6,rack:[],reserve:[],previous:null,used:{shuffle:false,remove:false,undo:false}});g.tiles.forEach((t,id)=>Object.assign(t,{type:Math.floor(id/3),zone:id<6?'matched':'board'}));document.getElementById('board').replaceChildren();});
  await page.locator('#language').click();
  for(const id of [6,7,8])await press(`#board [data-id="${id}"]`);
  await page.locator('.fx-lightning').first().waitFor();await press('#shuffle');
  await page.locator('[data-reward]').first().waitFor();assert.equal(await page.evaluate(()=>testGame.used.shuffle),false);
  await page.locator('#reward-skip').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);assert.ok(await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY))));
  console.log(`PASS: ${touch?'touch':'mouse'} press during blast (${ms}ms), tool interruption, single commit, valid save, bounded animations (${peak}) and cleanup`);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
