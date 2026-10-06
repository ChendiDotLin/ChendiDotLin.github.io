// Reskin coverage: all art, legacy saved IDs, bilingual names, audio lifecycle.
// Remote leaderboard requests and public Presence are mocked.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
    await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
    await page.addInitScript(() => {
      const Base = window.AudioContext;
      window.AudioContext = class extends Base { constructor(...args) { super(...args); window.testAudio = this; } };
    });
    const url = process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/rain_match/';
    await page.goto(url);
    await page.locator('[data-reward=feather]').click();
    assert.equal(await page.evaluate(() => !!window.testAudio), false, 'music never autoplays');
    const assets = await page.evaluate(async () => {
      const paths = [...RainMatch.ITEMS, ...Object.values(RainExpedition.RELICS)].map(item => `assets/characters/${item.icon}.webp`);
      for (const src of paths) { const image = new Image(); image.src = src; await image.decode(); if (!image.naturalWidth) throw Error(src); }
      return paths;
    });
    assert.equal(new Set(assets).size, 21);
    await page.locator('#board button:enabled').first().click();
    const saved = await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)));
    assert.equal(saved.game.relics.feather, 1);
    await page.reload(); await page.locator('#resume-confirm').click();
    assert.deepEqual(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)).game), saved.game);
    assert.match(await page.locator('#relic-bar').innerText(), /伸缩抓手/);
    const banned = /Risk of Rain|RoR2|Hopoo|Ukulele|Behemoth|Clover|Petrichor|羊了个|霍普|巨兽|三叶草|虚空熊|燃料电池/;
    for (const lang of ['zh', 'en']) {
      if (lang === 'en') await page.locator('#language').click();
      const values = await page.evaluate(lang => Object.values(RainI18n.messages[lang]).flat().join('\n'), lang);
      assert.doesNotMatch(values, banned);
      for (const width of [320, 390, 1366]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} ${width}`);
      }
    }
    await page.locator('#sound').click();
    await page.locator('#music-toggle').click();
    await page.waitForFunction(() => document.querySelector('#music-toggle').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.evaluate(() => testAudio.state), 'running');
    assert.equal(await page.locator('iframe').count(), 0);
    // Verify actual non-silent synthesized samples, not just a pressed button.
    const audible = await page.evaluate(async () => {
      const synth = new RainMusic(); await synth.play();
      const analyser = synth.context.createAnalyser(); analyser.fftSize = 2048; synth.master.connect(analyser);
      await new Promise(resolve => setTimeout(resolve, 170));
      const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
      const result = data.some(sample => Math.abs(sample) > .0001);
      await synth.visibility(true); if (synth.context.state !== 'suspended') throw Error('background audio');
      await synth.visibility(false); if (synth.context.state !== 'running') throw Error('foreground audio');
      synth.stop(); if (synth.voices.size || synth.timer || synth.playing) throw Error('leaked audio');
      await synth.context.close(); return result;
    });
    assert.ok(audible);
    await page.locator('#music-toggle').click();
    assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('#music-toggle').click();
    await page.locator('#music-close').click();
    assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('#sound').click();
    assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'false', 'reopening is silent');
    await page.locator('#music-close').click();
    await page.locator('#credits').click();
    assert.match(await page.locator('#modal-content').innerText(), /original workshop characters/);
    await page.locator('#close-modal').click();
    assert.ok(!requests.some(url => /bandcamp|assets\/[^/]+\.webp(?:\?|$)/.test(url)));
    await page.setViewportSize({ width: 390, height: 1000 }); await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: '/tmp/rain-workshop-phone.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 1100 }); await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: '/tmp/rain-workshop-desktop.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: 21 original icons, stable saved game/gear, bilingual reskin, 320–1366px layouts, opt-in audible original music, pause/resume/stop and no third-party art/music requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
