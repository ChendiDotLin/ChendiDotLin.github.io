'use strict';
// Real routes and old-key saves; remote score writes and Presence are mocked.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1366,height:1050},reducedMotion:'reduce'}), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.routeWebSocket(/\/realtime\/v1\//, socket=>socket.close());
  await page.route('**/rest/v1/rpc/*', r=>r.fulfill({json:{entries:[],total:0}}));
  const url=new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/critter-cascade/');
  await page.goto(url.href);
  assert.equal(await page.title(),'Critter Cascade');
  await page.locator('[data-reward=ukulele]').click();
  const tiles=await page.evaluate(async()=>{
   for(const item of RainMatch.ITEMS) { const image=new Image();image.src=`assets/tiles/${item.icon}.webp`;await image.decode();if(!image.naturalWidth)throw Error(item.icon); }
   return RainMatch.ITEMS;
  });
  assert.equal(new Set(tiles.map(t=>t.icon)).size,12);
  assert.deepEqual(tiles.map(t=>t.id),['bear','glasses','syringe','crowbar','backupMag','feather','bandolier','cell','buckler','clover','behemoth','blackhole']);
  for(const language of ['zh','en']) {
   if(language==='en')await page.locator('#language').click();
   assert.equal(await page.locator('#brand-name').textContent(),'Critter Cascade');
   assert.doesNotMatch(await page.evaluate(lang=>JSON.stringify(RainI18n.messages[lang]),language),/Clackworks|咔嗒工坊|保留电量|保留电荷|工坊|零件/);
   await page.locator('[data-relic=ukulele]').click();
   assert.match(await page.locator('.companion-effect').innerText(),/4/);
   assert.match(await page.locator('.companion-rules').innerText(),language==='zh'?/等待/:/waits/);
   await page.locator('.companion-basics summary').click();
   for(const width of [320,390,768,1366]) {
    await page.setViewportSize({width,height:1050});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${language}/${width} overflow`);
    const dialog=page.locator('#modal-content');
    assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog overflow');
   }
   if(language==='zh')await page.screenshot({path:'/tmp/critter-cascade-description.png',fullPage:true});
   await page.locator('#relic-close').click();
  }
  await page.locator('#language').click();
  await page.locator('#board button:enabled').first().click();
  const checkpoint=await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)).game);
  for(const legacy of ['clackworks','rain_match','yang']) {
   await page.goto(new URL(`/${legacy}/?from=legacy#continue`,url).href);
   await page.waitForURL('**/critter-cascade/?from=legacy#continue');
   await page.locator('#resume-confirm').click();
   assert.deepEqual(await page.evaluate(()=>RainSave.parse(localStorage.getItem(RainSave.KEY)).game),checkpoint);
  }
  await page.setViewportSize({width:390,height:1050});await page.screenshot({path:'/tmp/critter-cascade-phone.png',fullPage:true});
  await page.setViewportSize({width:1366,height:1050});await page.screenshot({path:'/tmp/critter-cascade-desktop.png',fullPage:true});
  for(const legacy of ['clackworks','rain_match','yang']) {
   await page.goto(new URL(`/${legacy}/admin/?from=legacy#login`,url).href);
   await page.waitForURL('**/critter-cascade/admin/?from=legacy#login');
   await page.locator('#login-form').waitFor();
   assert.match(await page.title(),/Critter Cascade/);assert.match(await page.locator('.admin-eyebrow').innerText(),/CRITTER CASCADE/);
  }
  assert.deepEqual(errors,[]);
  // A review sheet shows each unchanged generated sprite at actual game sizes.
  const sheet=await browser.newPage({viewport:{width:900,height:720}});
  await sheet.setContent(`<body style="margin:0;background:#172a32;color:#e6f0e9;font:16px system-ui;padding:30px"><h1>Critter Cascade</h1><p>Woodland matching tiles · 12 distinct silhouettes</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px">${tiles.map(t=>`<div style="display:flex;align-items:center;gap:12px"><img style="width:82px;height:82px;background:#f5e6c7;border-radius:12px" src="${new URL('assets/tiles/'+t.icon+'.webp',url)}"><div>${t.name}<br><small>${t.en}</small><br><img width="36" height="36" src="${new URL('assets/tiles/'+t.icon+'.webp',url)}"></div></div>`).join('')}</div></body>`);
  await sheet.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  await sheet.screenshot({path:'/tmp/critter-cascade-tile-review.png'});
  console.log('PASS: 12 loaded woodland sprites, stable tile IDs, bilingual purpose/rules, 320–1366px layout, all 6 old redirects, exact saved-game continuation, admin branding and no browser errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
