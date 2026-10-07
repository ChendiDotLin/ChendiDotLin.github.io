'use strict';
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless:true });
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());
  await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
  await page.route('**/expedition.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nconst Original=RainExpedition.Expedition;RainExpedition.Expedition=class extends Original {constructor(){super();window.testGame=this;}};`});});
  await page.route('**/game.js*',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('  function render(enter = false) {',`  window.layoutProbe = { render: () => render(), log: events => { lastProc = events ? { run: runId, stage: game.stage, total: events.length * 3, events } : null; renderProcLog(); } };
  function render(enter = false) {`);await route.fulfill({response,body});});
  await page.goto(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/');await page.locator('[data-reward=ukulele]').click();
  await page.evaluate(()=>{
   const g=testGame;g.relics={ukulele:1,seeker:1,resin:1,shield:1,feather:1,capacitor:1,radar:1};g.equipment='radar';g.charge=0;g.energy=0;g.pendingReward=null;
   layoutProbe.render();
  });
  for(const width of [320,390,768,1366]) for(const language of ['zh','en']) {
   await page.setViewportSize({width,height:844});
   if(await page.evaluate(()=>document.documentElement.lang.startsWith('zh')?'zh':'en')!==language)await page.locator('#language').click();
   await page.evaluate(()=>{ testGame.stage=1;testGame.sealed={};layoutProbe.render();window.scrollTo(0,document.getElementById('board').offsetTop); });
   const positions=await page.evaluate(async()=>{
    const g=testGame,out=[];
    const measure=()=>{const b=document.getElementById('board').getBoundingClientRect(),r=document.getElementById('rack').getBoundingClientRect();return {board:b.top+scrollY,rack:r.top+scrollY,viewport:b.top,scroll:scrollY};};
    for(let i=0;i<12;i++){
     g.lightningReady=!!(i%2);g.spark=i%4;g.seekerCharge=i%2?4:0;g.fuse=i%3?{ids:[0,1,2],ticks:3}:null;
     g.radarUntil=i%2?g.moves+10:0;g.radarMark=i%2?0:null;g.featherCharge=i%2;g.featherEnergy=i%2?0:7;
     g.charge=i%2;g.shieldSpent=!!(i%2);g.midRewardTaken=!!(i%2);layoutProbe.render();
     layoutProbe.log(i%3===0?null:Array.from({length:i%3===1?1:7},(_,n)=>({kind:['ukulele','prism','resin','echo','capacitor','seeker','turbine'][n],ids:n===6?[]:[0,1,2],amount:3})));
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));out.push(measure());
    }
    return out;
   });
   for(const key of ['board','rack','viewport','scroll'])assert.ok(Math.max(...positions.map(x=>x[key]))-Math.min(...positions.map(x=>x[key]))<1,`${width}/${language} ${key}: ${JSON.stringify(positions)}`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   // Boss restoration keeps the owned loadout/controls in the same reserved slots.
   const boss=await page.evaluate(async()=>{
    const g=testGame,gear={...g.relics};g.stage=10;g.sealed={...gear};g.relics={};g.equipment=null;g.fuse=null;layoutProbe.render();
    const top=()=>document.getElementById('board').getBoundingClientRect().top+scrollY;
    const positions=[top()];for(const id of Object.keys(gear)){g.relics[id]=gear[id];delete g.sealed[id];if(id==='radar')g.equipment=id;layoutProbe.render();positions.push(top());}
    g.stage=1;layoutProbe.render();return positions;
   });
   assert.ok(Math.max(...boss)-Math.min(...boss)<1,`Boss ${width}/${language}: ${boss}`);
   if(width===390&&language==='zh'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/clackworks-stable-layout.png',fullPage:true});}
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: board, tray and scroll positions vary <1px across 96 status/log changes in Chinese/English at 320/390/768/1366px; Boss gear restoration stays stationary; no horizontal overflow. Scores and Presence mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
