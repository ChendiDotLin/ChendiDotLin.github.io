'use strict';
// A visible-card greedy player, not an estimate of human win rates.
// Optional argument: path to a previous core.js for the same comparison.
const { Game } = require(process.argv[2] || '../rain_match/core.js');
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
for (const mode of ['drizzle', 'rain', 'monsoon']) {
  let wins = 0, recovered = 0;
  for (let seed = 0; seed < 300; seed++) {
    const game = new Game(mode, random(seed));
    while (game.status === 'playing') {
      const available = game.available(), held = Array(12).fill(0), visible = Array(12).fill(0);
      game.rack.forEach(id => held[game.tiles[id].type]++);
      available.forEach(tile => visible[tile.type]++);
      // Finish triples, then collect a visible set, then deepen the main board.
      const value = tile => (held[tile.type] === 2 ? 1000 : 0)
        + (held[tile.type] + visible[tile.type] >= 3 ? 100 : 0)
        + held[tile.type] * 10 + (tile.pile === 'main' ? 2 : 0) + tile.z * .01;
      available.sort((a, b) => value(b) - value(a) || a.id - b.id);
      game.pick(available[0].id);
    }
    wins += game.status === 'won'; recovered += game.cleared;
  }
  console.log(`${mode}: ${wins}/300 wins; average ${Math.round(recovered / 300)} tiles recovered (no powers, no hidden-card knowledge).`);
}
