// Audio lifecycle/mix verification and URL migration; remote writes are mocked.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 950 }, reducedMotion: 'reduce' });
  const errors = [], sampleRequests = []; page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/assets/audio/piano/') && r.url().endsWith('.mp3')) sampleRequests.push(r.url()); });
  await page.routeWebSocket(/\/realtime\/v1\//, socket => socket.close());
  await page.route('**/rest/v1/rpc/*', route => route.fulfill({ json: { entries: [], total: 0 } }));
  await page.route('**/music.js*', async route => {
   const response = await route.fetch();
   await route.fulfill({ response, body: await response.text() + '\nconst BaseMusic = RainMusic; window.RainMusic = class extends BaseMusic { constructor(...args) { super(...args); window.testMix = this; } };' });
  });
  const origin = new URL(process.env.RAIN_GAME_URL || 'http://127.0.0.1:8765/clackworks/').origin;
  await page.goto(origin + '/clackworks/'); await page.locator('[data-reward=feather]').click();
  assert.match(await page.title(), /咔嗒工坊/);
  assert.equal(await page.evaluate(() => testMix.context), null);
  assert.equal(sampleRequests.length, 0, 'piano samples do not load before Play');
  assert.equal(await page.locator('[data-i18n="musicHint"]').count(), 0, 'player description removed');
  await page.locator('#board button:enabled').first().click();
  const saved = await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)));
  await page.goto(origin + '/rain_match/?mode=expedition#resume');
  await page.waitForURL('**/clackworks/?mode=expedition#resume');
  await page.locator('#resume-confirm').click();
  assert.deepEqual(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)).game), saved.game);
  await page.locator('#sound').click(); await page.locator('#music-toggle').click();
  await page.waitForFunction(() => document.getElementById('effects').getAttribute('aria-pressed') === 'true');
  assert.equal(await page.evaluate(() => testMix.pianoBuffers.size), 5, 'recorded piano is ready before the score starts');
  assert.ok(sampleRequests.every(url => new URL(url).origin === origin), 'samples load from the game host');
  assert.equal(await page.locator('#effects').getAttribute('aria-pressed'), 'true', 'first play includes effects');
  await page.evaluate(() => { testMix.chain(Array.from({ length: 40 }, (_, i) => ({ kind: ['behemoth', 'ukulele', 'gasoline'][i % 3], ids: [1,2,3] })), 120); });
  assert.ok(await page.evaluate(() => testMix.effectVoices.size > 0 && testMix.effectVoices.size <= 80));
  await page.locator('#effects').click();
  assert.equal(await page.evaluate(() => testMix.effectVoices.size), 0, 'muting cancels queued effects');
  await page.locator('#music-toggle').click(); await page.locator('#music-toggle').click();
  assert.equal(await page.locator('#effects').getAttribute('aria-pressed'), 'false', 'explicit mute persists');
  const lifecycle = await page.evaluate(async () => {
   await testMix.visibility(true);
   const hidden = testMix.context.state === 'suspended' && !testMix.timer && !testMix.effectVoices.size;
   await testMix.visibility(false);
   const resumed = testMix.context.state === 'running' && !!testMix.timer;
   testMix.stop(); const stopped = !testMix.voices.size && !testMix.timer && !testMix.playing;
   return { hidden, resumed, stopped };
  });
  assert.deepEqual(lifecycle, { hidden: true, resumed: true, stopped: true });
  // Offline sample checks actual output, headroom and distinct effects; also creates a listening preview.
  const rendered = await page.evaluate(async () => {
   const rate = 22050, seconds = RainMusic.loopSteps * RainMusic.stepDuration + 2;
   const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
   const mix = new RainMusic(ctx); await mix.preparePiano(); mix.setVolume(.45); mix.master.gain.value = .45 * .7;
   for (let step = 0; step < RainMusic.loopSteps; step++) mix.renderStep(step, .05 + step * RainMusic.stepDuration, step > 256 ? .9 : .25);
   const buffer = await ctx.startRendering(), left = buffer.getChannelData(0), right = buffer.getChannelData(1);
   let peak = 0, sum = 0;
   for (const sample of left) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
   const bytes = new ArrayBuffer(44 + left.length * 4), view = new DataView(bytes);
   const str = (offset, value) => [...value].forEach((c,i) => view.setUint8(offset+i,c.charCodeAt(0)));
   str(0,'RIFF'); view.setUint32(4,bytes.byteLength-8,true); str(8,'WAVE'); str(12,'fmt '); view.setUint32(16,16,true);
   view.setUint16(20,1,true); view.setUint16(22,2,true); view.setUint32(24,rate,true); view.setUint32(28,rate*4,true); view.setUint16(32,4,true); view.setUint16(34,16,true); str(36,'data'); view.setUint32(40,bytes.byteLength-44,true);
   for(let i=0;i<left.length;i++) { view.setInt16(44+i*4,Math.max(-1,Math.min(1,left[i]))*32767,true); view.setInt16(46+i*4,Math.max(-1,Math.min(1,right[i]))*32767,true); }
   let binary=''; const data=new Uint8Array(bytes); for(let i=0;i<data.length;i+=16384)binary+=String.fromCharCode(...data.subarray(i,i+16384));
   const fingerprints = [];
   for (const kind of ['pick','match','behemoth','ukulele','blackhole','keys','guitar']) {
    const c = new OfflineAudioContext(1, rate, rate), m = new RainMusic(c); m.ensure(); m.pianoBuffers = mix.pianoBuffers;
    if (kind === 'keys' || kind === 'guitar') m.melody(kind, 65, .01, 5, .9);
    else m.effectAt(kind, .01);
    const b = await c.startRendering(), d = b.getChannelData(0);
    let energy = 0, crossings = 0; for(let i=1;i<d.length;i++){ energy+=d[i]*d[i]; if(d[i]*d[i-1]<0)crossings++; }
    fingerprints.push({kind,energy,crossings});
   }
   // Full-volume score plus a burst of effects still needs mix headroom.
   const loudContext = new OfflineAudioContext(1, rate * 4, rate), loud = new RainMusic(loudContext);
   loud.volume = 1; loud.effectsVolume = 1; loud.ensure(); loud.pianoBuffers = mix.pianoBuffers;
   for (let step = 0; step < 24; step++) loud.renderStep(step, .01 + step * RainMusic.stepDuration, .9);
   ['pick','match','behemoth','ukulele','blackhole','win'].forEach((kind, i) => loud.effectAt(kind, .02 + i * .18));
   const loudBuffer = await loudContext.startRendering(); let loudPeak = 0;
   for (const sample of loudBuffer.getChannelData(0)) loudPeak = Math.max(loudPeak, Math.abs(sample));
   // A long key must sustain audibly, not merely have a long silent tail.
   const heldContext = new OfflineAudioContext(1, Math.ceil(rate * 1.4), rate), held = new RainMusic(heldContext);
   held.ensure(); held.pianoBuffers = mix.pianoBuffers; held.melody('keys', 65, .01, 7.5, .9);
   const heldSamples = (await heldContext.startRendering()).getChannelData(0);
   const windowEnergy = start => {
    let total = 0; for (let i = Math.floor(start * rate); i < Math.floor((start + .2) * rate); i++) total += heldSamples[i] ** 2;
    return total;
   };
   const sustainRatio = windowEnergy(.65) / windowEnergy(.1);
   const heldLateRms = Math.sqrt(windowEnergy(.65) / (rate * .2));
   const shortContext = new OfflineAudioContext(1, Math.ceil(rate * 1.4), rate), short = new RainMusic(shortContext);
   short.ensure(); short.pianoBuffers = mix.pianoBuffers; short.melody('keys', 65, .01, 1.8, .9);
   const shortSamples = (await shortContext.startRendering()).getChannelData(0);
   let shortLateEnergy = 0;
   for (let i = Math.floor(rate * .65); i < Math.floor(rate * .85); i++) shortLateEnergy += shortSamples[i] ** 2;
   const shortLateRms = Math.sqrt(shortLateEnergy / (rate * .2));
   return { peak, loudPeak, sustainRatio, heldLateRms, shortLateRms, pianoPitches: mix.pianoBuffers.size, rms: Math.sqrt(sum / left.length), wav: btoa(binary), fingerprints, guitarPitches: mix.guitarBuffers.size };
  });
  assert.ok(rendered.peak > .05 && rendered.peak < .95, 'non-silent mix with headroom');
  assert.ok(rendered.rms > .005 && rendered.rms < .35);
  assert.ok(rendered.loudPeak > .05 && rendered.loudPeak < .95, 'full-volume music and effects have headroom');
  assert.equal(rendered.pianoPitches, 5, 'preview uses the recorded piano, not its fallback');
  assert.ok(rendered.heldLateRms > .001, 'recorded long keys remain audible after their natural initial decay');
  assert.ok(rendered.shortLateRms < rendered.heldLateRms * .1, 'short keys damp while long keys continue ringing');
  assert.equal(new Set(rendered.fingerprints.slice(0,5).map(f => f.crossings)).size, 5, 'five different sound signatures');
  const [keys, guitar] = rendered.fingerprints.slice(5);
  assert.ok(keys.energy > .001 && guitar.energy > .001, 'both lead instruments are audible');
  assert.notEqual(keys.crossings, guitar.crossings, 'keys and guitar have distinct timbres at the same pitch');
  assert.ok(rendered.guitarPitches > 1 && rendered.guitarPitches <= 12, 'string buffers are reused across the full arrangement');
  fs.writeFileSync('/tmp/clackworks-audio-preview.wav', Buffer.from(rendered.wav, 'base64'));
  // Sample failures and cancellation while loading must not break controls.
  await page.route('**/assets/audio/piano/*.mp3', route => route.abort());
  const fallback = await page.evaluate(async () => {
   const m = new RainMusic(); const started = await m.play();
   const result = started && m.pianoBuffers.size === 0 && m.voices.size > 0;
   m.stop(); await m.context.close(); return result;
  });
  assert.ok(fallback, 'failed sample loads use the playable FM fallback');
  await page.unroute('**/assets/audio/piano/*.mp3');
  await page.route('**/assets/audio/piano/*.mp3', async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
  const cancelled = await page.evaluate(async () => {
   const m = new RainMusic(), pending = m.play();
   await new Promise(resolve => setTimeout(resolve, 25)); m.stop();
   const started = await pending;
   const result = !started && !m.playing && !m.timer && !m.voices.size;
   await m.context.close(); return result;
  });
  assert.ok(cancelled, 'late sample completion cannot restart a stopped score');
  await page.unroute('**/assets/audio/piano/*.mp3');
  await page.goto(origin + '/yang/?mode=rain#legacy'); await page.waitForURL('**/clackworks/?mode=rain#legacy');
  await page.locator('#board button:enabled').first().waitFor();
  for (const width of [320,390,1366]) { await page.setViewportSize({ width, height: 950 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  for (const old of ['rain_match', 'yang']) { await page.goto(origin + '/' + old + '/admin/?view=all#login'); await page.waitForURL('**/clackworks/admin/?view=all#login'); assert.match(await page.title(), /Clackworks/); }
  assert.deepEqual(errors, []);
  console.log('PASS: redirects, saves, local sampled piano, load failure/cancellation, audio lifecycle, full score, natural sustain/damping, mix headroom, effects and responsive layout.', { peak: rendered.peak, loudPeak: rendered.loudPeak, rms: rendered.rms, sustainRatio: rendered.sustainRatio });
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
