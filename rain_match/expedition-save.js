/* Local checkpoints. No account data, network calls, or automatic score submission. */
(function (root) {
  'use strict';
  const rules = typeof module !== 'undefined' && module.exports ? require('./expedition.js') : root.RainExpedition;
  const KEY = 'rain-match-expedition-save-v2', BACKUP = KEY + '-backup';
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function valid(record) {
    if (!record || record.schema !== 2 || !uuid(record.runId) || !Number.isSafeInteger(record.savedAt) || record.savedAt < 0 ||
      !Number.isFinite(record.elapsedMs) || record.elapsedMs < 0 || record.elapsedMs > 604800000 ||
      typeof record.finalized !== 'boolean' || typeof record.stageRewardClaimed !== 'boolean' ||
      typeof record.playerDraft !== 'string' || record.playerDraft.length > 100 || !rules.validSave(record.game)) return false;
    if (record.finalized && record.game.status === 'playing') return false;
    const payload = record.submissionPayload;
    if (payload !== null && (!payload || typeof payload !== 'object' || !record.finalized || payload.runId !== record.runId || payload.mode !== 'expedition' ||
      !/^[\p{L}\p{N}_-]{1,20}$/u.test(payload.playerId) || payload.cleared !== record.game.banked + record.game.cleared ||
      payload.elapsedMs !== Math.round(record.elapsedMs) || payload.stage !== record.game.stage ||
      JSON.stringify(payload.loadout) !== JSON.stringify(Object.entries(record.game.relics).map(([id, level]) => ({ id, level }))))) return false;
    if (record.receipt !== null && (!record.receipt || typeof record.receipt !== 'object' || !payload || record.receipt.ok !== true || record.receipt.playerId !== payload.playerId ||
      !Number.isSafeInteger(record.receipt.rank) || record.receipt.rank < 1 || typeof record.receipt.improved !== 'boolean')) return false;
    return true;
  }
  function parse(raw) {
    if (!raw || raw.length > 160000) return null;
    try { const record = JSON.parse(raw); return valid(record) ? record : null; } catch (_) { return null; }
  }
  class Store {
    constructor(storage, locks) { this.storage = storage; this.locks = locks; this.owned = false; this.expected = null; this.releaseLock = null; this.available = !!storage; }
    read() {
      try {
        if (!this.storage) throw Error('unavailable');
        const raw = this.storage.getItem(KEY), record = parse(raw);
        if (record) return { record, raw, recovered: false, error: null };
        const backup = parse(this.storage.getItem(BACKUP));
        return { record: backup, raw, recovered: !!backup, error: !backup && raw ? 'corrupt' : null };
      } catch (_) { this.available = false; return { record: null, raw: null, error: 'unavailable', recovered: false }; }
    }
    async acquire() {
      if (this.owned) return true;
      if (!this.locks?.request) { this.owned = true; return true; }
      return new Promise(resolve => {
        this.locks.request(KEY, { ifAvailable: true }, lock => {
          if (!lock) { resolve(false); return; }
          this.owned = true;
          return new Promise(release => { this.releaseLock = release; resolve(true); });
        }).catch(() => resolve(false));
      });
    }
    adopt(raw) { this.expected = raw; }
    release() { this.owned = false; this.releaseLock?.(); this.releaseLock = null; }
    write(record) {
      if (!this.owned) return { ok: false, error: 'locked' };
      if (!valid(record)) return { ok: false, error: 'invalid' };
      try {
        if (!this.storage) throw Error('unavailable');
        const current = this.storage.getItem(KEY);
        // Also protects fallback browsers and changes made while this tab was suspended.
        if (current !== this.expected) return { ok: false, error: 'conflict' };
        const raw = JSON.stringify(record);
        if (parse(current)) this.storage.setItem(BACKUP, current);
        this.storage.setItem(KEY, raw); this.expected = raw; this.available = true;
        return { ok: true };
      } catch (_) { this.available = false; return { ok: false, error: 'unavailable' }; }
    }
  }
  const api = { Store, KEY, BACKUP, parse, valid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
