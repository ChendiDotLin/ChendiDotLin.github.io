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
   const rate = 22050, seconds = 28, ctx = new OfflineAudioContext(2, rate * seconds, rate);
   const mix = new RainMusic(ctx); mix.ensure(); mix.setVolume(.45); mix.master.gain.value = .45 * .7;
   for (let step = 0; step < 192; step++) mix.renderStep(step, .05 + step * 60 / 108 / 4, step > 96 ? .9 : .25);
   ['pick','match','behemoth','ukulele','blackhole','win'].forEach((kind, i) => mix.effectAt(kind, 18 + i * 1.2));
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
   for (const kind of ['pick','match','behemoth','ukulele','blackhole']) {
    const c = new OfflineAudioContext(1, rate, rate), m = new RainMusic(c); m.ensure(); m.effectAt(kind, .01);
    const b = await c.startRendering(), d = b.getChannelData(0);
    let energy = 0, crossings = 0; for(let i=1;i<d.length;i++){ energy+=d[i]*d[i]; if(d[i]*d[i-1]<0)crossings++; }
    fingerprints.push({kind,energy,crossings});
   }
   return { peak, rms: Math.sqrt(sum / left.length), wav: btoa(binary), fingerprints };
  });
  assert.ok(rendered.peak > .05 && rendered.peak < .95, 'non-silent mix with headroom');
  assert.ok(rendered.rms > .005 && rendered.rms < .35);
  assert.equal(new Set(rendered.fingerprints.map(f => f.crossings)).size, 5, 'five different sound signatures');
  fs.writeFileSync('/tmp/clackworks-audio-preview.wav', Buffer.from(rendered.wav, 'base64'));
  await page.goto(origin + '/yang/?mode=rain#legacy'); await page.waitForURL('**/clackworks/?mode=rain#legacy');
  await page.locator('#board button:enabled').first().waitFor();
  for (const width of [320,390,1366]) { await page.setViewportSize({ width, height: 950 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  for (const old of ['rain_match', 'yang']) { await page.goto(origin + '/' + old + '/admin/?view=all#login'); await page.waitForURL('**/clackworks/admin/?view=all#login'); assert.match(await page.title(), /Clackworks/); }
  assert.deepEqual(errors, []);
  console.log('PASS: old URLs and admin redirect with query/hash, save continuity, opt-in music + effects, explicit mute, bounded chains, background lifecycle, audible mix, distinct sound signatures and responsive layout.', { peak: rendered.peak, rms: rendered.rms });
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
