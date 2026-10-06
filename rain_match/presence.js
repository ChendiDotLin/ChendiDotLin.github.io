/* Ephemeral online counts only: no names, scores, or database writes. */
(function (root) {
  'use strict';
  const KEY = 'rain-match-online-id-v1', CHANNEL = 'rain-match-online-v1', IDLE_MS = 180000;
  const modes = new Set(['drizzle', 'rain', 'monsoon', 'expedition']);
  const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
  function summarize(state) {
    const players = new Map();
    for (const entries of Object.values(state || {})) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!validId(entry?.visitorId) || !modes.has(entry.mode)) continue;
        players.set(entry.visitorId, players.get(entry.visitorId) || entry.mode === 'expedition');
      }
    }
    return { total: players.size, expedition: [...players.values()].filter(Boolean).length };
  }
  class Presence {
    constructor(config = {}, options = {}) {
      this.url = String(config.supabaseUrl || ''); this.key = String(config.supabasePublishableKey || '');
      this.createClient = options.createClient; this.storage = options.storage;
      this.now = options.now || (() => performance.now());
      this.setTimer = options.setTimer || ((fn, delay) => setTimeout(fn, delay));
      this.clearTimer = options.clearTimer || (id => clearTimeout(id));
      this.onChange = options.onChange || (() => {});
      this.channelName = options.channelName || CHANNEL;
      this.mode = 'expedition'; this.visible = true; this.online = true; this.running = false;
      this.generation = 0; this.lastActivity = 0; this.lastView = '';
      this.visitorId = crypto.randomUUID(); this.refreshIdentity();
    }
    refreshIdentity() {
      try {
        const stored = this.storage?.getItem(KEY);
        if (validId(stored)) this.visitorId = stored;
        else this.storage?.setItem(KEY, this.visitorId);
      } catch (_) { /* Blocked storage still permits a temporary, per-tab ID. */ }
      this.scheduleTrack();
    }
    emit(status, counts = {}) {
      const view = { status, ...counts }, encoded = JSON.stringify(view);
      if (encoded === this.lastView) return;
      this.lastView = encoded; this.onChange(view);
    }
    start() { this.running = true; this.activity(); }
    stop() { this.running = false; this.disconnect('idle'); }
    setMode(mode) {
      if (!modes.has(mode) || mode === this.mode) return;
      this.mode = mode; this.scheduleTrack();
    }
    setVisible(visible) {
      this.visible = visible;
      if (visible) this.activity(); else this.disconnect('idle');
    }
    setOnline(online) {
      this.online = online;
      if (online) this.activity(); else this.disconnect('unavailable');
    }
    activity() {
      if (!this.running) return;
      this.lastActivity = this.now();
      this.clearTimer(this.idleTimer);
      this.idleTimer = this.setTimer(() => this.disconnect('idle'), IDLE_MS);
      if (this.visible && this.online && !this.client) this.connect();
    }
    connect() {
      if (!this.createClient || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(this.url) || !this.key.startsWith('sb_publishable_')) {
        this.emit('unavailable'); return;
      }
      const generation = ++this.generation;
      this.emit('connecting');
      try {
        this.client = this.createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const channel = this.channel = this.client.channel(this.channelName, { config: { presence: { key: crypto.randomUUID() } } });
        channel.on('presence', { event: 'sync' }, () => { if (generation === this.generation) this.sync(); });
        channel.subscribe(status => {
          if (generation !== this.generation) return;
          this.subscription = (this.subscription || 0) + 1;
          this.clearTimer(this.trackTimer); this.trackTimer = null; this.sending = false;
          this.connected = status === 'SUBSCRIBED'; this.sent = null; this.tracked = false;
          if (this.connected) { this.emit('connecting'); this.scheduleTrack(true); }
          else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) this.emit('unavailable');
        });
      } catch (_) { this.disconnect('unavailable'); }
    }
    scheduleTrack(immediate = false) {
      if (!this.connected || this.sending || this.trackTimer) return;
      const payload = JSON.stringify({ visitorId: this.visitorId, mode: this.mode });
      if (payload === this.sent) return;
      const generation = this.generation;
      const subscription = this.subscription;
      this.trackTimer = this.setTimer(async () => {
        this.trackTimer = null;
        if (generation !== this.generation || subscription !== this.subscription || !this.connected) return;
        this.sending = true;
        const data = { visitorId: this.visitorId, mode: this.mode };
        try {
          const status = await this.channel.track(data);
          if (generation !== this.generation || subscription !== this.subscription) return;
          if (status === 'ok') { this.sent = JSON.stringify(data); this.tracked = true; this.sync(); }
          else { this.tracked = false; this.emit('unavailable'); }
        } catch (_) { if (generation === this.generation && subscription === this.subscription) { this.tracked = false; this.emit('unavailable'); } }
        finally {
          if (generation === this.generation && subscription === this.subscription) {
            this.sending = false;
            // Retry a failed track slowly, and coalesce rapid mode changes.
            if (this.connected && JSON.stringify({ visitorId: this.visitorId, mode: this.mode }) !== this.sent)
              this.trackTimer = this.setTimer(() => { this.trackTimer = null; this.scheduleTrack(true); }, this.tracked ? 400 : 10000);
          }
        }
      }, immediate ? 0 : 400);
    }
    sync() {
      if (!this.connected || !this.tracked) return;
      const state = this.channel.presenceState();
      // Wait for our own confirmed presence before rendering a real count.
      if (!Object.values(state).some(entries => Array.isArray(entries) && entries.some(entry => entry?.visitorId === this.visitorId))) return;
      this.emit('ready', summarize(state));
    }
    disconnect(status) {
      this.generation++;
      this.clearTimer(this.idleTimer); this.clearTimer(this.trackTimer); this.trackTimer = null;
      const client = this.client;
      this.client = null; this.channel = null; this.connected = false; this.tracked = false; this.sending = false; this.sent = null;
      if (client) {
        try { Promise.resolve(client.removeAllChannels()).catch(() => {}); } catch (_) { /* Best-effort leave. */ }
        // Do not keep a ghost connection alive while an offline leave awaits ACK.
        try { Promise.resolve(client.realtime.disconnect()).catch(() => {}); } catch (_) { /* The game remains usable. */ }
      }
      this.emit(status);
    }
  }
  const api = { Presence, summarize, KEY, CHANNEL, IDLE_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainPresence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
