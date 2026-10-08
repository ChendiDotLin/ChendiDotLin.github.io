// All remote leaderboard calls are mocked; fixtures use real reward generation.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    await page.route('**/expedition.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + '\nconst Base = RainExpedition.Expedition; RainExpedition.Expedition = class extends Base { constructor() { super(); window.testGame = this; } static fromSave(data) { const game = Base.fromSave(data); window.testGame = game; return game; } };' });
    });
    const url = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/');
    url.searchParams.set('mode', 'rain');
    await page.goto(url.href);
    await page.locator('#board button:enabled').first().waitFor();
    const contrast = await page.evaluate(() => {
      const covered = document.querySelector('#board .blocked:not(.blind)');
      const available = document.querySelector('#board button:enabled');
      return { covered: getComputedStyle(covered).filter, disabled: covered.disabled, available: getComputedStyle(available).filter,
        blend: getComputedStyle(available.querySelector('img')).mixBlendMode,
        blind: getComputedStyle(document.querySelector('#board .blind img')).visibility };
    });
    assert.equal(contrast.covered, 'brightness(0.55) saturate(0.18)');
    assert.equal(contrast.disabled, true); assert.equal(contrast.available, 'none');
    assert.equal(contrast.blend, 'normal'); assert.equal(contrast.blind, 'hidden');
    await page.screenshot({ path: '/tmp/rain-contrast-phone.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 950 });
    await page.screenshot({ path: '/tmp/rain-contrast-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-mode=expedition]').click();
    await page.locator('[data-reward=blackhole]').click();
    await page.evaluate(() => {
      const g=testGame, b=new RainMatch.Game('rain',Math.random,RainExpedition.stageSpec(21));
      for(const key of ['tiles','rack','reserve','cleared','moves','status','previous','solution'])g[key]=b[key];
      g.stage=21;g.banked=RainExpedition.bankedBefore(21);g.competitive=false;
      g.relics={behemoth:4,clover:4,echo:4,blackhole:1};g.equipment='blackhole';g.rngState=1;g.offerReward();document.getElementById('board').replaceChildren();
    });
    await page.locator('#language').click();
    await page.locator('#expedition-continue').click();
    const choice = page.locator('[data-reward][data-rarity=legendary]');
    assert.equal(await choice.count(), 1);
    assert.match(await choice.locator('small').textContent(), /Mythic/);
    assert.match(await page.locator('#modal-content').textContent(), /25%/);
    const offered = await page.locator('[data-reward]').evaluateAll(buttons => buttons.map(button => button.dataset.reward));
    const red = await choice.getAttribute('data-reward');
    await page.locator('#modal-language').click();
    assert.match(await choice.locator('small').textContent(), /红色/);
    await page.screenshot({ path: '/tmp/rain-rarity-phone.png', fullPage: true });
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('#modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    }
    await page.reload(); await page.locator('[data-mode=expedition]').click(); await page.locator('#resume-confirm').click();
    await page.locator(`[data-reward="${red}"]`).waitFor();
    assert.deepEqual(await page.locator('[data-reward]').evaluateAll(buttons => buttons.map(button => button.dataset.reward)), offered);
    await page.locator(`[data-reward="${red}"]`).click();
    assert.equal(await page.evaluate(id => testGame.relics[id], red), 5);
    assert.ok(await page.locator('#board button:enabled').count());
    // One loadout displays all five level-dependent rarity frames.
    await page.evaluate(() => {
      testGame.relics = { gasoline: 1, feather: 2, shield: 3, behemoth: 5, blackhole: 4 };
      testGame.equipment = 'blackhole'; testGame.charge = 1;
    });
    await page.locator('#language').click();
    const frames = await page.locator('.relic-chip').evaluateAll(chips => chips.map(el => ({
      rarity: el.dataset.rarity, color: getComputedStyle(el).borderLeftColor,
      portrait: el.querySelector('.relic-portrait').dataset.rarity, text: el.innerText
    })));
    assert.equal(new Set(frames.map(item => item.color)).size, 5, 'five distinct equipment frames');
    assert.ok(frames.every(item => item.rarity === item.portrait));
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => scrollTo(0, 0));
      if (width !== 320) await page.screenshot({ path: `/tmp/rain-gear-${width}.png`, fullPage: true });
    }
    await page.locator('[data-relic=behemoth]').click();
    assert.equal(await page.locator('.rarity-badge[data-rarity=legendary]').count(), 1);
    await page.locator('#modal-language').click();
    assert.match(await page.locator('.rarity-badge').innerText(), /红色|Mythic/);
    await page.locator('#relic-close').click();
    assert.deepEqual(errors, []);
    console.log('PASS: covered-vs-playable contrast, hidden stacks, bilingual rarity and odds, real legendary selection, stable saved offers, and mobile/desktop layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
