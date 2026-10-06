// Landing-mode integration checks. Leaderboards are mocked; no scores are sent.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [], reads = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/rest/v1/rpc/*', route => {
      assert.ok(!route.request().url().includes('submit'));
      reads.push(route.request().postDataJSON());
      return route.fulfill({ json: { entries: [], total: 0 } });
    });
    await context.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    const page = await context.newPage();
    const url = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/');
    url.searchParams.delete('mode');
    const saved = () => page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)));
    const defaults = async target => {
      assert.equal(await target.locator('[data-mode=expedition]').getAttribute('aria-pressed'), 'true');
      assert.equal(await target.locator('[data-leaderboard-mode=expedition]').getAttribute('aria-pressed'), 'true');
      assert.equal(await target.locator('[data-exp-board=expedition_distance]').getAttribute('aria-pressed'), 'true');
      assert.match(await target.locator('#mode-title').textContent(), /远征|Expedition/);
    };
    await page.goto(url.href);
    await page.locator('[data-reward=feather]').waitFor();
    await defaults(page);
    assert.ok(reads.length > 0 && reads.every(request => request.p_board === 'distance'));
    await page.locator('[data-reward=feather]').click();
    await page.locator('#board button:enabled').first().click();
    const before = await saved();
    await page.reload(); await page.locator('#resume-confirm').waitFor();
    await defaults(page);
    assert.equal((await saved()).runId, before.runId);
    assert.deepEqual((await saved()).game, before.game);
    await page.locator('#close-modal').click();
    assert.equal(await page.locator('#board button:enabled').count(), 0);
    assert.ok(await page.locator('#resume-banner').isVisible());
    await page.locator('#resume-expedition').click();
    await page.locator('#resume-confirm').click();
    await page.locator('#board button:enabled').first().waitFor();
    assert.deepEqual((await saved()).game, before.game);
    assert.ok(await page.locator('#board button:enabled').count());
    // Another tab must remain paused, with Expedition selected, while locked.
    const second = await context.newPage(); await second.goto(url.href);
    await second.locator('#resume-confirm').click();
    await second.locator('#save-lock-retry').waitFor();
    await defaults(second);
    assert.equal(await second.locator('#board button:enabled').count(), 0);
    await second.close();
    // Explicit classic links still bypass the Expedition startup dialog.
    for (const mode of ['drizzle', 'rain', 'monsoon']) {
      url.searchParams.set('mode', mode); await page.goto(url.href);
      await page.locator('#board button:enabled').first().waitFor();
      assert.equal(await page.locator(`[data-mode="${mode}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`[data-leaderboard-mode="${mode}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal((await saved()).runId, before.runId);
    }
    url.searchParams.set('mode', 'unknown'); await page.goto(url.href);
    await page.locator('#resume-confirm').waitFor(); await defaults(page);
    await page.locator('#resume-confirm').click();
    await page.locator('#board button:enabled').first().waitFor();
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.screenshot({ path: '/tmp/rain-default-desktop.png', fullPage: true });
    await context.close();
    const ephemeral = await browser.newContext({ reducedMotion: 'reduce' });
    await ephemeral.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    await ephemeral.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    await ephemeral.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    const fresh = await ephemeral.newPage(); fresh.on('pageerror', error => errors.push(error.message));
    url.searchParams.delete('mode'); await fresh.goto(url.href);
    await fresh.locator('[data-reward=feather]').click();
    await defaults(fresh); assert.ok(await fresh.locator('#board button:enabled').count());
    assert.deepEqual(errors, []);
    console.log('PASS: default Expedition and distance leaderboard without Rain requests, preserved save/resume, dismissed resume stays paused, multi-tab lock, explicit classic links, unknown-link fallback, responsive layouts and unavailable storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
