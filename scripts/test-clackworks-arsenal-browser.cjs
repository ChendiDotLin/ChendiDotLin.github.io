'use strict';
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH || undefined, headless:true,args:['--disable-gpu']});
 try {
  const page = await browser.newPage({viewport:{width:1366,height:1050}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());
  await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
  await page.route('**/expedition.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nconst Original=RainExpedition.Expedition;RainExpedition.Expedition=class extends Original {constructor(){super();window.testGame=this;}static fromSave(data){const game=Original.fromSave(data);window.testGame=game;return game;}};`});});
  await page.goto(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/critter-cascade/');
  await page.locator('[data-reward=ukulele]').click();
  await page.locator('#lightning-status').waitFor(); assert.match(await page.locator('#lightning-status').textContent(),/0\/4/);
  await page.locator('#equipment-catalog').click(); assert.equal(await page.locator('[data-catalog]').count(),16);
  for (const id of await page.evaluate(() => Object.keys(RainExpedition.RELICS))) {
    assert.ok((await page.locator(`[data-catalog=${id}] small`).textContent()).includes(await page.evaluate(id => RainI18n.translate('zh', 'role_' + id), id)), id + ' shows its role');
  }
  await page.evaluate(()=>Promise.all([...new Set([...document.querySelectorAll('.catalog-item image')].map(img=>img.getAttribute('href')))].map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;}))));
  await page.screenshot({path:'/tmp/clackworks-arsenal-catalog.png',fullPage:true});
  await page.locator('[data-catalog=prism]').click(); assert.match(await page.locator('#modal-content').textContent(),/暴击|搭配建议/);
  await page.locator('#modal-language').click(); assert.match(await page.locator('#modal-content').textContent(),/Kitten/);
  await page.locator('#relic-catalog').click(); assert.match(await page.locator('#modal-title').textContent(),/companion families/);
  await page.locator('#modal-language').click(); assert.match(await page.locator('#modal-title').textContent(),/四族伙伴图鉴/);
  await page.locator('#catalog-close').click();
  await page.evaluate(()=>{
    const g=testGame;g.pendingReward=null;g.midRewardTaken=true;
    g.relics={ukulele:1,prism:1,resin:1,echo:1,capacitor:1,turbine:1,blackhole:1};g.equipment='blackhole';g.charge=0;g.energy=0;g.rngState=1;
    g.tiles=Array.from({length:36},(_,id)=>({id,type:Math.floor(id/3),x:id%6*80,y:Math.floor(id/6)*75,z:0,pile:'main',zone:'board'}));
    g.rack=[];g.reserve=[];g.cleared=0;g.moves=0;g.previous=null;g.status='playing';document.getElementById('board').replaceChildren();
  });
  await page.locator('#language').click();await page.locator('#language').click();
  for(const id of [0,1,2]) await page.locator(`#board [data-id="${id}"]`).click();
  await page.waitForFunction(()=>document.querySelector('#board button:enabled'),null,{timeout:7000});
  assert.ok(await page.locator('#proc-log [data-proc=prism]').count());
  assert.ok(await page.locator('#proc-log [data-proc=echo]').count());
  assert.match(await page.locator('#equipment-feedback').textContent(), /三消暴击.*跟随消牌/);
  assert.match(await page.locator('#proc-log [data-proc=echo]').textContent(), /三消暴击/);
  assert.ok(await page.locator('.fuse-count').count());
  const first=await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)));
  assert.ok(first);assert.ok(first.game.fuse);assert.ok(first.game.cleared>=9);
  // Exercise all new visual branches with real tile rectangles and the same cleanup contract.
  await page.evaluate(async()=>{
    const before=RainEffects.snapshot(),ids=[...before.keys()].slice(0,3);
    await RainEffects.relic(['prism','seeker','resin','turbine','capacitor','echo','recycler'].map(kind=>({kind,ids:kind==='turbine'?[]:ids,amount:1})),before,21);
  });
  assert.equal(await page.locator('.fx-layer > *').count(),0);
  for(const width of [1366,768,390,320]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
    if(width===390)await page.screenshot({path:'/tmp/clackworks-arsenal-phone.png',fullPage:true});
  }
  await page.locator('#shuffle').click(); await page.waitForFunction(()=>document.querySelector('#board button:enabled'),null,{timeout:7000});
  const saved=await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)));assert.ok(saved);
  await page.reload();await page.locator('#resume-confirm').click();
  const restored=await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)));assert.deepEqual(restored.game,saved.game);
  await page.locator('#board button:enabled').first().click();
  assert.deepEqual(errors,[]);
  console.log('PASS: 16 loaded icons, bilingual catalog/details, lightning meter, real critical→echo feedback, fuse markers, all new FX cleanup, 320–1366px layouts, Shuffle and resumed inputs. All score writes mocked.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
