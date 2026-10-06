/* Run rules only: no DOM, clock, storage, or network dependencies. */
(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.RainMatch;
  const VERSION = 3;
  const PASSIVE_SLOTS = 6;
  const RELICS = {
    feather: { kind: 'passive', icon: 'feather', symbol: '↟', rarity: 'uncommon', weight: 60 },
    shield: { kind: 'passive', icon: 'shield', symbol: '◈', rarity: 'void', weight: 35 },
    ukulele: { kind: 'passive', icon: 'ukulele', symbol: 'ϟ', rarity: 'uncommon', weight: 60 },
    cell: { kind: 'passive', icon: 'cell', symbol: '▥', rarity: 'uncommon', weight: 60 },
    gasoline: { kind: 'passive', icon: 'gasoline', symbol: '♨', rarity: 'common', weight: 100 },
    behemoth: { kind: 'passive', icon: 'behemoth', symbol: '✹', rarity: 'legendary', weight: 60 },
    clover: { kind: 'passive', icon: 'clover', symbol: '♧', rarity: 'legendary', weight: 40 },
    blackhole: { kind: 'active', icon: 'blackhole', symbol: '◎', rarity: 'equipment', weight: 45 },
    radar: { kind: 'active', icon: 'radar', symbol: '⌖', rarity: 'equipment', weight: 45 }
  };
  function weightedChoice(pool, random) {
    const weight = id => RELICS[id]?.weight ?? 50;
    let roll = random() * pool.reduce((total, id) => total + weight(id), 0);
    for (const id of pool) { roll -= weight(id); if (roll < 0) return id; }
    return pool[pool.length - 1];
  }
  function stageSpec(stage) {
    if (stage === 1) return { mode: 'rain', layers: [6, 6], pileSize: 6, kinds: 6, target: 4, count: 36, theme: 'landing' };
    const fog = stage >= 5 && stage % 3 === 2;
    const ion = stage >= 6 && stage % 3 === 0;
    const layers = Array(Math.min(18, 2 * stage + 2)).fill(6);
    const pileSize = fog ? 18 : stage < 3 ? 6 : stage < 5 ? 9 : 12;
    return { mode: 'rain', layers, pileSize, kinds: Math.min(12, 4 + 2 * stage),
      target: stage < 3 ? 5 : 6, count: layers.length * 6 + 12 + pileSize * 2, theme: stage === 10 ? 'boss' : fog ? 'fog' : ion ? 'ion' : 'storm' };
  }
  function bankedBefore(stage) {
    let sum = 0;
    for (let i = 1; i < Math.min(stage, 9); i++) sum += stageSpec(i).count;
    if (stage > 9) sum += (stage - 9) * 144 + Math.floor((stage - 9) / 3) * 12;
    return sum;
  }
  function bindRandom(game) {
    game.random = () => { let n = game.rngState; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
      game.rngState = n >>> 0; return game.rngState / 4294967296; };
  }
  const PICK_FIELDS = ['charge', 'energy', 'featherCharge', 'featherEnergy', 'shieldSpent', 'manualMatches',
    'stageMatches', 'radarUntil', 'radarMark', 'spark', 'lightningReady', 'rngState', 'bestChain', 'blastCharge', 'relics', 'equipment', 'sealed', 'bossEnergy', 'bossStarted'];
  const RUN_FIELDS = ['stage', 'banked', 'bankedMoves', 'competitive', 'finished', 'pendingReward', 'midRewardTaken', 'restocksUsed'];
  class Expedition extends core.Game {
    constructor(random = Math.random) {
      const spec = stageSpec(1); super(spec.mode, random, spec);
      this.mode = 'expedition'; this.stage = 1; this.banked = 0; this.bankedMoves = 0;
      this.relics = {}; this.sealed = {}; this.blastCharge = 0; this.competitive = true; this.equipment = null; this.charge = 0; this.energy = 0;
      this.bossEnergy = 0; this.bossStarted = false;
      this.featherCharge = 0; this.featherEnergy = 0; this.shieldSpent = false;
      this.manualMatches = 0; this.stageMatches = 0; this.midRewardTaken = false; this.restocksUsed = 0;
      this.radarUntil = 0; this.radarMark = null; this.spark = 0; this.lightningReady = false;
      this.bestChain = 0; this.finished = false;
      this.rngState = Math.floor(random() * 0xffffffff) || 1; bindRandom(this);
      this.pendingReward = ['feather', 'ukulele', 'blackhole'];
    }
    get bossActive() { return this.stage === 10 && this.cleared < this.tiles.length; }
    get sealedLevels() { return Object.entries(this.sealed).reduce((sum, [id, target]) => sum + (RELICS[id].kind === 'active' ? 1 : target - (this.relics[id] || 0)), 0); }
    get completedStages() { return this.stage - 1 + Number(this.cleared === this.tiles.length); }
    get evolutionSlots() { return this.stage < 6 ? 0 : this.stage < 10 ? 2 : 6; }
    ownedRelics() { return { ...this.relics, ...this.sealed }; }
    get recovered() { return this.banked + this.cleared; }
    get totalMoves() { return this.bankedMoves + this.moves; }
    get capacity() { return 1 + (this.relics.cell || 0); }
    get recharge() { return 8 - (this.relics.cell || 0) + (stageSpec(this.stage).theme === 'ion' ? 2 : 0); }
    get featherRecharge() { return 9 - (this.relics.feather || 1); }
    get radarActive() { return this.radarUntil > this.moves; }
    get rewardTarget() { return this.stage === 1 ? 3 : Math.min(12, 4 + this.stage); }
    get legendaryChance() { return this.stage >= 11 ? .25 : .18; }
    get levelCap() { return this.stage < 3 ? 1 : this.stage < 6 ? 2 : 3; }
    get evolved() { return Object.keys(this.relics).find(id => this.relics[id] === 3) || null; }
    snapshot() {
      return { ...super.snapshot(), ...JSON.parse(JSON.stringify(Object.fromEntries(PICK_FIELDS.map(key => [key, this[key]])))) };
    }
    blockers(tile) {
      return this.tiles.filter(other => other.zone === 'board' && other.z > tile.z && core.overlap(tile, other));
    }
    featherTargets() {
      const depth = this.relics.feather === 3 ? 2 : 1;
      return this.relics.feather && this.featherCharge ? this.tiles.filter(t => t.zone === 'board' && this.blockers(t).length >= 1 && this.blockers(t).length <= depth) : [];
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
    addEnergy(amount) {
      if (!this.equipment) return;
      if (this.charge === this.capacity) {
        if (this.relics.cell === 3) this.energy = Math.min(2, this.energy + amount);
        return;
      }
      this.energy += amount;
      while (this.energy >= this.recharge && this.charge < this.capacity) { this.charge++; this.energy -= this.recharge; }
      if (this.charge === this.capacity) this.energy = this.relics.cell === 3 ? Math.min(2, this.energy) : 0;
    }
    rollLightning() {
      if (!this.relics.ukulele) return;
      this.spark++;
      if (this.random() < .2 + .05 * this.relics.ukulele + .05 * (this.relics.clover || 0) || this.spark >= (this.relics.ukulele >= 2 ? 3 : 4)) {
        this.lightningReady = true; this.spark = 0;
      }
    }
    findTriple(depth = 0) {
      // Prefer freeing the tray; a proc no longer silently requires three board-only tiles.
      const accessible = this.tiles.filter(t => t.zone === 'rack' || t.zone === 'reserve' ||
        (t.zone === 'board' && this.blockers(t).length <= depth));
      const groups = core.ITEMS.map((_, type) => accessible.filter(t => t.type === type)
        .sort((a, b) => Number(b.zone === 'rack') - Number(a.zone === 'rack'))).filter(group => group.length >= 3);
      groups.sort((a, b) => b.filter(t => t.zone === 'rack').length - a.filter(t => t.zone === 'rack').length);
      return groups[0]?.slice(0, 3).map(t => t.id) || null;
    }
    clearTriple(ids) {
      if (ids.length !== 3 || new Set(ids).size !== 3 || new Set(ids.map(id => this.tiles[id].type)).size !== 1 ||
          ids.some(id => this.tiles[id].zone === 'matched')) throw Error('Invalid triple');
      ids.forEach(id => { this.tiles[id].zone = 'matched'; });
      this.rack = this.rack.filter(id => !ids.includes(id)); this.reserve = this.reserve.filter(id => !ids.includes(id));
      this.cleared += 3;
    }
    beginBurst() {
      this.comboQueue = [];
      this.bossChainAwarded = false;
      this.burstLeft = this.relics.clover === 3 ? 52 : 16 + 2 * Object.keys(this.relics).length;
    }
    reclaim(events, full = false) {
      const ids = Object.keys(this.sealed); if (!ids.length) return;
      const unopened = ids.filter(id => !this.relics[id]);
      const pool = unopened.length ? unopened : ids;
      const id = pool[Math.floor(this.random() * pool.length)], target = this.sealed[id], oldLevel = this.relics[id] || 0;
      this.relics[id] = full || RELICS[id].kind === 'active' ? target : oldLevel + 1;
      if (this.relics[id] === target) delete this.sealed[id];
      if (RELICS[id].kind === 'active') { this.equipment = id; this.charge = 1; this.energy = 0; }
      if (id === 'feather' && !oldLevel) { this.featherCharge = 1; this.featherEnergy = 0; }
      events.push({ kind: 'reclaim', relic: id, level: this.relics[id], target, ids: [] });
      if (!Object.keys(this.sealed).length) this.bossEnergy = 0;
    }
    chargeSeal(events, manual) {
      if (this.stage !== 10 || !Object.keys(this.sealed).length) return;
      if (manual && !this.bossStarted) {
        this.bossStarted = true; this.reclaim(events); return;
      }
      // A whole action's procs share one point, regardless of burst size.
      if (!manual && this.bossChainAwarded) return;
      if (!manual) this.bossChainAwarded = true;
      this.bossEnergy += manual ? 2 : 1;
      events.push({ kind: 'sealEnergy', amount: manual ? 2 : 1, ids: [] });
      if (this.bossEnergy >= 3) { this.bossEnergy -= 3; this.reclaim(events); }
    }
    onTriple(events, manual = false) {
      this.chargeSeal(events, manual);
      if (this.relics.behemoth && ++this.blastCharge >= 5 - this.relics.behemoth) {
        this.blastCharge = 0;
        this.comboQueue.push({ kind: 'behemoth', depth: this.relics.behemoth });
      }
      if (this.relics.gasoline && this.random() < .15 + .1 * this.relics.gasoline + .05 * (this.relics.clover || 0))
        this.comboQueue.push({ kind: 'gasoline', depth: this.relics.gasoline === 3 ? 1 : 0 });
    }
    drainBurst(events) {
      while (this.comboQueue.length && this.burstLeft > 0) {
        const proc = this.comboQueue.shift(); this.pulse(events, proc.kind, 1, proc.depth);
      }
      this.comboQueue = [];
      // Winning must restore gear even if the final burst skipped the return phase.
      if (this.cleared === this.tiles.length && this.stage === 10) {
        while (Object.keys(this.sealed).length) this.reclaim(events, true);
        this.bossEnergy = 0;
        events.push({ kind: 'bossBreak', ids: [] });
      }
    }
    pulse(events, kind, count, depth = 0) {
      if (!this.comboQueue) this.beginBurst();
      let recovered = 0;
      for (let i = 0; i < count && this.burstLeft > 0; i++) {
        const ids = this.findTriple(depth); if (!ids) break;
        this.clearTriple(ids); this.burstLeft--; events.push({ kind, ids }); recovered += 3; this.onTriple(events);
        // Fractional Cell recovery cannot pay for the cast that created the chain.
        if (this.relics.cell) this.addEnergy(.25);
      }
      return recovered;
    }
    resolveCombos(events, { type, jumping = false, scanned = false, skill = false } = {}) {
      if (!this.comboQueue) this.beginBurst();
      const before = this.cleared;
      let retarget = false;
      if (scanned && type === this.radarMark) {
        this.addEnergy(2);
        this.pulse(events, 'radar', jumping || this.relics.radar === 3 ? 2 : 1);
        if (this.relics.radar === 3) retarget = true;
        else { this.radarUntil = 0; this.radarMark = null; }
        if (this.relics.ukulele) this.lightningReady = true;
      }
      if (jumping) {
        if (this.relics.feather === 3) this.addEnergy(2);
        if (this.relics.ukulele) this.lightningReady = true;
      } else if (skill) this.rollLightning();
      if (this.lightningReady && this.relics.ukulele) {
        const count = this.relics.ukulele === 3 ? 3 : 1;
        if (this.pulse(events, 'ukulele', count, this.relics.ukulele === 3 ? 1 : 0)) this.lightningReady = false;
      }
      this.drainBurst(events);
      // Choose the next bounty after lightning, so it cannot mark a vanished type.
      if (retarget) this.markRadar();
      const recovered = this.cleared - before;
      this.bestChain = Math.max(this.bestChain, recovered + 3);
      this.check(); return recovered;
    }
    pick(id, leap = false) {
      if (this.finished || this.pendingReward || this.status !== 'playing') return { ok: false };
      const tile = this.tiles[id]; if (!tile) return { ok: false };
      const jumping = leap && this.featherTargets().some(t => t.id === id);
      if (leap && !jumping) return { ok: false };
      this.beginBurst();
      const before = this.snapshot(), scanned = this.radarActive;
      if (jumping) tile.zone = 'reserve';
      const result = super.pick(id);
      if (!result.ok) { Object.assign(this, before); this.check(); return result; }
      this.previous = before;
      const events = [];
      if (jumping) { this.featherCharge--; events.push({ kind: 'feather', ids: [id] }); }
      if (this.status === 'lost' && this.relics.shield && !this.shieldSpent) {
        Object.assign(this, before); this.shieldSpent = true; this.previous = null;
        events.length = 0; events.push({ kind: 'shield', ids: [id] });
        if (this.relics.shield >= 2) this.addEnergy(2);
        if (this.relics.shield === 3) this.pulse(events, 'shield', 2);
        this.drainBurst(events);
        this.bestChain = Math.max(this.bestChain, this.cleared - before.cleared);
        this.check(); return { ok: true, matched: false, type: tile.type, events, recovered: this.cleared - before.cleared };
      }
      if (result.matched) {
        this.manualMatches++; this.stageMatches++; this.onTriple(events, true); this.addEnergy(1);
        if (this.relics.feather && this.featherCharge === 0 && ++this.featherEnergy >= this.featherRecharge) {
          this.featherCharge = 1; this.featherEnergy = 0;
        }
        this.rollLightning(); this.resolveCombos(events, { type: result.type, jumping, scanned });
        if (!this.bossActive && !this.midRewardTaken && this.stageMatches >= this.rewardTarget) {
          this.midRewardTaken = true;
          if (this.status !== 'won') this.offerReward();
        }
      }
      return { ...result, events, recovered: this.cleared - before.cleared };
    }
    canActivate() {
      if (this.finished || this.pendingReward || this.status !== 'playing' || !this.charge) return false;
      return this.equipment === 'blackhole' ? this.cubeTargets().length > 0 : this.equipment === 'radar' && !this.radarActive;
    }
    markRadar() {
      const types = [...new Set(this.tiles.filter(t => t.zone === 'board').map(t => t.type))];
      types.sort((a, b) => this.rack.filter(id => this.tiles[id].type === b).length - this.rack.filter(id => this.tiles[id].type === a).length);
      this.radarMark = types[0] ?? null;
    }
    activate(id) {
      if (!this.canActivate()) return { ok: false };
      this.beginBurst();
      const events = [], before = this.cleared;
      if (this.equipment === 'blackhole') {
        const tile = this.cubeTargets().find(t => t.id === id); if (!tile) return { ok: false };
        this.charge--; this.previous = null;
        const ids = [...this.rack.filter(n => this.tiles[n].type === tile.type), id];
        this.clearTriple(ids); events.push({ kind: 'blackhole', ids }); this.onTriple(events);
        if (this.relics.cell) this.addEnergy(.25);
        if (this.relics.blackhole === 3) {
          for (let i = 0; i < 2; i++) {
            const next = this.cubeTargets()[0]; if (!next) break;
            const more = [...this.rack.filter(n => this.tiles[n].type === next.type), next.id];
            this.clearTriple(more); events.push({ kind: 'blackhole', ids: more }); this.onTriple(events);
            if (this.relics.cell) this.addEnergy(.25);
          }
        }
        this.resolveCombos(events, { skill: true });
      } else {
        this.charge--; this.previous = null; this.radarUntil = this.moves + 3 + (this.relics.radar || 1);
        this.markRadar(); events.push({ kind: 'radar', ids: [] });
      }
      this.check(); this.bestChain = Math.max(this.bestChain, this.cleared - before);
      return { ok: true, events, recovered: this.cleared - before };
    }
    offerReward() {
      if (this.finished || this.pendingReward || this.bossActive) return;
      const pool = Object.keys(RELICS).filter(id => (this.relics[id] || 0) < this.levelCap && (id !== 'cell' || this.equipment));
      if (this.restocksUsed < 2) for (const tool of ['remove', 'undo', 'shuffle']) if (this.used[tool]) pool.push('restore_' + tool);
      const choices = [];
      // Roll the red slot separately so capped common gear cannot force red drops.
      // The same rarity roll applies to obtaining and upgrading legendary items.
      const legendary = pool.filter(id => RELICS[id]?.rarity === 'legendary');
      if (legendary.length && this.random() < this.legendaryChance) choices.push(weightedChoice(legendary, this.random));
      if (!this.equipment) choices.push('blackhole', 'radar');
      const ordinary = pool.filter(id => RELICS[id]?.rarity !== 'legendary');
      while (choices.length < 3 && ordinary.some(id => !choices.includes(id))) {
        const available = ordinary.filter(id => !choices.includes(id));
        choices.push(weightedChoice(available, this.random));
      }
      if (choices.length < 3) choices.push('recharge');
      this.pendingReward = choices; this.previous = null;
    }
    choose(id, replace) {
      if (!this.pendingReward?.includes(id)) return false;
      if (id === 'recharge') {
        if (this.equipment) this.charge = Math.min(this.capacity, this.charge + 1);
        else if (this.relics.feather) { this.featherCharge = 1; this.featherEnergy = 0; }
      } else if (id.startsWith('restore_')) {
        if (this.restocksUsed >= 2) return false;
        this.used[id.slice(8)] = false; this.restocksUsed++;
      } else {
        if (!RELICS[id] || (this.relics[id] || 0) >= this.levelCap) return false;
        const passives = Object.keys(this.relics).filter(key => RELICS[key].kind === 'passive');
        if (RELICS[id].kind === 'passive' && !this.relics[id] && passives.length === PASSIVE_SLOTS) {
          if (!passives.includes(replace)) return false;
          delete this.relics[replace];
          if (replace === 'feather') { this.featherCharge = 0; this.featherEnergy = 0; }
          if (replace === 'behemoth') this.blastCharge = 0;
          if (replace === 'ukulele') { this.spark = 0; this.lightningReady = false; }
        }
        const oldLevel = this.relics[id] || 0;
        if (oldLevel === 2 && Object.values(this.relics).filter(level => level === 3).length >= this.evolutionSlots)
          this.relics[this.evolved] = 2;
        if (RELICS[id].kind === 'active') {
          const first = !this.equipment;
          if (this.equipment && this.equipment !== id) delete this.relics[this.equipment];
          this.equipment = id;
          if (first) { this.charge = 1; this.energy = 0; }
          this.radarUntil = 0; this.radarMark = null;
        }
        this.relics[id] = oldLevel + 1;
        if (id === 'feather' && !oldLevel) this.featherCharge = 1;
        // Neither upgrades nor swapping the shield restore its once-per-stage block.
        this.charge = Math.min(this.capacity, this.charge);
        if (this.charge === this.capacity) this.energy = this.relics.cell === 3 ? Math.min(2, this.energy) : 0;
      }
      this.pendingReward = null; this.previous = null; return true;
    }
    nextStage() {
      if (this.status !== 'won' || this.pendingReward || this.finished) return false;
      this.banked += this.cleared; this.bankedMoves += this.moves; this.stage++;
      const spec = stageSpec(this.stage), next = new core.Game(spec.mode, this.random, spec);
      for (const key of ['tiles', 'rack', 'reserve', 'cleared', 'moves', 'status', 'previous', 'solution']) this[key] = next[key];
      this.radarUntil = 0; this.radarMark = null; this.stageMatches = 0; this.midRewardTaken = false; this.shieldSpent = false;
      this.bossEnergy = 0; this.bossStarted = false;
      if (this.stage === 10) {
        this.sealed = { ...this.relics }; this.relics = {}; this.equipment = null;
        this.charge = 0; this.energy = 0; this.featherCharge = 0; this.featherEnergy = 0;
        this.lightningReady = false; this.spark = 0; this.blastCharge = 0; this.midRewardTaken = true;
      }
      return true;
    }
    end() {
      if (this.finished || this.pendingReward) return false;
      this.finished = true; this.status = 'lost'; this.previous = null; return true;
    }
    loadout() { return Object.entries(this.ownedRelics()).map(([id, level]) => ({ id, level })); }
    toSave() {
      return JSON.parse(JSON.stringify({ version: VERSION, ...this.snapshot(),
        ...Object.fromEntries(RUN_FIELDS.map(key => [key, this[key]])), used: this.used, status: this.status, previous: this.previous }));
    }
    static fromSave(data) {
      data = normalizeSave(data);
      if (!validSave(data)) throw Error('invalidSave');
      const game = Object.create(Expedition.prototype);
      for (const key of [...RUN_FIELDS, ...PICK_FIELDS, 'tiles', 'rack', 'reserve', 'cleared', 'moves', 'used', 'status', 'previous'])
        game[key] = JSON.parse(JSON.stringify(data[key]));
      game.mode = 'expedition'; game.solution = []; bindRandom(game); return game;
    }
  }
  const integer = (n, min = 0, max = 1e9) => Number.isSafeInteger(n) && n >= min && n <= max;
  // Additive v3 checkpoint upgrade: retain already-returned gear and the old Undo state.
  function normalizeSave(data) {
    if (!data || data.version !== VERSION) return data;
    const copy = JSON.parse(JSON.stringify(data));
    for (const state of [copy, copy.previous].filter(Boolean)) {
      if (state.bossEnergy === undefined) state.bossEnergy = 0;
      if (state.bossStarted === undefined) state.bossStarted = copy.stage === 10 && state.stageMatches > 0;
    }
    return copy;
  }
  function validSeals(data, stage, count) {
    if (!data.relics || typeof data.relics !== 'object' || Array.isArray(data.relics) ||
      !data.sealed || typeof data.sealed !== 'object' || Array.isArray(data.sealed)) return false;
    if (Object.entries(data.relics).some(([id, level]) => !Object.hasOwn(RELICS, id) || !integer(level, 1, 3))) return false;
    return Object.entries(data.sealed).every(([id, target]) => Object.hasOwn(RELICS, id) && integer(target, 1, 3) &&
      stage === 10 && data.cleared < count && (data.relics[id] || 0) < target &&
      !(RELICS[id].kind === 'active' && data.relics[id])) &&
      (Object.keys(data.sealed).length > 0 || data.bossEnergy === 0);
  }
  function validSnapshot(data, count) {
    if (!data || !Array.isArray(data.tiles) || data.tiles.length !== count || !Array.isArray(data.rack) || !Array.isArray(data.reserve) ||
      data.rack.length > 7 || data.reserve.length > 3 || !integer(data.cleared, 0, count) || !integer(data.moves) ||
      !integer(data.charge, 0, 4) || !Number.isFinite(data.energy) || data.energy < 0 || data.energy > 12 ||
      !integer(data.featherCharge, 0, 1) || !integer(data.featherEnergy, 0, 8) || typeof data.shieldSpent !== 'boolean' ||
      !integer(data.manualMatches) || !integer(data.stageMatches, 0, count / 3) || !integer(data.radarUntil) ||
      !(data.radarMark === null || integer(data.radarMark, 0, core.ITEMS.length - 1)) || !integer(data.spark, 0, 4) ||
      typeof data.lightningReady !== 'boolean' || !integer(data.rngState, 1, 0xffffffff) || !integer(data.bestChain, 0, 156) || !integer(data.blastCharge, 0, 4) ||
      !integer(data.bossEnergy, 0, 2) || typeof data.bossStarted !== 'boolean') return false;
    const ids = [...data.rack, ...data.reserve], counts = Array(core.ITEMS.length).fill(0);
    if (new Set(ids).size !== ids.length || ids.some(id => !integer(id, 0, count - 1))) return false;
    if (!data.tiles.every((t, id) => {
      if (!t || t.id !== id || !integer(t.type, 0, core.ITEMS.length - 1) ||
        !Number.isFinite(t.x) || t.x < 0 || t.x > 528 || !Number.isFinite(t.y) || t.y < 0 || t.y > 518 ||
        !integer(t.z, 0, 50) || !['main', 'shelf', 'left', 'right'].includes(t.pile) ||
        !['board', 'rack', 'reserve', 'matched'].includes(t.zone)) return false;
      if (t.zone !== 'matched') counts[t.type]++;
      return (t.zone === 'rack') === data.rack.includes(id) && (t.zone === 'reserve') === data.reserve.includes(id);
    })) return false;
    return counts.every(n => n % 3 === 0) && data.tiles.filter(t => t.zone === 'matched').length === data.cleared;
  }
  function validSave(data) {
    if (!data || data.version !== VERSION || !integer(data.stage, 1, 1000000)) return false;
    const count = stageSpec(data.stage).count;
    if (!validSnapshot(data, count) || data.banked !== bankedBefore(data.stage) || !integer(data.bankedMoves) ||
      typeof data.competitive !== 'boolean' || typeof data.finished !== 'boolean' || typeof data.midRewardTaken !== 'boolean' || !integer(data.restocksUsed, 0, 2) ||
      !data.used || !['remove', 'undo', 'shuffle'].every(id => typeof data.used[id] === 'boolean') ||
      !data.relics || typeof data.relics !== 'object' || Array.isArray(data.relics)) return false;
    if (!validSeals(data, data.stage, count) || (data.stage !== 10 && (data.bossEnergy || data.bossStarted))) return false;
    const relics = Object.entries({ ...data.relics, ...data.sealed });
    if (relics.length > 7 || relics.some(([id, level]) => !Object.hasOwn(RELICS, id) || !integer(level, 1, data.stage < 3 ? 1 : data.stage < 6 ? 2 : 3)) ||
      relics.filter(([, level]) => level === 3).length > (data.stage < 6 ? 0 : data.stage < 10 ? 2 : 6) || relics.filter(([id]) => RELICS[id].kind === 'passive').length > PASSIVE_SLOTS) return false;
    const actives = Object.entries(data.relics).filter(([id]) => RELICS[id].kind === 'active');
    if (relics.filter(([id]) => RELICS[id].kind === 'active').length > 1 || actives.length > 1 || (actives[0]?.[0] || null) !== data.equipment) return false;
    if (data.charge > 1 + (data.relics.cell || 0) || (!data.equipment && (data.charge || data.energy)) ||
      (!data.relics.feather && (data.featherCharge || data.featherEnergy)) || data.manualMatches > (data.banked + data.cleared) / 3 ||
      data.stageMatches > data.cleared / 3 || data.stageMatches > data.manualMatches) return false;
    const status = data.finished ? 'lost' : data.cleared === count ? 'won' : data.rack.length >= 7 ? 'lost' : 'playing';
    if (data.status !== status) return false;
    if (data.pendingReward !== null && (!Array.isArray(data.pendingReward) || data.pendingReward.length < 1 || data.pendingReward.length > 3 ||
      new Set(data.pendingReward).size !== data.pendingReward.length || data.pendingReward.some(id => !Object.hasOwn(RELICS, id) &&
        !['recharge', 'restore_remove', 'restore_undo', 'restore_shuffle'].includes(id)))) return false;
    if (data.previous && (!validSeals(data.previous, data.stage, count) ||
      JSON.stringify(Object.entries({ ...data.previous.relics, ...data.previous.sealed }).sort()) !== JSON.stringify(relics.sort()) ||
      (data.stage !== 10 && (data.previous.bossEnergy || data.previous.bossStarted)) ||
      (Object.keys(data.previous.relics).find(id => RELICS[id].kind === 'active') || null) !== data.previous.equipment)) return false;
    if (data.previous && (data.previous.charge > 1 + (data.previous.relics.cell || 0) ||
      (!data.previous.equipment && (data.previous.charge || data.previous.energy)) ||
      (!data.previous.relics.feather && (data.previous.featherCharge || data.previous.featherEnergy)))) return false;
    return data.previous === null || (validSnapshot(data.previous, count) && data.previous.rack.length < 7 && data.previous.cleared <= data.cleared);
  }
  const api = { Expedition, RELICS, PASSIVE_SLOTS, stageSpec, VERSION, validSave, bankedBefore, normalizeSave };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainExpedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
