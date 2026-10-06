// Audio lifecycle/mix verification and URL migration; remote writes are mocked.
const { chromium } = require(process.env.RAIN_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.RAIN_BROWSER_PATH || undefined, headless: true, args: ['--disable-gpu'] });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 950 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
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
  await page.locator('#board button:enabled').first().click();
  const saved = await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)));
  await page.goto(origin + '/rain_match/?mode=expedition#resume');
  await page.waitForURL('**/clackworks/?mode=expedition#resume');
  await page.locator('#resume-confirm').click();
  assert.deepEqual(await page.evaluate(() => RainSave.parse(localStorage.getItem(RainSave.KEY)).game), saved.game);
  await page.locator('#sound').click(); await page.locator('#music-toggle').click();
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
   const mix = new RainMusic(ctx); mix.ensure(); mix.setVolume(.45); mix.master.gain.value = .45 * .7;
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
    const c = new OfflineAudioContext(1, rate, rate), m = new RainMusic(c); m.ensure();
    if (kind === 'keys' || kind === 'guitar') m.melody(kind, 65, .01, 5, .9);
    else m.effectAt(kind, .01);
    const b = await c.startRendering(), d = b.getChannelData(0);
    let energy = 0, crossings = 0; for(let i=1;i<d.length;i++){ energy+=d[i]*d[i]; if(d[i]*d[i-1]<0)crossings++; }
    fingerprints.push({kind,energy,crossings});
   }
   // Full-volume score plus a burst of effects still needs mix headroom.
   const loudContext = new OfflineAudioContext(1, rate * 4, rate), loud = new RainMusic(loudContext);
   loud.volume = 1; loud.effectsVolume = 1; loud.ensure();
   for (let step = 0; step < 24; step++) loud.renderStep(step, .01 + step * RainMusic.stepDuration, .9);
   ['pick','match','behemoth','ukulele','blackhole','win'].forEach((kind, i) => loud.effectAt(kind, .02 + i * .18));
   const loudBuffer = await loudContext.startRendering(); let loudPeak = 0;
   for (const sample of loudBuffer.getChannelData(0)) loudPeak = Math.max(loudPeak, Math.abs(sample));
   // A long key must sustain audibly, not merely have a long silent tail.
   const heldContext = new OfflineAudioContext(1, Math.ceil(rate * 1.4), rate), held = new RainMusic(heldContext);
   held.ensure(); held.melody('keys', 65, .01, 7.5, .9);
   const heldSamples = (await heldContext.startRendering()).getChannelData(0);
   const windowEnergy = start => {
    let total = 0; for (let i = Math.floor(start * rate); i < Math.floor((start + .2) * rate); i++) total += heldSamples[i] ** 2;
    return total;
   };
   const sustainRatio = windowEnergy(.65) / windowEnergy(.1);
   return { peak, loudPeak, sustainRatio, rms: Math.sqrt(sum / left.length), wav: btoa(binary), fingerprints, guitarPitches: mix.guitarBuffers.size };
  });
  assert.ok(rendered.peak > .05 && rendered.peak < .95, 'non-silent mix with headroom');
  assert.ok(rendered.rms > .005 && rendered.rms < .35);
  assert.ok(rendered.loudPeak > .05 && rendered.loudPeak < .95, 'full-volume music and effects have headroom');
  assert.ok(rendered.sustainRatio > .5, 'long keys retain audible body beyond the first beat');
  assert.equal(new Set(rendered.fingerprints.slice(0,5).map(f => f.crossings)).size, 5, 'five different sound signatures');
  const [keys, guitar] = rendered.fingerprints.slice(5);
  assert.ok(keys.energy > .001 && guitar.energy > .001, 'both lead instruments are audible');
  assert.notEqual(keys.crossings, guitar.crossings, 'keys and guitar have distinct timbres at the same pitch');
  assert.ok(rendered.guitarPitches > 1 && rendered.guitarPitches <= 12, 'string buffers are reused across the full arrangement');
  fs.writeFileSync('/tmp/clackworks-audio-preview.wav', Buffer.from(rendered.wav, 'base64'));
  await page.goto(origin + '/yang/?mode=rain#legacy'); await page.waitForURL('**/clackworks/?mode=rain#legacy');
  await page.locator('#board button:enabled').first().waitFor();
  for (const width of [320,390,1366]) { await page.setViewportSize({ width, height: 950 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  for (const old of ['rain_match', 'yang']) { await page.goto(origin + '/' + old + '/admin/?view=all#login'); await page.waitForURL('**/clackworks/admin/?view=all#login'); assert.match(await page.title(), /Clackworks/); }
  assert.deepEqual(errors, []);
  console.log('PASS: redirects, saves, audio lifecycle, full 32-bar score, distinct keyboard/guitar timbres, bounded string cache, full-volume mix headroom, effects and responsive layout.', { peak: rendered.peak, loudPeak: rendered.loudPeak, rms: rendered.rms });
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
