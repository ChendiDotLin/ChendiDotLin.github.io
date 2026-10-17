'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 await page.route('**/expedition.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nconst Base=RainExpedition.Expedition;RainExpedition.Expedition=class extends Base {constructor(){super();window.testGame=this;}static fromSave(s){const g=Base.fromSave(s);window.testGame=g;return g;}};'});});
 await page.goto(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');await page.locator('[data-reward=ukulele]').click();await page.locator('#reward-confirm').click();
 for(const stage of [15,25]){
  await page.setViewportSize({width:390,height:950});
  await page.evaluate(stage=>{const g=testGame,b=new RainMatch.Game('rain',Math.random,RainExpedition.stageSpec(stage-1));for(const key of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[key]=b[key];Object.assign(g,{stage:stage-1,banked:RainExpedition.bankedBefore(stage-1),bankedMoves:0,competitive:false,finished:false,trial:null,environment:null,sealed:{},bossEnergy:0,bossStarted:false,stageMatches:0,manualMatches:0,midRewardTaken:true,pendingReward:null,relics:{feather:4,radar:4},equipment:'radar',charge:1,energy:0,featherCharge:1,featherEnergy:0,fuse:null,spark:0,lightningReady:false,seekerCharge:0,turbineCharge:0,capacitorCharge:0,blastCharge:0,used:{remove:false,undo:false,shuffle:false}});g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';document.getElementById('board').replaceChildren();},stage);
  await page.locator('#language').click();await page.locator('#language').click();await page.locator('#expedition-continue').click();await page.locator('#stage-next').click();
  if(await page.locator('#reward-skip').count()){await page.locator('#reward-skip').click();await page.locator('#stage-next').click();}
  await page.locator('#environment-start').waitFor();assert.match(await page.locator('#modal-title').innerText(),stage===15?/迷雾林地/:/月影山谷/);
  await page.locator('#modal-language').click();assert.match(await page.locator('#modal-title').innerText(),stage===15?/Misty Woods/:/Moonlit Valley/);await page.locator('#modal-language').click();
  await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>testGame.environment.started),false);
  if(stage===25)await page.keyboard.press('Escape');else await page.locator('#environment-start').click();
  assert.equal(await page.evaluate(()=>testGame.environment.started),true);
  if(stage===15){
   assert.equal(await page.locator('.memory-mark').count(),5);const top=await page.locator('#board').evaluate(el=>el.getBoundingClientRect().top+scrollY);
   await page.waitForTimeout(600);await page.locator('#environment-info').click();const before=await page.evaluate(()=>testGame.environment.preview);await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>testGame.environment.preview),before,'dialog pauses observation');await page.locator('#environment-start').click();
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hiddenBefore=await page.evaluate(()=>testGame.environment.preview);await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>testGame.environment.preview),hiddenBefore,'background pauses observation');await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   await page.locator('#shuffle').click();const animationBefore=await page.evaluate(()=>testGame.environment.preview);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>testGame.environment.preview),animationBefore,'animation pauses observation');
   await page.waitForFunction(()=>document.querySelectorAll('.memory-hidden').length===5);
   assert.equal(await page.locator('#board').evaluate(el=>el.getBoundingClientRect().top+scrollY),top);
   assert.ok(await page.locator('.memory-hidden').first().evaluate(el=>getComputedStyle(el.querySelector('img')).visibility==='hidden'&&el.title.includes('迷雾牌')));
   await page.locator('#board').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/critter-memory-phone.png'});
   const cards=await page.evaluate(()=>testGame.environment.cards);await page.reload();await page.locator('#resume-confirm').click();await page.waitForFunction(()=>!document.querySelector('dialog').open);
   assert.deepEqual(await page.evaluate(()=>testGame.environment.cards),cards);assert.equal(await page.locator('.memory-hidden').count(),5,'reload does not reset memory');
   await page.locator('#expedition-active').click();assert.equal(await page.locator('.memory-hidden').count(),0,'Owl dispels mist');await page.waitForFunction(()=>!document.querySelector('.fx-layer > *'));
  }else{
   assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('environment-mono')));
   assert.equal(await page.locator('#board img').first().evaluate(el=>getComputedStyle(el).filter),'grayscale(1)');
   const blocked=await page.locator('#board .blocked').first().evaluate(el=>getComputedStyle(el).filter);assert.match(blocked,/brightness/);
   await page.locator('#board').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/critter-monochrome-phone.png'});
  }
  for(const width of [320,390,1366]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  // Odd special stages have no regular or bonus supply.
  await page.evaluate(()=>{const g=testGame;g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';g.rack=[];g.reserve=[];g.previous=null;g.environment.cards=[];g.pendingReward=null;document.getElementById('board').replaceChildren();});await page.locator('#language').click();await page.locator('#language').click();await page.locator('#expedition-continue').click();
  assert.equal(await page.locator('[data-reward]').count(),0);assert.match(await page.locator('#stage-next').innerText(),/下一关/);
  await page.reload();await page.locator('#resume-confirm').click();assert.equal(await page.locator('[data-reward]').count(),0);
  await page.locator('#stage-next').click();await page.waitForFunction(()=>!document.querySelector('.fx-layer > *')&&document.querySelector('#board button:enabled'));assert.equal(await page.evaluate(()=>testGame.environment),null);assert.equal(await page.locator('.memory-hidden').count(),0);assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('environment-mono')),false);
  console.log(`PASS: stage ${stage} bilingual intro, timer/visuals, responsive layout, no odd-stage supplies, clear reload and next-stage cleanup`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
