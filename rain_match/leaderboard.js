(function (root) {
  'use strict';
  const LIMITS = { drizzle: 36, rain: 108, monsoon: 144, expedition: 2147483646, expedition_distance: 2147483646, expedition_speed: 2147483646 };
  const normalizeId = value => String(value ?? '').normalize('NFKC').trim();
  const validId = value => /^[\p{L}\p{N}_-]{1,20}$/u.test(value);
  const compare = (a, b) => b.cleared - a.cleared || a.elapsedMs - b.elapsedMs || a.createdAt - b.createdAt || a.playerId.localeCompare(b.playerId);
  const relicIds = new Set(['feather', 'shield', 'ukulele', 'cell', 'blackhole', 'radar', 'gasoline', 'behemoth', 'clover']);
  function validLoadout(loadout) {
    return Array.isArray(loadout) && loadout.length >= 1 && loadout.length <= 7 &&
      loadout.every(item => item && relicIds.has(item.id) && Number.isInteger(item.level) && item.level >= 1 && item.level <= 3) &&
      new Set(loadout.map(item => item.id)).size === loadout.length &&
      loadout.filter(item => ['blackhole', 'radar'].includes(item.id)).length <= 1 &&
      loadout.filter(item => !['blackhole', 'radar'].includes(item.id)).length <= 6;
  }
  function validEntry(entry) {
    return entry && typeof entry.playerId === 'string' && validId(entry.playerId) &&
      Object.hasOwn(LIMITS, entry.mode) && Number.isInteger(entry.cleared) && entry.cleared >= 0 &&
      entry.cleared <= LIMITS[entry.mode] && entry.cleared % 3 === 0 &&
      Number.isSafeInteger(entry.elapsedMs) && entry.elapsedMs >= 0 && entry.elapsedMs <= 604800000 &&
      Number.isSafeInteger(entry.createdAt) && entry.createdAt >= 0 &&
      (!entry.mode.startsWith('expedition') || entry.stage == null && entry.mode === 'expedition' ||
        (Number.isInteger(entry.stage) && entry.stage >= 1 && entry.stage <= 1000000 && validLoadout(entry.loadout))) &&
      (!['expedition_distance','expedition_speed'].includes(entry.mode) || Number.isInteger(entry.completedStages) && entry.completedStages >= 0 &&
        entry.completedStages <= entry.stage && (entry.mode !== 'expedition_speed' || entry.completedStages >= 10 && entry.tenMs === entry.elapsedMs));
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
      if (mode === 'expedition_legacy') mode = 'expedition';
      const modern = ['expedition_distance','expedition_speed'].includes(mode);
      const result = await this.request(modern ? 'rain_expedition_v3_leaderboard' : mode === 'expedition' ? 'rain_expedition_leaderboard' : 'rain_leaderboard', modern ? { p_board: mode.slice(11) } : mode === 'expedition' ? {} : { p_mode: mode });
      if (!Array.isArray(result?.entries) || !Number.isInteger(result.total) || result.total < 0 ||
          result.entries.length > 100 || result.entries.some(entry => !validEntry(entry) || entry.mode !== mode)) throw Error('networkError');
      return result;
    }
    async submit({ runId, playerId, mode, cleared, elapsedMs, stage, loadout, rules, completedStages, tenMs }) {
      playerId = normalizeId(playerId);
      if (!validId(playerId)) return { ok: false, error: 'invalidId' };
      if (!validEntry({ playerId, mode, cleared, elapsedMs, createdAt: Date.now() })) return { ok: false, error: 'submitFailed' };
      if (mode === 'expedition' && (!Number.isInteger(stage) || stage < 1 || stage > 1000000 || !validLoadout(loadout))) return { ok: false, error: 'submitFailed' };
      if (rules === 3 && (!Number.isInteger(completedStages) || completedStages < stage - 1 || completedStages > stage ||
        (completedStages >= 10 ? !Number.isSafeInteger(tenMs) || tenMs < 0 || tenMs > elapsedMs : tenMs !== null))) return { ok: false, error: 'submitFailed' };
      try {
        const payload = { p_run_id: runId, p_player_id: playerId, p_cleared: cleared, p_elapsed_ms: elapsedMs };
        const result = await this.request(mode === 'expedition' ? rules === 3 ? 'rain_submit_expedition_v3' : 'rain_submit_expedition' : 'rain_submit_score', {
          ...payload, ...(mode === 'expedition' ? { p_stage: stage, p_loadout: loadout, ...(rules === 3 ? { p_completed_stages: completedStages, p_ten_ms: tenMs } : {}) } : { p_mode: mode })
        });
        if (rules === 3 && tenMs !== null && (!Number.isSafeInteger(result?.speedRank) || result.speedRank < 1)) throw Error('networkError');
        if (!result?.ok || !Number.isInteger(result.rank) || result.rank < 1 || result.playerId !== playerId || typeof result.improved !== 'boolean') throw Error('networkError');
        return result;
      } catch (error) { return { ok: false, error: error.message === 'notConfigured' ? 'notConfigured' : 'networkError' }; }
    }
  }
  const api = { Leaderboard, compare, normalizeId, validId, validEntry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainLeaderboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
