// Real mouse hit testing after blast shakes and stage landings; no modal workaround.
'use strict';
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 }, reducedMotion: 'no-preference' }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
  await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
  await page.route('**/expedition.js*', async route => {
   const response = await route.fetch();
   await route.fulfill({ response, body: await response.text() + '\nconst Base = RainExpedition.Expedition; RainExpedition.Expedition = class extends Base { constructor() { super(); window.testGame = this; } };' });
  });
  await page.goto(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/');
  await page.locator('[data-reward=ukulele]').click();
  const clickTile = async id => {
   const tile = page.locator(`#board [data-id="${id}"]`);
   await tile.scrollIntoViewIfNeeded();
   const rect = await tile.boundingBox(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
   assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#board button')?.dataset.id, { x, y }), String(id), 'visible tile is the mouse hit target');
   const moves = await page.evaluate(() => testGame.moves);
   await page.mouse.click(x, y); // No Playwright click retry, force or synthetic DOM event.
   assert.equal(await page.evaluate(() => testGame.moves), moves + 1, 'first mouse click commits');
  };
  const noLiveTransform = () => page.evaluate(() => {
   const live = document.querySelector('#board');
   return getComputedStyle(live).transform === 'none' && !document.getAnimations().some(a => a.effect?.target === live);
  });
  for (let round = 0; round < 4; round++) {
   const ids = await page.evaluate(() => {
    const g = testGame, offset = g.tiles.length - 12;
    g.relics = { behemoth: 1 }; g.equipment = null; g.charge = 0; g.energy = 0;
    g.blastCharge = 3; g.pendingReward = null; g.midRewardTaken = true; g.previous = null;
    g.tiles.forEach((tile, id) => Object.assign(tile, { type: Math.floor((id - offset + 144) / 3) % 12, x: (id - offset + 144) % 6 * 80, y: Math.floor((id - offset + 144) % 12 / 6) * 80, z: 0, pile: 'main', zone: id < offset ? 'matched' : 'board' }));
    g.cleared = offset; g.manualMatches = offset / 3; g.stageMatches = 0; g.rack = []; g.reserve = []; g.status = 'playing';
    document.getElementById('board').replaceChildren(); return [offset, offset + 1, offset + 2];
   });
   await page.locator('#language').click();
   for (const id of ids) await clickTile(id);
   await page.locator('.fx-blast-core').first().waitFor();
   assert.ok(await noLiveTransform(), 'blast only transforms its visual copy');
   assert.equal(await page.locator('.fx-layer').evaluate(el => el.inert), true);
   await page.waitForFunction(() => !document.querySelector('.fx-layer > *') && document.querySelector('#board button:enabled'));
   assert.equal(await page.locator('#board').evaluate(el => getComputedStyle(el).opacity), '1');
   // Click immediately after the blast, then finish this stage via real controls.
   while (await page.evaluate(() => testGame.status === 'playing')) {
    const id = await page.evaluate(() => testGame.available().sort((a, b) => a.type - b.type)[0].id);
    await clickTile(id);
   }
   await page.locator('#stage-next').click();
   await page.locator('[data-reward]').first().click();
   await page.locator('#stage-next').click();
   await page.locator('.fx-surface').waitFor();
   assert.ok(await noLiveTransform(), 'stage landing only transforms its visual copy');
   if (!round) {
    await page.waitForTimeout(850);
    await page.screenshot({ path: '/tmp/clackworks-stage-surface.png' });
   }
   await page.waitForFunction(() => !document.querySelector('.fx-layer > *') && document.querySelector('#board button:enabled'));
   const first = await page.evaluate(() => testGame.available()[0].id);
   await clickTile(first);
   // Tool controls also respond on the first click after the transition.
   if (!round) {
    const tool = page.locator('#shuffle'); await tool.scrollIntoViewIfNeeded(); const rect = await tool.boundingBox();
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    assert.equal(await page.evaluate(() => testGame.used.shuffle), true);
    await page.waitForFunction(() => document.querySelector('#board button:enabled'));
   }
  }
  // Interrupt an incoming visual copy: the real surface is revealed immediately.
  await page.evaluate(() => { window.landing = RainEffects.restart(null); RainEffects.reset(); });
  await page.evaluate(() => landing);
  assert.equal(await page.locator('#board').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.fx-layer > *').count(), 0);
  assert.ok(await noLiveTransform());
  await clickTile(await page.evaluate(() => testGame.available()[0].id));
  assert.deepEqual(errors, []);
  console.log('PASS: desktop Chrome real mouse hits after four blast/next-stage cycles, no transformed live board, tools responsive, inert visual copies and interrupted landing cleanup. Scores and Presence mocked.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
