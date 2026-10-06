(function (root) {
  'use strict';
  const LIMITS = { drizzle: 36, rain: 108, monsoon: 144 };
  const normalizeId = value => String(value ?? '').normalize('NFKC').trim();
  const validId = value => /^[\p{L}\p{N}_-]{1,20}$/u.test(value);
  const compare = (a, b) => b.cleared - a.cleared || a.elapsedMs - b.elapsedMs || a.createdAt - b.createdAt || a.playerId.localeCompare(b.playerId);
  function validEntry(entry) {
    return entry && typeof entry.playerId === 'string' && validId(entry.playerId) &&
      Object.hasOwn(LIMITS, entry.mode) && Number.isInteger(entry.cleared) && entry.cleared >= 0 &&
      entry.cleared <= LIMITS[entry.mode] && entry.cleared % 3 === 0 &&
      Number.isSafeInteger(entry.elapsedMs) && entry.elapsedMs >= 0 && entry.elapsedMs <= 604800000 &&
      Number.isSafeInteger(entry.createdAt) && entry.createdAt >= 0;
  }
  class Leaderboard {
    constructor(config = {}, fetcher = (...args) => fetch(...args)) {
      this.url = String(config.supabaseUrl || '').replace(/\/$/, '');
      this.key = String(config.supabasePublishableKey || ''); this.fetcher = fetcher;
      this.configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(this.url) && this.key.startsWith('sb_publishable_');
    }
    async request(name, payload) {
      if (!this.configured) throw Error('notConfigured');
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await this.fetcher(`${this.url}/rest/v1/rpc/${name}`, {
          method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: controller.signal
        });
        if (!response.ok) {
          const failure = await response.json().catch(() => ({}));
          throw Error(failure.code === 'PGRST202' ? 'notConfigured' : 'networkError');
        }
        return await response.json();
      } catch (error) { throw Error(error.message === 'notConfigured' ? 'notConfigured' : 'networkError'); }
      finally { clearTimeout(timeout); }
    }
    async list(mode) {
      const result = await this.request('rain_leaderboard', { p_mode: mode });
      if (!Array.isArray(result?.entries) || !Number.isInteger(result.total) || result.total < 0 ||
          result.entries.length > 100 || result.entries.some(entry => !validEntry(entry) || entry.mode !== mode)) throw Error('networkError');
      return result;
    }
    async submit({ runId, playerId, mode, cleared, elapsedMs }) {
      playerId = normalizeId(playerId);
      if (!validId(playerId)) return { ok: false, error: 'invalidId' };
      if (!validEntry({ playerId, mode, cleared, elapsedMs, createdAt: Date.now() })) return { ok: false, error: 'submitFailed' };
      try {
        const result = await this.request('rain_submit_score', {
          p_run_id: runId, p_player_id: playerId, p_mode: mode, p_cleared: cleared, p_elapsed_ms: elapsedMs
        });
        if (!result?.ok || !Number.isInteger(result.rank) || result.rank < 1 || result.playerId !== playerId || typeof result.improved !== 'boolean') throw Error('networkError');
        return result;
      } catch (error) { return { ok: false, error: error.message === 'notConfigured' ? 'notConfigured' : 'networkError' }; }
    }
  }
  const api = { Leaderboard, compare, normalizeId, validId, validEntry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainLeaderboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
