// Uses mocked rankings/Presence; never writes player scores.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const URL = process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH, headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    await context.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    await context.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    await context.route('**/expedition.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `
        const Base = RainExpedition.Expedition;
        RainExpedition.Expedition = class extends Base {
          constructor() { super(() => .37); window.testGame = this; }
          static fromSave(data) { const game = Base.fromSave(data); window.testGame = game; return game; }
        };` });
    });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(URL);
    assert.equal(await page.locator('#reward-skip').count(), 0);
    await page.locator('[data-reward=feather]').click();
    // Set up a legal full-slot loadout, then play to the real mid-stage supply.
    await page.evaluate(() => {
      testGame.relics = { feather: 1, shield: 1, cell: 1, clover: 1, turbine: 1, recycler: 1, blackhole: 1 };
      testGame.equipment = 'blackhole'; testGame.charge = 0;
      testGame.offerReward = function () { this.pendingReward = ['gasoline', 'prism', 'resin']; this.previous = null; };
    });
    const solution = await page.evaluate(() => testGame.solution);
    let cursor = 0;
    while (!await page.evaluate(() => !!testGame.pendingReward)) {
      await page.locator(`#board [data-id="${solution[cursor++]}"]`).click();
    }
    const gear = await page.evaluate(() => testGame.relics);
    await page.locator('[data-reward=gasoline]').click();
    await page.locator('[data-replace]').first().waitFor();
    assert.match(await page.locator('#reward-skip').textContent(), /跳过/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#reward-skip').click();
    await page.locator('#language').click();
    assert.deepEqual(await page.evaluate(() => testGame.relics), gear);
    const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem(RainSave.KEY)));
    assert.equal(checkpoint.game.pendingReward, null);
    assert.equal(checkpoint.game.previous, null);
    await page.reload(); await page.locator('#resume-confirm').click();
    assert.deepEqual(await page.evaluate(() => testGame.relics), gear);
    assert.equal(await page.locator('#reward-skip').count(), 0);
    // Continue after reload; the press may clear the last tiles automatically.
    for (; cursor < solution.length; cursor++) {
      const id = solution[cursor];
      if (await page.evaluate(id => testGame.tiles[id].zone === 'board', id)) {
        await page.locator(`#board [data-id="${id}"]`).click();
      }
    }
    await page.locator('#stage-next').click();
    assert.match(await page.locator('#reward-skip').textContent(), /Skip/);
    await page.locator('#reward-skip').click();
    await page.reload(); await page.locator('#resume-confirm').click();
    assert.equal(await page.locator('#reward-skip').count(), 0);
    await page.locator('#stage-next').click();
    await page.waitForFunction(() => testGame.stage === 2 && document.querySelector('#board button:not(:disabled)'));
    assert.deepEqual(await page.evaluate(() => testGame.relics), gear);
    await page.locator('#board button:not(:disabled)').first().click();
    assert.equal(await page.evaluate(() => testGame.moves), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: full-slot replacement skip, bilingual phone UI, unchanged loadout, reload after both skips, next-stage clicks. All network writes mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
