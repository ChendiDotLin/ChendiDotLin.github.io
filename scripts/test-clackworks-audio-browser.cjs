// Recorded music lifecycle, credits, mix and URL migration; remote writes are mocked.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 950 }, reducedMotion: 'reduce' });
  const errors = [], audioRequests = []; page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/assets/audio/')) audioRequests.push(r.url()); });
  await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
  await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
  await page.route('**/music.js*', async route => {
   const response = await route.fetch();
   await route.fulfill({ response, body: await response.text() + '\nconst BaseMusic = RainMusic; window.RainMusic = class extends BaseMusic { constructor(...args) { super(...args); if (!window.testMix) window.testMix = this; } };' });
  });
  const origin = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/').origin;
  await page.goto(origin + '/clackworks/'); await page.locator('[data-reward=feather]').click();
  assert.equal(await page.evaluate(() => testMix.context), null);
  assert.equal(audioRequests.length, 0, 'no recording or retired piano bank loads before Play');
  assert.equal(await page.locator('[data-i18n="musicHint"]').count(), 0);
  await page.locator('#board button:enabled').first().click();
  const saved = await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)));
  await page.goto(origin + '/rain_match/?mode=expedition#resume');
  await page.waitForURL('**/clackworks/?mode=expedition#resume');
  await page.locator('#resume-confirm').click();
  assert.deepEqual(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)).game), saved.game);
  await page.locator('#sound').click();
  assert.equal(await page.locator('#music-title').innerText(), 'George Street Shuffle');
  assert.equal(audioRequests.length, 0, 'opening the panel is silent and does not fetch music');
  await page.locator('#music-toggle').click();
  await page.waitForFunction(() => testMix.track?.currentTime > .15 && document.getElementById('effects').getAttribute('aria-pressed') === 'true');
  assert.ok(audioRequests.every(url => url === origin + '/clackworks/assets/audio/george-street-shuffle.mp3'), 'only the selected local recording loads');
  const playback = await page.evaluate(async () => {
   const analyser = testMix.context.createAnalyser(); analyser.fftSize = 2048; testMix.master.connect(analyser);
   await new Promise(resolve => setTimeout(resolve, 160));
   const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
   testMix.master.disconnect(analyser); analyser.disconnect();
   return { audible: samples.some(n => Math.abs(n) > .0001), loop: testMix.track.loop, duration: testMix.track.duration, pitchUnchanged: testMix.track.playbackRate === 1 };
  });
  assert.ok(playback.audible && playback.loop && playback.pitchUnchanged);
  assert.ok(playback.duration > 260 && playback.duration < 280, 'the full four-minute recording is loaded');
  await page.evaluate(() => { const slider = document.getElementById('music-volume'); slider.value = '50'; slider.dispatchEvent(new Event('input')); });
  assert.deepEqual(await page.evaluate(() => [testMix.volume, testMix.effectsVolume]), [.5,.65]);
  await page.evaluate(() => testMix.chain(Array.from({ length: 40 }, (_, i) => ({ kind: ['behemoth','ukulele','gasoline'][i % 3] })), 120));
  assert.ok(await page.evaluate(() => testMix.effectVoices.size > 0 && testMix.effectVoices.size <= 80));
  await page.locator('#effects').click();
  assert.equal(await page.evaluate(() => testMix.effectVoices.size), 0);
  await page.locator('#music-toggle').click();
  const pausedAt = await page.evaluate(() => testMix.track.currentTime);
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(t => testMix.track.paused && Math.abs(testMix.track.currentTime - t) < .03, pausedAt));
  await page.locator('#music-toggle').click();
  await page.waitForFunction(t => testMix.track.currentTime > t + .1, pausedAt);
  assert.equal(await page.locator('#effects').getAttribute('aria-pressed'), 'false', 'explicit effects mute persists');
  const lifecycle = await page.evaluate(async () => {
   await testMix.visibility(true); const position = testMix.track.currentTime;
   await new Promise(resolve => setTimeout(resolve, 100));
   const hidden = testMix.context.state === 'suspended' && testMix.track.paused && Math.abs(testMix.track.currentTime-position) < .03 && !testMix.effectVoices.size;
   await testMix.visibility(false);
   return { hidden, resumed: testMix.context.state === 'running' && !testMix.track.paused && testMix.track.currentTime >= position - .03 };
  });
  assert.deepEqual(lifecycle, { hidden: true, resumed: true });
  // Actually pass the end, not merely inspect the loop flag.
  await page.evaluate(() => { testMix.track.currentTime = testMix.track.duration - .25; });
  await page.waitForFunction(() => testMix.track.currentTime < 3 && !testMix.track.paused, { }, { timeout: 10000 });
  await page.locator('#music-close').click();
  assert.ok(await page.evaluate(() => !testMix.playing && testMix.track.paused));
  await page.locator('#sound').click();
  assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'false');

  // Failed loads expose a retryable UI error; retry must restore real playback.
  const trackPattern = '**/assets/audio/george-street-shuffle.mp3';
  await page.route(trackPattern, route => route.abort());
  await page.evaluate(() => testMix.track.load());
  await page.locator('#music-toggle').click();
  await page.locator('#music-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'false');
  await page.unroute(trackPattern);
  await page.locator('#music-toggle').click();
  await page.waitForFunction(() => testMix.playing && !testMix.track.paused && testMix.track.currentTime > .05);
  assert.ok(await page.locator('#music-error').isHidden());
  await page.locator('#music-close').click();
  await page.route(trackPattern, async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
  const cancelled = await page.evaluate(async () => {
   const m = new RainMusic(), pending = m.play();
   await new Promise(resolve => setTimeout(resolve, 25)); m.stop();
   const started = await pending;
   await new Promise(resolve => setTimeout(resolve, 300));
   const result = !started && !m.playing && m.track.paused;
   await m.context.close(); return result;
  });
  assert.ok(cancelled, 'late media loading cannot restart cancelled music');
  await page.unroute(trackPattern);

  // Decode only in the test to check the mastered recording + existing effects.
  const mix = await page.evaluate(async () => {
   const rate = 22050, c = new OfflineAudioContext(2, rate * 8, rate), m = new RainMusic(c);
   m.volume = 1; m.effectsVolume = 1; m.ensure();
   const response = await fetch(testMix.track.src), buffer = await c.decodeAudioData(await response.arrayBuffer());
   const track = c.createBufferSource(); track.buffer = buffer; track.connect(m.master); track.start(0, 30);
   ['pick','match','behemoth','ukulele','blackhole','win'].forEach((kind,i) => m.effectAt(kind, 1 + i * .22));
   const output = (await c.startRendering()).getChannelData(0); let peak = 0, sum = 0;
   for (const value of output) { peak = Math.max(peak, Math.abs(value)); sum += value * value; }
   const fingerprints = [];
   for (const kind of ['pick','match','behemoth','ukulele','blackhole']) {
    const ctx = new OfflineAudioContext(1,rate,rate), effects = new RainMusic(ctx); effects.ensure(); effects.effectAt(kind,.01);
    const d = (await ctx.startRendering()).getChannelData(0); let crossings = 0;
    for(let i=1;i<d.length;i++) if(d[i]*d[i-1]<0)crossings++;
    fingerprints.push(crossings);
   }
   return { peak, rms: Math.sqrt(sum/output.length), fingerprints };
  });
  assert.ok(mix.peak > .05 && mix.peak < .95 && mix.rms > .005 && mix.rms < .35);
  assert.equal(new Set(mix.fingerprints).size, 5, 'distinct game effects retained');
  for (const language of ['zh','en']) {
   if (language === 'en') await page.locator('#language').click();
   await page.locator('#credits').click();
   const credits = page.locator('#modal-content');
   assert.match(await credits.innerText(), /George Street Shuffle.*Kevin MacLeod/);
   assert.equal(await credits.locator('a[href="https://creativecommons.org/licenses/by/4.0/"]').count(), 1);
   assert.equal(await credits.locator('a[href*="USUAN1300035"]').count(), 1);
   assert.equal(await credits.locator('a[href$="george-street-shuffle-NOTICE.txt"]').count(), 1);
   await page.locator('#close-modal').click();
  }
  await page.goto(origin + '/yang/?mode=rain#legacy'); await page.waitForURL('**/clackworks/?mode=rain#legacy');
  await page.locator('#board button:enabled').first().waitFor();
  await page.locator('#sound').click();
  for (const width of [320,390,1366]) { await page.setViewportSize({ width, height: 950 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  for (const old of ['rain_match','yang']) { await page.goto(origin + '/' + old + '/admin/?view=all#login'); await page.waitForURL('**/clackworks/admin/?view=all#login'); assert.match(await page.title(), /Clackworks/); }
  assert.deepEqual(errors, []);
  console.log('PASS: opt-in local recording, audible playback, real loop, pause/resume, background handling, failed-load retry, cancellation, independent volumes, unchanged effects, bilingual attribution, saves and layouts.', { peak: mix.peak, rms: mix.rms });
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
