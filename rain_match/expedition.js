/* Run rules only: no DOM, clock, storage, or network dependencies. */
(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.RainMatch;
  const RELICS = {
    feather: { kind: 'passive', icon: 'feather', symbol: '↟' },
    shield: { kind: 'passive', icon: 'shield', symbol: '◈' },
    ukulele: { kind: 'passive', icon: 'ukulele', symbol: 'ϟ' },
    cell: { kind: 'passive', icon: 'cell', symbol: '▥' },
    blackhole: { kind: 'active', icon: 'blackhole', symbol: '◎' },
    radar: { kind: 'active', icon: 'radar', symbol: '⌖' }
  };
  function stageSpec(stage) {
    if (stage === 1) return { mode: 'drizzle', count: 36, theme: 'landing' };
    const fog = stage >= 5 && stage % 3 === 2;
    const layers = Array(Math.min(18, 2 * stage + 2)).fill(6);
    const pileSize = fog ? 18 : stage < 3 ? 6 : stage < 5 ? 9 : 12;
    return { mode: 'rain', layers, pileSize, kinds: Math.min(12, 4 + 2 * stage),
      target: stage < 4 ? 5 : 6, count: layers.length * 6 + 12 + pileSize * 2, theme: fog ? 'fog' : 'storm' };
  }
  class Expedition extends core.Game {
    constructor(random = Math.random) {
      super('drizzle', random);
      this.mode = 'expedition'; this.stage = 1; this.banked = 0; this.bankedMoves = 0;
      this.relics = {}; this.equipment = null; this.charge = 0; this.energy = 0;
      this.featherCharge = 0; this.featherEnergy = 0; this.shieldCooldown = 0;
      this.manualMatches = 0; this.rewardAt = 6; this.radarUntil = 0; this.finished = false;
      // Restoring the cursor with Undo also restores the next proc roll.
      this.rngState = Math.floor(random() * 0xffffffff) || 1;
      this.random = () => { let n = this.rngState; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
        this.rngState = n >>> 0; return this.rngState / 4294967296; };
      this.pendingReward = ['feather', 'shield', 'ukulele'];
    }
    get recovered() { return this.banked + this.cleared; }
    get totalMoves() { return this.bankedMoves + this.moves; }
    get capacity() { return 1 + (this.relics.cell || 0); }
    get recharge() { return Math.max(3, 6 - (this.relics.cell || 0)); }
    get radarActive() { return this.radarUntil > this.moves; }
    snapshot() {
      return { ...super.snapshot(), charge: this.charge, energy: this.energy,
        featherCharge: this.featherCharge, featherEnergy: this.featherEnergy,
        shieldCooldown: this.shieldCooldown, manualMatches: this.manualMatches,
        radarUntil: this.radarUntil, rngState: this.rngState };
    }
    blockers(tile) {
      return this.tiles.filter(other => other.zone === 'board' && other.z > tile.z && core.overlap(tile, other));
    }
    featherTargets() {
      return this.featherCharge ? this.tiles.filter(t => t.zone === 'board' && this.blockers(t).length === 1) : [];
    }
    cubeTargets() {
      const pairs = this.rack.map(id => this.tiles[id].type).filter((type, _, all) => all.filter(n => n === type).length === 2);
      return this.tiles.filter(t => t.zone === 'board' && pairs.includes(t.type) && this.blockers(t).length <= (this.relics.blackhole || 1));
    }
    previewIds() {
      if (!this.radarActive) return [];
      return ['left', 'right'].flatMap(pile => this.tiles.filter(t => t.zone === 'board' && t.pile === pile)
        .sort((a, b) => b.z - a.z).slice(1, 3).map(t => t.id));
    }
    canUse(tool) { return !this.finished && !this.pendingReward && super.canUse(tool); }
    use(tool) { return super.use(tool); }
    pick(id, leap = false) {
      if (this.finished || this.pendingReward) return { ok: false };
      const tile = this.tiles[id];
      if (this.status !== 'playing' || !tile) return { ok: false };
      const jumping = leap && this.featherTargets().some(t => t.id === id);
      if (leap && !jumping) return { ok: false };
      const before = this.snapshot();
      if (jumping) tile.zone = 'reserve'; // Use the same triple-before-overflow rule.
      const result = super.pick(id);
      if (!result.ok) { Object.assign(this, before); this.check(); return result; }
      this.previous = before;
      const events = [];
      if (jumping) { this.featherCharge--; events.push({ kind: 'feather', ids: [id] }); }
      if (this.status === 'lost' && this.relics.shield && this.shieldCooldown === 0) {
        Object.assign(this, before); this.shieldCooldown = Math.max(3, 6 - this.relics.shield);
        this.previous = null; this.check();
        return { ok: true, matched: false, type: tile.type, events: [{ kind: 'shield', ids: [id] }] };
      }
      if (result.matched) {
        this.manualMatches++;
        if (this.shieldCooldown > 0) this.shieldCooldown--;
        if (this.relics.feather && this.featherCharge === 0 && ++this.featherEnergy >= Math.max(3, 6 - this.relics.feather)) {
          this.featherCharge = 1; this.featherEnergy = 0;
        }
        if (this.equipment && this.charge < this.capacity && ++this.energy >= this.recharge) {
          this.charge++; this.energy = 0;
        }
        if (this.relics.ukulele && this.random() < .15 + .1 * this.relics.ukulele) {
          const exposed = this.available();
          const group = exposed.map(t => exposed.filter(other => other.type === t.type)).find(list => list.length >= 3);
          if (group) { const ids = group.slice(0, 3).map(t => t.id); this.clearTriple(ids); events.push({ kind: 'ukulele', ids }); }
        }
        this.check();
        if (this.manualMatches >= this.rewardAt) {
          this.rewardAt += 6;
          if (this.status !== 'won') this.offerReward();
        }
      }
      return { ...result, events };
    }
    clearTriple(ids) {
      if (ids.length !== 3 || new Set(ids).size !== 3 || new Set(ids.map(id => this.tiles[id].type)).size !== 1 ||
          ids.some(id => this.tiles[id].zone === 'matched')) throw Error('Invalid triple');
      ids.forEach(id => { this.tiles[id].zone = 'matched'; });
      this.rack = this.rack.filter(id => !ids.includes(id)); this.reserve = this.reserve.filter(id => !ids.includes(id));
      this.cleared += 3;
    }
    canActivate() {
      if (this.finished || this.pendingReward || this.status !== 'playing' || !this.charge) return false;
      return this.equipment === 'blackhole' ? this.cubeTargets().length > 0 : this.equipment === 'radar' && !this.radarActive;
    }
    activate(id) {
      if (!this.canActivate()) return { ok: false };
      let ids = [];
      if (this.equipment === 'blackhole') {
        const tile = this.cubeTargets().find(t => t.id === id);
        if (!tile) return { ok: false };
        ids = [...this.rack.filter(n => this.tiles[n].type === tile.type), id]; this.clearTriple(ids);
      } else this.radarUntil = this.moves + 3 + (this.relics.radar || 1);
      this.charge--; this.previous = null; this.check();
      return { ok: true, events: [{ kind: this.equipment, ids }] };
    }
    offerReward() {
      if (this.finished) return;
      const pool = Object.keys(RELICS).filter(id => (this.relics[id] || 0) < 3 && (id !== 'cell' || this.equipment));
      for (const tool of ['remove', 'undo', 'shuffle']) if (this.used[tool]) pool.push('restore_' + tool);
      const choices = [];
      // Guarantee a useful first opportunity to acquire active equipment.
      if (!this.equipment) choices.push('blackhole', 'radar');
      while (choices.length < 3 && pool.some(id => !choices.includes(id))) {
        const available = pool.filter(id => !choices.includes(id));
        choices.push(available[Math.floor(this.random() * available.length)]);
      }
      if (choices.length < 3) choices.push('recharge');
      this.pendingReward = choices; this.previous = null;
    }
    choose(id, replace) {
      if (!this.pendingReward?.includes(id)) return false;
      if (id === 'recharge') { this.charge = this.equipment ? this.capacity : 0; this.energy = 0; this.shieldCooldown = 0; if (this.relics.feather) this.featherCharge = 1; this.featherEnergy = 0; }
      else if (id.startsWith('restore_')) this.used[id.slice(8)] = false;
      else {
        const passives = Object.keys(this.relics).filter(key => RELICS[key].kind === 'passive');
        if (RELICS[id].kind === 'passive' && !this.relics[id] && passives.length === 3) {
          if (!passives.includes(replace)) return false;
          delete this.relics[replace];
          if (replace === 'feather') { this.featherCharge = 0; this.featherEnergy = 0; }
          if (replace === 'shield') this.shieldCooldown = 0;
        }
        const oldLevel = this.relics[id] || 0;
        if (RELICS[id].kind === 'active') {
          if (this.equipment && this.equipment !== id) delete this.relics[this.equipment];
          this.equipment = id; this.charge = Math.min(this.capacity, this.charge + 1); this.energy = 0;
        }
        this.relics[id] = Math.min(3, oldLevel + 1);
        if (id === 'feather') this.featherCharge = 1;
        if (id === 'shield') this.shieldCooldown = 0;
        if (id === 'cell') this.charge = Math.min(this.capacity, this.charge + 1);
        this.charge = Math.min(this.capacity, this.charge);
      }
      this.pendingReward = null; this.previous = null; return true;
    }
    nextStage() {
      if (this.status !== 'won' || this.pendingReward || this.finished) return false;
      this.banked += this.cleared; this.bankedMoves += this.moves; this.stage++;
      const spec = stageSpec(this.stage), next = new core.Game(spec.mode, this.random, spec);
      for (const key of ['tiles', 'rack', 'reserve', 'cleared', 'moves', 'status', 'previous', 'solution']) this[key] = next[key];
      this.radarUntil = 0; return true;
    }
    end() {
      if (this.finished || this.pendingReward) return false;
      this.finished = true; this.status = 'lost'; this.previous = null; return true;
    }
    loadout() { return Object.entries(this.relics).map(([id, level]) => ({ id, level })); }
  }
  const api = { Expedition, RELICS, stageSpec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainExpedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
