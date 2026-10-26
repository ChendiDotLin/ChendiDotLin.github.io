'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 for(const width of [320,390,1366]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:true}),errors=[];
 await context.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await context.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));await context.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
 await context.route('**/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  function render(enter = false) {','  window.restartProbe=()=>({game,animating,timerStarted,elapsed,runId,render:()=>render()});\n  function render(enter = false) {')});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=new URL(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');url.searchParams.set('mode','eclipse');await page.goto(url.href);await page.locator('#eclipse-start').click();
 const frameBoard=async()=>{await page.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();scrollTo(0,scrollY+r.top-40)});await page.waitForTimeout(120);};
 const stable=async(y,label)=>{await page.waitForTimeout(100);assert.ok(Math.abs((await page.evaluate(()=>scrollY))-y)<=2,`${width} ${label}: scroll changed from ${y} to ${await page.evaluate(()=>scrollY)}`);};
 const tap=async(selector)=>{const box=await page.locator(selector).boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=844,`${selector} must already be in viewport`);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);};
 await frameBoard();assert.equal(await page.locator('.site-header #restart').count(),0);assert.equal(await page.locator('.inventory-label #restart').count(),0);assert.ok(await page.evaluate(()=>document.getElementById('restart').getBoundingClientRect().top-document.getElementById('rack').getBoundingClientRect().bottom>=18),'restart must sit below the tray with a safe gap');assert.ok(await page.locator('#restart').evaluate(el=>el.getBoundingClientRect().height>=44));
 const y=await page.evaluate(()=>scrollY),old=await page.evaluate(()=>restartProbe().runId);await tap('#restart');await page.locator('#eclipse-start').waitFor();assert.notEqual(await page.evaluate(()=>restartProbe().runId),old);await stable(y,'restart and automatic intro');await page.locator('#close-modal').click();await stable(y,'close intro via X');
 await tap('#restart');await page.locator('#eclipse-start').waitFor();await page.locator('#eclipse-skip-intro').check();await page.locator('#modal-language').click();assert.ok(await page.locator('#eclipse-skip-intro').isChecked());assert.match(await page.locator('.eclipse-intro-preference').innerText(),/Don't show/);await page.locator('#eclipse-start').click();await stable(y,'checkbox, language, Start');
 assert.equal(await page.locator('#restart').innerText(),'↻\nRestart');
 for(let n=0;n<2;n++){await tap('#restart');await page.waitForFunction(()=>!restartProbe().animating);await stable(y,'remembered restart '+n);assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await page.evaluate(()=>restartProbe().game.moves),0);assert.equal(await page.evaluate(()=>restartProbe().timerStarted),false);assert.equal(await page.evaluate(()=>restartProbe().game.pressure.started),false);}
 await page.reload();await page.waitForFunction(()=>!!window.restartProbe);assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);await frameBoard();
 // Manual Rules remains available and pauses a running hunt.
 await page.locator('#board button:enabled').first().click();await page.waitForFunction(()=>restartProbe().game.pressure.remaining<7900);
 // Open without the automation scrolling the page up to the Rules control.
 const yy=await page.evaluate(()=>scrollY);await page.evaluate(()=>document.getElementById('eclipse-info').click());const paused=await page.evaluate(()=>restartProbe().game.pressure.remaining);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>restartProbe().game.pressure.remaining),paused);assert.ok(await page.locator('#eclipse-skip-intro').isChecked());
 // Emulate a browser restoring focus to an offscreen opener on close.
 await page.evaluate(()=>{const modal=document.getElementById('modal'),close=modal.close.bind(modal);modal.close=(...args)=>{close(...args);document.getElementById('help').focus();};});
 await page.keyboard.press('Escape');await stable(yy,'Escape with native focus scrolling');await page.waitForFunction(p=>restartProbe().game.pressure.remaining<p,paused);
 await page.evaluate(()=>document.getElementById('eclipse-info').click());await page.locator('#eclipse-skip-intro').uncheck();await page.locator('#close-modal').click();await stable(yy,'restore reminders');
 await frameBoard();await tap('#restart');await page.locator('#eclipse-start').waitFor();await page.locator('#eclipse-skip-intro').check();await page.locator('#eclipse-start').click();
 if(width===390){await page.screenshot({path:'/tmp/critter-restart-phone.png'});await page.evaluate(()=>document.getElementById('eclipse-info').click());await page.locator('#eclipse-skip-intro').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/critter-eclipse-preference.png'});await page.locator('#eclipse-start').click();}
 await page.locator('[data-mode=drizzle]').click();await page.waitForFunction(()=>!restartProbe().animating);await page.locator('#restart').click();await page.waitForFunction(()=>!restartProbe().animating);assert.equal(await page.evaluate(()=>restartProbe().game.mode),'drizzle');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);
 await page.locator('[data-mode=eclipse]').click();await page.waitForFunction(()=>!restartProbe().animating);assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);
 if(width===390){
  await page.evaluate(()=>{delete document.getElementById('modal').close;});
  await page.locator('[data-mode=expedition]').click();await page.locator('[data-reward=feather]').click();await page.locator('#reward-confirm').click();
  await page.evaluate(()=>{const g=restartProbe().game;g.relics={feather:1,ukulele:1,gasoline:1,behemoth:1,prism:1,clover:1,radar:1};g.equipment='radar';restartProbe().render();});
  await frameBoard();const boardY=await page.locator('#board').evaluate(el=>el.getBoundingClientRect().top);await tap('#restart');await page.locator('#restart-confirm').click();await page.locator('[data-reward=feather]').waitFor();
  assert.ok(Math.abs((await page.locator('#board').evaluate(el=>el.getBoundingClientRect().top))-boardY)<=2,'fresh shorter Expedition panel must keep the board in view');
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(`PASS ${width}: in-view touch restart, stable intro/close/restart, persistent bilingual opt-out, manual rules, restore reminders, first-pick timer, paused hunt and mode switches.`);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
