// Uses real Supabase Presence in a unique temporary channel, never the public
// player-count channel. All leaderboard calls are mocked; no scores are written.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
  const room = 'rain-match-presence-test-' + crypto.randomUUID(), errors = [], contexts = [];
  try {
    async function context(blockSDK = false) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); contexts.push(ctx);
      ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      await ctx.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
      await ctx.route('**/presence.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + `\nconst BasePresence = RainPresence.Presence; RainPresence.Presence = class extends BasePresence { constructor(config, options) { super(config, {...options, channelName: ${JSON.stringify(room)}}); window.testPresence = this; } };` });
      });
      if (blockSDK) await ctx.route('**/vendor/supabase-*.js', route => route.abort());
      return ctx;
    }
    const url = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/'); url.searchParams.delete('mode');
    const classic = new URL(url); classic.searchParams.set('mode', 'rain');
    const counts = async (page, total, expedition, timeout = 20000) => {
      try { await page.waitForFunction(([n, e]) => document.querySelector('#presence-status').dataset.state === 'ready' && JSON.stringify(document.querySelector('#presence-text').textContent.match(/\d+/g)?.map(Number)) === JSON.stringify([n, e]), [total, expedition], { timeout }); }
      catch (error) { console.error(await page.evaluate(() => ({ text: document.querySelector('#presence-text').textContent, sdk: typeof window.supabase?.createClient, connected: window.testPresence?.connected, tracked: window.testPresence?.tracked, channel: window.testPresence?.channel?.state, stateKeys: Object.keys(window.testPresence?.channel?.presenceState() || {}).length })), errors); throw error; }
    };
    const visible = (page, value) => page.evaluate(value => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => !value }); document.dispatchEvent(new Event('visibilitychange')); }, value);
    const first = await context(), a = await first.newPage(); await a.goto(url.href);
    await a.locator('[data-reward=feather]').click(); await counts(a, 1, 1);
    const second = await context(), b = await second.newPage(); await b.goto(classic.href);
    await counts(a, 2, 1); await counts(b, 2, 1);
    const duplicate = await first.newPage(); await duplicate.goto(classic.href);
    await counts(duplicate, 2, 1);
    assert.equal(await a.evaluate(() => testPresence.visitorId), await duplicate.evaluate(() => testPresence.visitorId));
    assert.notEqual(await a.evaluate(() => testPresence.visitorId), await b.evaluate(() => testPresence.visitorId));
    await visible(a, false); await counts(b, 2, 0);
    await visible(duplicate, false); await counts(b, 1, 0);
    await visible(a, true); await counts(a, 2, 1);
    await b.locator('[data-mode=expedition]').click(); await b.locator('[data-reward=feather]').click();
    await counts(a, 2, 2); await counts(b, 2, 2);
    await duplicate.close();
    await first.setOffline(true); await a.evaluate(() => window.dispatchEvent(new Event('offline')));
    assert.equal(await a.locator('#presence-status').getAttribute('data-state'), 'unavailable');
    assert.ok(!(await a.locator('#presence-text').textContent()).includes('0'));
    // A severed network cannot deliver a leave; wait for server heartbeat expiry.
    const disconnectedAt = Date.now(); await counts(b, 1, 1, 75000);
    console.log(`Abrupt disconnect propagated in ${Math.round((Date.now() - disconnectedAt) / 1000)} seconds.`);
    await first.setOffline(false); await a.evaluate(() => window.dispatchEvent(new Event('online')));
    await counts(a, 2, 2);
    await a.locator('#language').click(); assert.match(await a.locator('#presence-text').textContent(), /2 online.*2 in Expedition/);
    await a.screenshot({ path: '/tmp/rain-presence-phone.png', fullPage: true });
    for (const width of [320, 390, 1366]) { await a.setViewportSize({ width, height: 900 }); assert.ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
    await a.setViewportSize({ width: 1366, height: 1300 });
    await a.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await a.screenshot({ path: '/tmp/rain-presence-desktop.png' });
    await a.close(); await counts(b, 1, 1);
    const offline = await context(true), c = await offline.newPage(); await c.goto(url.href);
    await c.locator('[data-reward=feather]').click();
    assert.equal(await c.locator('#presence-status').getAttribute('data-state'), 'unavailable');
    await c.locator('#board button:enabled').first().click();
    assert.equal(await c.locator('#rack .tile').count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: real isolated Presence join/leave, two browsers and duplicate tabs, mode changes, hidden pages, disconnect/reconnect, bilingual responsive display and gameplay with SDK unavailable. No public counts or leaderboard rows changed.');
  } finally { for (const ctx of contexts) await ctx.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
