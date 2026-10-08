# Critter Cascade — clear companion identities

Each companion has one headline purpose. Read its trigger, target and visible result
before secondary rules. The common unit is a group of three identical tiles;
"manual" means the player completed it by picking tiles, and "companion clear"
means a skill completed it. Boss restrictions apply to automatic effects.

The following are design references, not claims of identical mechanics. The RoR2
names belong only in this developer note; public companions use original identities.
No RoR2 art, sound or descriptive prose is incorporated.

| Companion / saved ID | RoR2 reference | Matching-game adaptation |
| --- | --- | --- |
| Cat / prism | Lens-Maker's Glasses | A manual triple can critically clear an extra group; prefers freeing the tray. |
| Lion / behemoth | Brilliant Behemoth | Extra explosions prioritize covered board tiles. Uses a clear counter instead of exploding on every hit. |
| Lynx / clover | 57 Leaf Clover | Makes critical hits and burns more frequent. Uses stated percentage-point boosts, not RoR2's luck rerolls. |
| Leopard / blackhole | Primordial Cube (attraction motif) | Manually pull the missing tile into a tray pair. Does not reproduce combat crowd control. |
| Water Snake / ukulele | Ukulele | Lightning chains across exposed groups. Uses a visible fixed manual-match counter instead of RoR2's on-hit roll. |
| Salamander / gasoline | Gasoline | A clear can spread fire to more tiles of the same picture; no hidden damage-over-time simulation. |
| Viper / capacitor | Resonance Disc (accumulation and release) | Companion clears build toward one piercing follow-up group. |
| Gecko / resin | Sticky Bomb | Visible countdown on exact marked tiles before they explode. |
| Sparrow / feather | Hopoo Feather (reach motif) | Lets the player reach a covered tile; does not automatically match it. |
| Swallow / seeker | AtG Missile Mk. 1 (homing motif) | Automatically finds the missing third tile for tray pairs after a stated counter. |
| Owl / radar | Radar Scanner | Reveals supply tiles and marks a picture for a matching reward. |
| Kingfisher / echo | Pocket I.C.B.M. (extra follow-ups) | Follows the first clearing companion's targeting rules; deliberately broader than missiles. |
| Turtle / shield | Safer Spaces | One automatic rescue each stage, instead of periodic damage blocking. |
| Snail / cell | Fuel Cell | Stores extra active uses and reduces the recharge requirement. |
| Hermit Crab / turbine | Soulbound Catalyst | Companion clears speed up active-skill recovery. |
| Pangolin / recycler | Lost Seer's Lenses (execution motif) | Finishes an almost-empty board; threshold-based, not a random one-hit kill. |

References for comparison:
- [Ukulele](https://riskofrain2.wiki.gg/wiki/Ukulele)
- [Brilliant Behemoth](https://riskofrain2.wiki.gg/wiki/Brilliant_Behemoth)
- [Fuel Cell](https://riskofrain2.wiki.gg/wiki/Fuel_Cell)

Rules remain in `expedition.js`. The rename and visual update preserve targeting,
RNG, numeric balance, save IDs, score validation, drops and bosses. This release
clarifies the existing roles rather than silently changing an ongoing build.
Generated tile assets and exact prompts are in `assets/tiles/`.
