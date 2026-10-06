// Visual lifecycle checks; all leaderboard requests are mocked, no scores written.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    const url = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/rain_match/');
    url.searchParams.set('mode', 'rain');
    await page.goto(url.href);
    await page.locator('#board button:enabled').first().waitFor();
    await page.evaluate(() => {
      window.startEffect = (kind, dense = false) => {
        RainEffects.reset();
        const before = RainEffects.snapshot();
        const ids = dense ? [...before.keys()] : [...document.querySelectorAll('#board button:enabled')].slice(0, 3).map(el => Number(el.dataset.id));
        const events = [];
        for (let i = 0; i + 2 < ids.length; i += 3) events.push({ kind: dense ? ['behemoth', 'gasoline', 'ukulele'][i / 3 % 3] : kind, ids: ids.slice(i, i + 3) });
        // Visually match the controller, which removes recovered cards before FX.
        ids.forEach(id => { const tile = document.querySelector(`#board [data-id="${id}"]`); if (tile) tile.style.visibility = 'hidden'; });
        window.effectDone = false;
        window.effectPromise = RainEffects.relic(events, before, ids.length + 3).then(() => { window.effectDone = true; });
        return { total: ids.length + 3, events: events.length };
      };
      window.fxAnimations = () => document.getAnimations().filter(animation => {
        const target = animation.effect?.target;
        return target?.closest('.fx-layer') || ['board', 'rack'].includes(target?.id);
      });
    });
    for (const [kind, selector] of [['behemoth', '.fx-blast-core'], ['gasoline', '.fx-flame'], ['ukulele', '.fx-lightning']]) {
      await page.evaluate(kind => startEffect(kind), kind);
      assert.equal(await page.locator(selector).count(), 3);
      assert.equal(await page.locator('.fx-chain-count').last().textContent(), '+6');
      await page.evaluate(() => fxAnimations().forEach(a => { a.pause(); a.effect.updateTiming({ fill: 'both' }); a.currentTime = 380; }));
      await page.screenshot({ path: `/tmp/rain-fx-${kind}.png`, fullPage: true });
      await page.evaluate(async () => { fxAnimations().forEach(a => a.finish()); await effectPromise; });
      assert.equal(await page.locator('.fx-layer > *').count(), 0);
      await page.evaluate(() => document.querySelectorAll('#board .tile').forEach(el => el.style.removeProperty('visibility')));
    }
    const dense = await page.evaluate(() => startEffect('behemoth', true));
    assert.ok(dense.events >= 30);
    assert.equal(await page.locator('.fx-chain-count').last().textContent(), `+${dense.total}`);
    assert.ok(await page.locator('.fx-layer > *').count() < 600);
    assert.ok(await page.evaluate(() => fxAnimations().every(a => a.effect.getComputedTiming().endTime <= 3100)));
    await page.evaluate(() => fxAnimations().forEach(a => { a.pause(); a.effect.updateTiming({ fill: 'both' }); a.currentTime = 850; }));
    await page.screenshot({ path: '/tmp/rain-fx-chain-phone.png', fullPage: true });
    await page.evaluate(async () => { RainEffects.reset(); await effectPromise; });
    assert.equal(await page.locator('.fx-layer > *').count(), 0);
    assert.equal(await page.locator('#board').evaluate(el => getComputedStyle(el).transform), 'none');
    assert.equal(await page.locator('#rack').evaluate(el => getComputedStyle(el).transform), 'none');
    // Changing accessibility preference mid-burst must settle the input gate.
    await page.evaluate(() => startEffect('behemoth', true));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => effectDone);
    assert.equal(await page.locator('.fx-layer > *').count(), 0);
    await page.evaluate(async () => { startEffect('behemoth', true); await effectPromise; });
    assert.equal(await page.locator('.fx-layer > *').count(), 0);
    assert.equal(await page.locator('.fx-layer').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Let the preference-change reset run before starting the desktop preview.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => { document.querySelectorAll('#board .tile').forEach(el => el.style.removeProperty('visibility')); startEffect('behemoth'); fxAnimations().forEach(a => { a.pause(); a.effect.updateTiming({ fill: 'both' }); a.currentTime = 380; }); });
    assert.equal(await page.locator('.fx-blast-core').count(), 3);
    await page.screenshot({ path: '/tmp/rain-fx-blast-desktop.png', fullPage: true });
    await page.evaluate(async () => { RainEffects.reset(); await effectPromise; });
    assert.deepEqual(errors, []);
    console.log('PASS: distinct blast/fire/lightning impacts, accurate chain count, bounded dense timeline and DOM, completed and interrupted cleanup, reduced motion, and phone/desktop layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
