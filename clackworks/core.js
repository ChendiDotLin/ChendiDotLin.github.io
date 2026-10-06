/* Pure game rules, shared by the browser and the verification script. */
(function (root) {
  'use strict';
  // IDs/order stay stable for existing saves; only presentation metadata changes.
  const ITEMS = [
    { id: 'bear', icon: 'part-measure', name: '口袋卷尺', en: 'Pocket Tape Measure', color: '#d5deec' },
    { id: 'glasses', icon: 'part-battery', name: '迷你电池', en: 'Mini Battery', color: '#d5deec' },
    { id: 'syringe', icon: 'part-plug-side', name: '电源插头', en: 'Power Plug', color: '#d5deec' },
    { id: 'crowbar', icon: 'part-key', name: '柜门钥匙', en: 'Cabinet Key', color: '#d5deec' },
    { id: 'backupMag', icon: 'part-spring', name: '压缩弹簧', en: 'Compression Spring', color: '#d5deec' },
    { id: 'feather', icon: 'part-magnet', name: '马蹄磁铁', en: 'Horseshoe Magnet', color: '#9be2a4' },
    { id: 'bandolier', icon: 'part-spool', name: '绕线轴', en: 'Thread Spool', color: '#9be2a4' },
    { id: 'cell', icon: 'part-fan', name: '散热风扇', en: 'Cooling Fan', color: '#9be2a4' },
    { id: 'buckler', icon: 'part-tape', name: '胶带卷', en: 'Tape Roll', color: '#9be2a4' },
    { id: 'clover', icon: 'part-bell', name: '柜台铃', en: 'Counter Bell', color: '#f298a4' },
    { id: 'behemoth', icon: 'part-bolt', name: '六角螺栓', en: 'Hex Bolt', color: '#f298a4' },
    { id: 'blackhole', icon: 'part-tin', name: '颜料罐', en: 'Paint Tin', color: '#efc077' }
  ];
  const MODES = {
    drizzle: { name: '细雨热身', count: 36, kinds: 6 },
    rain: { name: '暴雨挑战', count: 108, kinds: 12 },
    monsoon: { name: '季风试炼', count: 144, kinds: 12 }
  };
  function shuffled(list, random) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function overlap(a, b) { return Math.abs(a.x - b.x) < 71 && Math.abs(a.y - b.y) < 71; }
  function layout(mode, random, options = {}) {
    const tiles = [];
    const add = (x, y, z, pile = 'main') => tiles.push({ id: tiles.length, x, y, z, type: 0, zone: 'board', pile });
    if (mode === 'drizzle') {
      for (let z = 0; z < 2; z++) for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++)
        add(145 + col * 77 + z * 18, 90 + row * 77 + z * 21, z);
    } else {
      // A deep, irregular core and thin side shelves create distinct resources:
      // digging reveals more tiles; spending a shelf tile does not.
      const layers = options.layers || (mode === 'rain' ? [8, 9, 8, 9, 8, 9, 8, 9, 10] : Array(12).fill(9));
      const patterns = [
        [0, 1, 3, 4, 5, 6, 8, 10, 11, 7, 2, 9],
        [1, 2, 4, 5, 7, 8, 9, 10, 11, 0, 3, 6],
        [0, 2, 3, 4, 6, 7, 8, 9, 11, 5, 1, 10]
      ];
      const rotation = Math.floor(random() * patterns.length);
      layers.forEach((count, z) => {
        const dx = [0, 28, -14, 17][z % 4], dy = [0, 24, -12, 13][z % 4];
        const pattern = patterns[(rotation + z) % patterns.length];
        for (const cell of pattern.slice(0, count)) {
          add(137 + (cell % 4) * 77 + dx, 73 + Math.floor(cell / 4) * 85 + dy, z);
        }
      });
      for (const x of [29, 496]) for (let row = 0; row < 3; row++) for (let z = 0; z < 2; z++)
        add(x + (x < 300 ? z * 9 : -z * 9), 92 + row * 103 + z * 12, z, 'shelf');
    }
    const pileSize = options.pileSize || (mode === 'drizzle' ? 6 : mode === 'monsoon' ? 12 : 9);
    for (const pile of ['left', 'right']) for (let i = 0; i < pileSize; i++)
      add(pile === 'left' ? 72 + i * 3 : 456 - i * 3, 464 + i * 2.5, 30 + i, pile);
    return tiles;
  }
  function dealTypes(order, tiles, mode, random, options = {}) {
    const kinds = options.kinds || MODES[mode].kinds;
    if (mode === 'drizzle') {
      for (let i = 0; i < order.length; i += 6) {
        const types = shuffled(Array.from({ length: kinds }, (_, k) => k), random);
        shuffled([types[0], types[0], types[0], types[1], types[1], types[1]], random)
          .forEach((type, j) => { tiles[order[i + j]].type = type; });
      }
      return;
    }
    // Construct one legal witness while carrying several unfinished sets across
    // many pickups. Unlike the old six-card packets, triples are widely separated.
    const remaining = Array(kinds).fill(0);
    for (let i = 0; i < tiles.length / 3; i++) remaining[i % kinds] += 3;
    const held = Array(kinds).fill(0);
    const target = options.target || (mode === 'monsoon' ? 6 : 5);
    for (const id of order) {
      const occupied = held.reduce((a, b) => a + b, 0);
      const candidates = [];
      for (let type = 0; type < kinds; type++) {
        if (!remaining[type]) continue;
        const next = [...held]; next[type] = (next[type] + 1) % 3;
        const size = next.reduce((a, b) => a + b, 0);
        // Six unrelated singletons would deadlock the witness itself.
        if (size > 6 || (size === 6 && !next.includes(2))) continue;
        const weight = held[type] === 2 ? (occupied < target ? .06 : 4) : held[type] === 0 ? 3 : 1.2;
        candidates.push({ type, weight });
      }
      let choice = random() * candidates.reduce((sum, c) => sum + c.weight, 0);
      let type = candidates[candidates.length - 1].type;
      for (const candidate of candidates) { choice -= candidate.weight; if (choice <= 0) { type = candidate.type; break; } }
      tiles[id].type = type; remaining[type]--; held[type] = (held[type] + 1) % 3;
    }
  }
  function exposed(tile, tiles) {
    return tile.zone === 'board' && !tiles.some(other => other.zone === 'board' && other.z > tile.z && overlap(tile, other));
  }
  class Game {
    constructor(mode = 'rain', random = Math.random, options = {}) {
      this.mode = MODES[mode] ? mode : 'rain'; this.random = random;
      this.tiles = layout(this.mode, random, options); this.rack = []; this.reserve = [];
      this.used = { remove: false, undo: false, shuffle: false };
      this.cleared = 0; this.moves = 0; this.status = 'playing'; this.previous = null;
      // A random topological removal order provides a known legal solution.
      const copy = this.tiles.map(t => ({ ...t }));
      const order = [];
      while (order.length < copy.length) {
        const available = copy.filter(t => exposed(t, copy));
        const tile = available[Math.floor(random() * available.length)];
        order.push(tile.id); tile.zone = 'matched';
      }
      dealTypes(order, this.tiles, this.mode, random, options);
      this.solution = order;
    }
    available() { return this.tiles.filter(t => exposed(t, this.tiles)); }
    snapshot() {
      return { tiles: this.tiles.map(t => ({ ...t })), rack: [...this.rack], reserve: [...this.reserve], cleared: this.cleared, moves: this.moves };
    }
    pick(id) {
      const tile = this.tiles[id];
      if (this.status !== 'playing' || !tile || (tile.zone !== 'reserve' && !exposed(tile, this.tiles))) return { ok: false };
      this.previous = this.snapshot();
      if (tile.zone === 'reserve') this.reserve = this.reserve.filter(n => n !== id);
      tile.zone = 'rack'; this.moves++;
      const last = this.rack.map(n => this.tiles[n].type).lastIndexOf(tile.type);
      this.rack.splice(last < 0 ? this.rack.length : last + 1, 0, id);
      const same = this.rack.filter(n => this.tiles[n].type === tile.type);
      const matched = same.length === 3;
      if (matched) {
        same.forEach(n => { this.tiles[n].zone = 'matched'; });
        this.rack = this.rack.filter(n => !same.includes(n)); this.cleared += 3;
      }
      this.check();
      return { ok: true, matched, type: tile.type };
    }
    check() {
      this.status = this.cleared === this.tiles.length ? 'won' : this.rack.length >= 7 ? 'lost' : 'playing';
    }
    canUse(tool) {
      if (!(tool in this.used) || this.used[tool] || this.status === 'won') return false;
      if (tool === 'undo') return this.previous !== null;
      if (tool === 'remove') return this.rack.length > 0 && this.reserve.length === 0;
      return this.status === 'playing' && new Set(this.tiles.filter(t => t.zone === 'board').map(t => t.type)).size > 1;
    }
    use(tool) {
      if (!this.canUse(tool)) return false;
      if (tool === 'undo') {
        Object.assign(this, this.previous); this.previous = null;
      } else if (tool === 'remove') {
        this.reserve = this.rack.splice(0, 3);
        this.reserve.forEach(id => { this.tiles[id].zone = 'reserve'; });
        this.previous = null;
      } else {
        const remaining = this.tiles.filter(t => t.zone === 'board');
        const before = remaining.map(t => t.type);
        let after = shuffled(before, this.random);
        if (after.every((type, i) => type === before[i])) after = [...before.slice(1), before[0]];
        remaining.forEach((t, i) => { t.type = after[i]; }); this.previous = null;
      }
      this.used[tool] = true; this.check(); return true;
    }
  }
  const api = { Game, ITEMS, MODES, exposed, overlap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
