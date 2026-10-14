'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 for(const width of [320,390]) for(const language of ['zh','en']) {
  const page=await browser.newPage({viewport:{width,height:760},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket(/\/realtime\/v1\//,s=>s.close());await page.route('https://www.googletagmanager.com/**',r=>r.fulfill({body:''}));await page.route('**/rest/v1/rpc/*',r=>r.fulfill({json:{entries:[],total:0}}));
  await page.route('**/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  function render(enter = false) {','  window.scrollProbe={game:()=>game,render:()=>render()};\n  function render(enter = false) {')});});
  const url=new URL(process.env.RAIN_GAME_URL||'http://127.0.0.1:8765/critter-cascade/');url.searchParams.set('mode','expedition');
  await page.goto(url.href);await page.locator('[data-reward=feather]').click();if(language==='en')await page.locator('#language').click();
  await page.evaluate(()=>{
   const g=scrollProbe.game();Object.assign(g,{midRewardTaken:false,stageMatches:2,manualMatches:2,relics:{feather:1,radar:1},equipment:'radar',charge:1});
   g.tiles.forEach(t=>t.zone='matched');g.cleared=g.tiles.length-6;g.rack=[0];g.tiles[0].zone='rack';g.tiles[0].type=0;
   // The last main pair triggers a mid-stage reward; only the bottom piles remain.
   for(const [id,pile,x,y,type] of [[1,'main',200,255,0],[2,'main',285,255,0],[3,'left',135,485,1],[4,'right',390,485,1],[5,'right',390,485,1]])Object.assign(g.tiles[id],{zone:'board',pile,x,y,z:id,type});
   document.getElementById('board').replaceChildren();scrollProbe.render();const rect=document.getElementById('board').getBoundingClientRect();scrollTo(0,scrollY+rect.top-10);
  });await page.waitForTimeout(150);
  const measure=()=>page.evaluate(()=>{const board=document.getElementById('board').getBoundingClientRect(),rack=document.getElementById('rack').getBoundingClientRect();return{scroll:scrollY,board:board.top,rack:rack.top,controls:document.querySelector('.expedition-controls').getBoundingClientRect().height};});
  const before=await measure();
  const stable=async label=>{const after=await measure();for(const key of Object.keys(before))assert.ok(Math.abs(after[key]-before[key])<1,`${width}/${language} ${label}: ${key} moved ${after[key]-before[key]}px`);};
  const tap=async id=>{const rect=await page.locator(`#board [data-id="${id}"]`).boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=760,'test tap must already be visible');await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);await page.waitForTimeout(100);};
  await tap(1);await stable('last main tile');await tap(2);await page.locator('#reward-skip').waitFor();await stable('reward with only bottom piles left');
  await page.locator('#reward-skip').click();await stable('close reward');
  for(const id of [3,5,4]){await tap(id);await stable('bottom pile '+id);}
  await page.locator('#stage-next').waitFor();await stable('stage cleared');assert.equal(await page.evaluate(()=>scrollProbe.game().status),'won');
  await page.locator('#close-modal').click();await stable('close stage dialog');
  // The ten-stage record button can appear without adding another control row.
  await page.evaluate(()=>{document.getElementById('expedition-ten').hidden=false;});await stable('ten-stage button');
  await page.touchscreen.tap(10,10);await page.mouse.wheel(0,150);await page.waitForTimeout(200);assert.ok((await measure()).scroll>before.scroll,'normal scrolling remains available');
  assert.deepEqual(errors,[]);console.log(`PASS: ${width}/${language} main-to-supply, reward, final pile taps, victory and record button stay within 1px; user scrolling works.`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
