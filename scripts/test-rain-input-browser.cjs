// Fault injection for the input gate. Network scores and Presence are mocked.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    await page.route('**/expedition.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + '\nconst Base = RainExpedition.Expedition; RainExpedition.Expedition = class extends Base { constructor() { super(); window.testGame = this; } static fromSave(data) { const game = Base.fromSave(data); window.testGame = game; return game; } };' });
    });
    const base = process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/rain_match/';
    const fresh = async () => { await page.goto(base + '?mode=rain'); await page.locator('#board button:enabled').first().waitFor(); };
    const playable = () => page.waitForFunction(() => document.querySelector('#board button:enabled'), null, { timeout: 6500 });
    for (const fault of ['throw', 'reject', 'hang', 'native-throw', 'native-hang']) {
      await fresh();
      await page.evaluate(fault => {
        if (fault === 'throw') RainEffects.power = () => { throw Error('injected renderer failure'); };
        if (fault === 'reject') RainEffects.power = () => Promise.reject(Error('injected rejected animation'));
        if (fault === 'hang') RainEffects.power = () => new Promise(() => {});
        if (fault.startsWith('native-')) Element.prototype.animate = fault === 'native-throw'
          ? () => { throw Error('injected native animation failure'); }
          : () => ({ finished: new Promise(() => {}), cancel() {} });
      }, fault);
      await page.locator('#shuffle').click();
      await playable();
      assert.equal(await page.locator('.fx-layer > *').count(), 0, fault + ' cleans up FX');
      await page.locator('#board button:enabled').first().click();
      assert.equal(await page.locator('#rack .tile').count(), 1, fault + ' accepts next pick');
      assert.ok(await page.locator('#shuffle').isDisabled(), 'consumed tool stays consumed');
    }
    // Suspending during an unfinished animation releases input on return.
    await fresh();
    await page.evaluate(() => { RainEffects.power = () => new Promise(() => {}); });
    await page.locator('#shuffle').click();
    assert.equal(await page.locator('#board button:enabled').count(), 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await playable();
    // Completion from a replaced run must not unlock the current restart.
    await fresh();
    await page.evaluate(() => {
      RainEffects.power = () => new Promise(resolve => { window.finishOld = resolve; });
      RainEffects.restart = () => new Promise(resolve => { window.finishNew = resolve; });
    });
    await page.locator('#shuffle').click(); await page.locator('#restart').click();
    await page.evaluate(() => finishOld());
    assert.equal(await page.locator('#board button:enabled').count(), 0);
    await page.evaluate(() => finishNew()); await playable();
    // A real expedition skill commits once even if its visual effect fails.
    await fresh(); await page.locator('[data-mode=expedition]').click();
    await page.locator('[data-reward=feather]').click();
    await page.evaluate(() => { RainEffects.relic = () => { throw Error('injected relic failure'); }; });
    await page.locator('#expedition-feather').click();
    const id = Number(await page.locator('.feather-target').first().getAttribute('data-id'));
    await page.locator('.feather-target').first().click(); await playable();
    const beforeReload = await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)));
    assert.equal(beforeReload.game.featherCharge, 0);
    assert.equal(beforeReload.game.moves, 1);
    assert.ok(beforeReload.game.rack.includes(id));
    await page.goto(base); await page.locator('#resume-confirm').click();
    assert.deepEqual(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)).game), beforeReload.game);
    assert.deepEqual(errors, []);
    console.log('PASS: thrown/rejected/hung FX, native animation failures, suspended tab, stale run completion, next pick, one-time tool consumption and expedition checkpoint continuity.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
