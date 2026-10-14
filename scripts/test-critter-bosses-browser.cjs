'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:1050}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 await page.route('**/expedition.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+`\nconst Base=RainExpedition.Expedition;RainExpedition.Expedition=class extends Base {constructor(){super();window.testGame=this;}static fromSave(s){const g=Base.fromSave(s);window.testGame=g;return g;}};`});});
 await page.goto(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');await page.locator('[data-reward=ukulele]').click();
 await page.locator('#boss-catalog').click();assert.equal(await page.locator('.boss-catalog section').count(),10);assert.match(await page.locator('.boss-catalog').innerText(),/镜湖灵狐.*盘根树獭.*森冠兽王/s);await page.locator('#modal-language').click();assert.match(await page.locator('.boss-catalog').innerText(),/Mirrorlake Fox/);await page.locator('#modal-language').click();await page.screenshot({path:'/tmp/critter-boss-route.png',fullPage:true});await page.locator('#boss-catalog-close').click();
 const waitFx=()=>page.waitForFunction(()=>!document.querySelector('.fx-layer > *')&&document.querySelector('#board button:enabled'));
 for(const stage of [10,20,30,40,50,60,70,80,90,100]){
  await page.evaluate(stage=>{
   const g=testGame,b=new RainMatch.Game('rain',Math.random,RainExpedition.stageSpec(stage-1)),l=RainExpedition.levelCapAt(stage-1);
   for(const key of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[key]=b[key];
   Object.assign(g,{stage:stage-1,banked:RainExpedition.bankedBefore(stage-1),bankedMoves:0,competitive:false,finished:false,trial:null,sealed:{},bossEnergy:0,bossStarted:false,stageMatches:0,manualMatches:0,midRewardTaken:true,pendingReward:null,relics:{feather:l,shield:l,cell:l,ukulele:l,behemoth:l,clover:l,blackhole:l},equipment:'blackhole',charge:1,energy:0,featherCharge:1,featherEnergy:0,fuse:null,spark:0,lightningReady:false,seekerCharge:0,turbineCharge:0,capacitorCharge:0,blastCharge:0,used:{remove:false,undo:false,shuffle:false}});
   g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';document.getElementById('board').replaceChildren();
  },stage);
  await page.locator('#language').click();await page.locator('#language').click();await page.locator('#expedition-continue').click();await page.locator('#stage-next').click();
  if(await page.locator('#reward-skip').count()){await page.locator('#reward-skip').click();await page.locator('#stage-next').click();}
  await page.locator('#boss-start').waitFor();assert.equal(await page.evaluate(()=>Object.keys(testGame.sealed).length),7);assert.equal(await page.evaluate(()=>Object.keys(testGame.relics).length),0);
  assert.equal(await page.locator('.relic-group[data-kind=passive] [data-relic]').count(),6);assert.equal(await page.locator('.relic-group[data-kind=active] [data-relic]').count(),1);
  assert.match(await page.locator('#relic-slots').innerText(),/6\/6.*1\/1.*7\/7/);
  await page.locator('#boss-start').click();await page.locator('.fx-seal-lock').waitFor();await waitFx();
  if(stage>=40)assert.ok(await page.locator('#boss-trial').isVisible());
  const checkpoint=await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)).game);
  await page.reload();await page.locator('#resume-confirm').click();await page.waitForFunction(()=>!document.querySelector('dialog').open);const resumed=await page.evaluate(()=>testGame.toSave());if(resumed.pressure?.started){assert.equal(resumed.pressure.hearts,checkpoint.pressure.hearts);assert.ok(resumed.pressure.remaining<=checkpoint.pressure.remaining&&resumed.pressure.remaining>checkpoint.pressure.remaining-1000);resumed.pressure.remaining=checkpoint.pressure.remaining;}assert.deepEqual(resumed,checkpoint);
  const ids=await page.evaluate(()=>{
   const g=testGame;g.tiles.forEach(t=>t.z=0);const type=g.trial?.types[0]??0,ids=g.tiles.filter(t=>t.type===type).slice(0,3).map(t=>t.id);
   ids.forEach((id,i)=>Object.assign(g.tiles[id],{x:50+i*100,y:0}));document.getElementById('board').replaceChildren();return ids;
  });await page.locator('#language').click();await page.locator('#language').click();
  for(const id of ids)await page.locator(`#board [data-id="${id}"]`).click();await waitFx();
  assert.ok(await page.evaluate(()=>Object.keys(testGame.relics).length>=1));assert.ok(await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY))));
  await page.locator('#undo').click();await waitFx();assert.equal(await page.evaluate(()=>Object.keys(testGame.relics).length),0);
  for(const width of [320,390,1366]){await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`stage ${stage}/${width}`);}
  console.log(`PASS: stage ${stage} entrance, recovery, checkpoint and Undo`);
  if(stage===100){await page.setViewportSize({width:390,height:1050});await page.screenshot({path:'/tmp/critter-boss-100-phone.png',fullPage:true});await page.setViewportSize({width:1366,height:1050});}
 }
 assert.deepEqual(errors,[]);console.log('PASS: ten real guardian entrances, shared seal FX, 6+1 grouped slots, bilingual Boss guide, first recovery, exact reload/Undo, mobile layouts and released input after every animation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
