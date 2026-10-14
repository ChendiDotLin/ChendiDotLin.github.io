/* Standalone hard challenge; no Expedition progression or save ownership. */
(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.RainMatch;
  class Eclipse extends core.Game {
    constructor(random = Math.random) {
      super('eclipse', random);
      this.environment = {kind: 'memory', started: false, preview: 5000, cards: []};
      this.pressure = {started: false, hearts: 3, remaining: 8000};
      this.refreshEnvironment();
    }
    refreshEnvironment() {
      const env = this.environment, available = this.available(), ids = new Set(available.map(t => t.id));
      env.cards = env.cards.filter(card => ids.has(card.id));
      for (const tile of available) {
        if (env.cards.length >= 5) break;
        if (!env.cards.some(card => card.id === tile.id)) env.cards.push({id: tile.id, remaining: 3000});
      }
    }
    advanceEnvironment(ms) {
      const env = this.environment;
      if (!env.started || this.status !== 'playing' || !Number.isFinite(ms) || ms <= 0) return;
      env.preview = Math.max(0, env.preview - ms);
      for (const card of env.cards) card.remaining = Math.max(0, card.remaining - ms);
    }
    memoryHidden(id) {
      const env = this.environment;
      return env.started && !env.preview && env.cards.some(card => card.id === id && !card.remaining);
    }
    advancePressure(ms) {
      const p = this.pressure;
      if (!p.started || this.status !== 'playing' || !Number.isFinite(ms) || ms <= 0) return null;
      const hearts = p.hearts;
      while (p.hearts && ms >= p.remaining) {
        ms -= p.remaining; p.hearts--; p.remaining = p.hearts ? 8000 : 0;
      }
      if (p.hearts) p.remaining -= ms;
      else { this.status = 'lost'; this.previous = null; }
      return p.hearts < hearts ? {lost: hearts - p.hearts, ended: !p.hearts} : null;
    }
    pick(id) {
      if (!this.pressure.hearts) return {ok: false};
      const result = super.pick(id);
      if (result.ok) {
        this.environment.started = this.pressure.started = true;
        this.pressure.remaining = 8000;
        if (result.matched) this.environment.preview = Math.max(2000, this.environment.preview);
        this.refreshEnvironment();
      }
      return result;
    }
    canUse(tool) { return this.pressure.hearts > 0 && super.canUse(tool); }
    use(tool) {
      const ok = super.use(tool);
      if (ok) {
        this.refreshEnvironment();
        if (tool === 'shuffle') this.environment.preview = Math.max(3000, this.environment.preview);
      }
      // Undo restores tiles only; neither lost hearts nor elapsed timers rewind.
      return ok;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {Eclipse};
  else root.CritterEclipse = {Eclipse};
})(typeof globalThis !== 'undefined' ? globalThis : this);
