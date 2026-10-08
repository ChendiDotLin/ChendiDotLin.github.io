'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1366,height:1100},reducedMotion:'no-preference'}), errors=[];
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket(/\/realtime\/v1\//,socket=>socket.close());
 await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 await page.route('**/expedition.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+`\nconst Base=RainExpedition.Expedition; RainExpedition.Expedition=class extends Base {constructor(){super();window.testGame=this;} static fromSave(data){const g=Base.fromSave(data);window.testGame=g;return g;}};`});});
 await page.goto(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');
 await page.locator('[data-reward=ukulele]').click();
 await page.locator('#equipment-catalog').click();
 assert.equal(await page.locator('.family-catalog').count(),4);assert.equal(await page.locator('[data-catalog]').count(),16);
 await page.screenshot({path:'/tmp/clackworks-animal-catalog.png',fullPage:true});
 const ids=await page.locator('[data-catalog]').evaluateAll(els=>els.map(el=>el.dataset.catalog));
 for(const id of ids) {
  await page.locator(`[data-catalog=${id}]`).click();
  assert.equal(await page.locator('.evolution-strip .animal-sprite').count(),5);
  const forms=await page.locator('.evolution-strip svg').evaluateAll(els=>els.map(el=>el.getAttribute('viewBox')));assert.equal(new Set(forms).size,5);
  if(id==='prism')await page.screenshot({path:'/tmp/clackworks-cat-evolutions.png'});
  await page.locator('#relic-catalog').click();
 }
 await page.locator('#catalog-close').click();
 const saved=()=>page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)));
 const render=async()=>{await page.locator('#language').click();};
 const setStage=async(stage)=>{
  await page.evaluate(stage=>{
   const g=testGame,b=new RainMatch.Game('rain',Math.random,RainExpedition.stageSpec(stage));
   for(const key of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[key]=b[key];
   Object.assign(g,{stage,banked:RainExpedition.bankedBefore(stage),competitive:false,trial:null,sealed:{},bossEnergy:0,bossStarted:false,stageMatches:0,manualMatches:0,midRewardTaken:true,pendingReward:null,relics:{prism:3,behemoth:3,clover:3,gasoline:3,capacitor:3,blackhole:1},equipment:'blackhole',charge:1,energy:0,featherCharge:0,featherEnergy:0,fuse:null});
   g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length;g.status='won';document.getElementById('board').replaceChildren();
  },stage);
  await render();await page.locator('#expedition-continue').click();await page.locator('#stage-next').click();
  if(await page.locator('#reward-skip').count()) {await page.locator('#reward-skip').click();await page.locator('#stage-next').click();}
  await page.locator('#boss-start').waitFor();
 };
 const waitFx=()=>page.waitForFunction(()=>!document.querySelector('.fx-layer > *')&&document.querySelector('#board button:enabled'));
 await setStage(19);assert.equal(await page.evaluate(()=>testGame.bossKind),'ward');
 await page.screenshot({path:'/tmp/clackworks-ward-intro.png'});await page.locator('#boss-start').click();
 await page.locator('.fx-ward-shard').first().waitFor();await waitFx();
 assert.ok(await page.locator('.ward-mark').count());
 for(const width of [320,390,768,1366]) {await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 // Real clicks on a marked triple must break that ward and release input again.
 const targets=await page.evaluate(()=>{
  const g=testGame,type=g.trial.types[0],ids=g.tiles.filter(t=>t.type===type).slice(0,3).map(t=>t.id);
  g.tiles.forEach((t,i)=>Object.assign(t,{z:0,x:i%6*75,y:180+i%3*95}));ids.forEach((id,i)=>Object.assign(g.tiles[id],{x:80+i*100,y:0}));document.getElementById('board').replaceChildren();return ids;
 });await render();
 for(const id of targets)await page.locator(`#board [data-id="${id}"]`).click();
 await page.locator('.fx-ward-shard').first().waitFor();await waitFx();
 assert.equal((await saved()).game.trial.broken.length,1);
 const checkpoint=await saved();await page.reload();await page.locator('#resume-confirm').click();assert.deepEqual((await saved()).game.trial,checkpoint.game.trial);
 await page.locator('#undo').click();assert.equal((await saved()).game.trial.broken.length,0);
 // Second boss has a different cinematic and phase meter; normal controls remain live.
 await setStage(29);assert.equal(await page.evaluate(()=>testGame.bossKind),'armor');
 await page.locator('#boss-start').click();await page.locator('.fx-armor-shard').first().waitFor();await waitFx();
 const initial=await saved();assert.ok(initial);assert.equal(initial.game.trial.kind,'armor');
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'/tmp/clackworks-animal-boss-phone.png',fullPage:true});
 await page.locator('#equipment-catalog').click();await page.locator('[data-catalog=ukulele]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/clackworks-dragon-evolutions-phone.png'});
 await page.locator('#relic-close').click();
 const available=await page.evaluate(()=>testGame.available()[0].id),moves=await page.evaluate(()=>testGame.moves);
 await page.locator(`#board [data-id="${available}"]`).click();assert.equal(await page.evaluate(()=>testGame.moves),moves+1);
 assert.deepEqual(errors,[]);
 console.log('PASS: 16 companions / 80 distinct atlas windows, four catalog families, mobile layouts, both Boss entrances and inert effects, ward break/Undo/reload, live post-animation input. All network writes mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
