// Exercise failures around real committed actions, not just animation promises.
// Leaderboard writes and Presence are mocked; served game scripts are used.
'use strict';
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 950 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    await page.route('**/expedition.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + '\nconst Base = RainExpedition.Expedition; RainExpedition.Expedition = class extends Base { constructor() { super(); window.testGame = this; } };' });
    });
    const url = process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/critter-cascade/';
    const fresh = async () => {
      await page.goto(url);
      if (await page.locator('#resume-new').count()) await page.locator('#resume-new').click();
      await page.locator('[data-reward=ukulele]').click();
      await page.waitForFunction(() => document.querySelector('#board button:enabled'));
    };
    for (const fault of ['startup-render', 'completion-render', 'cleanup']) {
      await fresh();
      await page.evaluate(fault => {
        const failRenderOnce = () => {
          const available = testGame.available;
          testGame.available = function () { this.available = available; throw Error('injected HUD failure'); };
        };
        if (fault === 'startup-render') {
          const use = testGame.use;
          testGame.use = function (tool) { const result = use.call(this, tool); failRenderOnce(); return result; };
        } else if (fault === 'completion-render') {
          const power = RainEffects.power;
          RainEffects.power = async (...args) => { await power(...args); failRenderOnce(); };
        } else {
          RainEffects.power = () => new Promise(() => {});
          const reset = RainEffects.reset;
          RainEffects.reset = () => { reset(); throw Error('injected cleanup failure'); };
        }
      }, fault);
      await page.locator('#shuffle').click();
      await page.waitForFunction(() => document.querySelector('#board button:enabled'), null, { timeout: 6000 });
      assert.equal(await page.locator('.fx-layer > *').count(), 0, fault);
      await page.locator('#board button:enabled').first().click();
      assert.equal(await page.evaluate(() => testGame.moves), 1, fault + ': next pick commits once');
      assert.equal(await page.evaluate(() => testGame.used.shuffle), true);
      assert.ok(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY))), fault + ': saved run remains valid');
    }
    // Real lightning crosses the supply threshold. Failure while building the
    // reward dialog must not leave every card/tool disabled with no way forward.
    await fresh();
    await page.evaluate(() => {
      const g = testGame;
      g.tiles = Array.from({ length: 36 }, (_, id) => ({ id, type: Math.floor(id / 3), x: id % 6 * 80, y: Math.floor(id / 6) * 75, z: 0, pile: 'main', zone: id < 6 ? 'matched' : 'board' }));
      g.cleared = 6; g.manualMatches = 2; g.stageMatches = 2; g.spark = 3;
      document.getElementById('board').replaceChildren();
      const translate = RainI18n.translate;
      let failed = false;
      RainI18n.translate = (...args) => {
        if (!failed && args[1] === 'expRewardTitle') { failed = true; throw Error('injected reward rendering failure'); }
        return translate(...args);
      };
    });
    await page.locator('#language').click();
    for (const id of [6, 7, 8]) await page.locator(`#board [data-id="${id}"]`).click();
    await page.locator('[data-reward]').first().waitFor({ timeout: 6000 });
    assert.equal(await page.evaluate(() => testGame.stageMatches), 3);
    assert.equal(await page.evaluate(() => testGame.cleared), 12);
    assert.equal(await page.locator('.fx-layer > *').count(), 0);
    await page.locator('[data-reward]').first().click();
    await page.locator('#board button:enabled').first().click();
    assert.equal(await page.evaluate(() => testGame.moves), 4);
    assert.ok(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY))));
    assert.deepEqual(errors, []);
    console.log('PASS: HUD startup/completion failures, throwing cleanup, real lightning→supply transition failure, next input, single action/tool consumption and valid saves. Scores and Presence mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
