'use strict';
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH, headless: true });
  try {
    for (const width of [320, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.routeWebSocket(/\/realtime\/v1\//, s => s.close());
      await page.route('https://www.googletagmanager.com/**', r => r.fulfill({ body: '' }));
      await page.route('**/rest/v1/rpc/*', r => r.fulfill({ json: { entries: [], total: 0 } }));
      const url = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/critter-cascade/');
      url.searchParams.set('mode', 'drizzle');
      await page.goto(url.href);
      await page.locator('#board button:enabled').first().waitFor();
      const cdp = await page.context().newCDPSession(page);
      const gesture = async (x, y, dy) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 8; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * step / 8 }] });
          await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(250);
      };
      const locate = async selector => {
        await page.locator(selector).first().evaluate(el => window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 300));
        await page.waitForTimeout(100);
        const r = await page.locator(selector).first().boundingBox();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
      // Positive control: the previous manipulation policy allows the same
      // physical finger drift to scroll. This tests native gestures, not wheel.
      const oldPolicy = await page.addStyleTag({ content: '#board { touch-action: manipulation !important; }' });
      let p = await locate('#board [data-pile=left]:enabled');
      let before = await page.evaluate(() => scrollY);
      await gesture(p.x, p.y, -70);
      assert.ok((await page.evaluate(() => scrollY)) > before + 15, 'old touch policy must reproduce accidental panning');
      await oldPolicy.evaluate(el => el.remove());
      for (const selector of ['#board [data-pile=main]:enabled', '#board [data-pile=left]:enabled', '#board [data-pile=right]:enabled', '#shuffle']) {
        p = await locate(selector);
        for (const dy of [-70, 70]) {
          before = await page.evaluate(() => scrollY);
          await gesture(p.x, p.y, dy);
          assert.ok(Math.abs((await page.evaluate(() => scrollY)) - before) < 1, `${width}: ${selector} drift ${dy} scrolled the page`);
        }
      }
      // Repeated short drifts still activate supply tiles and never pan.
      for (let n = 0; n < 3; n++) {
        p = await locate('#board [data-pile=left]:enabled');
        before = await page.evaluate(() => scrollY);
        await gesture(p.x, p.y, -3);
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - before) < 1, 'slightly sliding taps must stay in place');
        assert.equal(await page.locator('#board .tile[data-pile=left]').count(), 5 - n);
      }
      // A real swipe in the page margin still scrolls in both directions.
      for (const dy of [-100, 100]) {
        before = await page.evaluate(() => scrollY);
        await gesture(3, 400, dy);
        const delta = (await page.evaluate(() => scrollY)) - before;
        assert.ok(dy < 0 ? delta > 20 : delta < -20, 'page margin must retain ordinary touch scrolling');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: old policy reproduces panning; main/supply/tool gestures stay still; sliding taps work; page-margin touch scrolling remains available.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
