'use strict';
const assert = require('node:assert/strict');
const { Presence, summarize, IDLE_MS, KEY } = require('../rain_match/presence.js');
const config = { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test' };
const a = crypto.randomUUID(), b = crypto.randomUUID();
assert.deepEqual(summarize({ first: [{ visitorId: a, mode: 'rain' }], duplicate: [{ visitorId: a, mode: 'expedition' }], other: [{ visitorId: b, mode: 'rain' }], bad: [{ visitorId: '<script>', mode: 'expedition' }], malformed: null }), { total: 2, expedition: 1 });
function fixture(storage) {
  let now = 0, sequence = 0;
  const timers = new Map(), clients = [], views = [];
  const options = { storage, now: () => now, setTimer: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; }, clearTimer: id => timers.delete(id), onChange: view => views.push(view),
    createClient: (_url, _key, settings) => {
      assert.deepEqual(settings.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
      const channel = { state: {}, calls: [], on(_type, _filter, cb) { this.sync = cb; return this; }, subscribe(cb) { this.status = cb; return this; }, presenceState() { return this.state; }, async track(payload) { this.calls.push(payload); this.state.self = [payload]; this.sync(); return 'ok'; } };
      const client = { channel: () => channel, channelValue: channel, removed: 0, disconnected: 0, async removeAllChannels() { this.removed++; }, realtime: { disconnect() { client.disconnected++; } } };
      clients.push(client); return client;
    } };
  const tracker = new Presence(config, options);
  const tick = async delta => {
    const target = now + delta;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
      for (let n = 0; n < 8; n++) await Promise.resolve();
    }
    now = target;
    for (let n = 0; n < 8; n++) await Promise.resolve();
  };
  return { tracker, clients, views, tick, options };
}
(async () => {
  const stored = new Map(), storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  const f = fixture(storage); f.tracker.start();
  assert.equal(f.views.at(-1).status, 'connecting'); assert.equal(f.views.at(-1).total, undefined);
  const channel = f.clients[0].channelValue; channel.status('SUBSCRIBED'); await f.tick(0);
  assert.deepEqual(f.views.at(-1), { status: 'ready', total: 1, expedition: 1 });
  assert.deepEqual(Object.keys(channel.calls[0]).sort(), ['mode', 'visitorId']);
  assert.deepEqual([...stored.keys()], [KEY]);
  assert.equal(fixture(storage).tracker.visitorId, f.tracker.visitorId);
  f.tracker.setMode('rain'); f.tracker.setMode('drizzle'); f.tracker.setMode('monsoon'); await f.tick(400);
  assert.equal(channel.calls.length, 2); assert.equal(channel.calls.at(-1).mode, 'monsoon');
  for (let n = 0; n < 10; n++) f.tracker.activity(); await f.tick(400);
  assert.equal(channel.calls.length, 2, 'Activity must not flood Presence with track calls');
  await f.tick(IDLE_MS - 401); assert.equal(f.clients[0].removed, 0);
  await f.tick(1); assert.equal(f.clients[0].removed, 1); assert.equal(f.views.at(-1).status, 'idle');
  f.tracker.activity(); assert.equal(f.clients.length, 2);
  f.clients[1].channelValue.status('SUBSCRIBED'); await f.tick(0);
  f.tracker.setVisible(false); await f.tick(0); assert.equal(f.clients[1].removed, 1);
  f.tracker.setVisible(true); assert.equal(f.clients.length, 3);
  f.clients[2].channelValue.status('SUBSCRIBED'); await f.tick(0);
  f.tracker.setOnline(false); assert.equal(f.views.at(-1).status, 'unavailable'); assert.equal(f.views.at(-1).total, undefined);
  f.tracker.setOnline(true); assert.equal(f.clients.length, 4);
  f.tracker.stop(); await f.tick(0);
  assert.ok(f.clients.every(client => client.removed === 1 && client.disconnected === 1));

  // Old track acknowledgements must not validate a new subscription.
  const r = fixture(storage); r.tracker.start(); const ch = r.clients[0].channelValue, pending = [];
  ch.track = payload => new Promise(resolve => pending.push(() => { ch.state.self = [payload]; ch.sync(); resolve('ok'); }));
  ch.status('SUBSCRIBED'); await r.tick(0);
  ch.status('CHANNEL_ERROR'); assert.equal(r.views.at(-1).status, 'unavailable');
  ch.status('SUBSCRIBED'); await r.tick(0); assert.equal(pending.length, 2);
  pending[0](); await r.tick(0); assert.equal(r.views.at(-1).status, 'connecting');
  pending[1](); await r.tick(0); assert.equal(r.views.at(-1).status, 'ready');
  ch.status('CHANNEL_ERROR'); ch.track = async () => 'timed out'; ch.status('SUBSCRIBED'); await r.tick(0);
  assert.equal(r.views.at(-1).status, 'unavailable');
  r.tracker.stop(); await r.tick(10000); assert.equal(r.clients.length, 1);

  const denied = fixture({ getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } });
  denied.tracker.start(); denied.clients[0].channelValue.status('SUBSCRIBED'); await denied.tick(0);
  assert.equal(denied.views.at(-1).total, 1); denied.tracker.stop();
  const missing = []; const disabled = new Presence({}, { onChange: value => missing.push(value) });
  disabled.start(); assert.equal(missing.at(-1).status, 'unavailable'); disabled.stop();
  console.log('PASS: browser deduplication, mode aggregation, ephemeral payload, idle/hidden/offline cleanup, coalesced updates, stale reconnect acknowledgements, failure state and denied storage.');
})().catch(error => { console.error(error); process.exit(1); });
