# Rain Match workshop artwork

The current artwork is a family of 21 original workshop characters: 12 parts
and nine equipment companions. It uses tactile clay-like forms, expressive faces,
and a distinct silhouette and dominant color for each object. Generated with the
built-in image_gen tool, with each asset generated separately, using the Overload Boiler character
as the style reference. No source-game art was supplied as reference.

Production assets are in `characters/` as 512px transparent WebP images. Delivery
encoding preserves the generated composition and alpha. The favicon is a 96px
PNG of the bulb character. `characters/prompts.json` records the full prompt set.
The first workshop release used code-drawn SVGs; these are superseded by this set.
Cream tile faces and dark, desaturated covered tiles preserve board readability.
Equipment names, rarity tiers, mechanics and save/API identifiers are unchanged.

## Stable equipment IDs → new presentation

| Save/API ID | English | 中文 | Asset (in characters/) |
| --- | --- | --- | --- |
| feather | Telescopic Grabber | 伸缩抓手 | module-grabber.webp |
| shield | Safety Cushion | 应急缓冲垫 | module-cushion.webp |
| ukulele | Arc Coil | 电弧线圈 | module-coil.webp |
| cell | Power Flywheel | 储能飞轮 | module-flywheel.webp |
| gasoline | Welding Torch | 焊接喷头 | module-torch.webp |
| behemoth | Overload Boiler | 过载锅炉 | module-boiler.webp |
| clover | Precision Calibrator | 精密校准仪 | module-calibrator.webp |
| blackhole | Vortex Vacuum | 涡流吸尘器 | module-vacuum.webp |
| radar | Sorting Scanner | 分拣扫描器 | module-scanner.webp |

Internal IDs remain stable for browser saves, Undo snapshots and database
whitelists. These IDs are not player-facing names. `core.js` maps the unchanged
ordinary tile IDs/type indices to their new part names and asset filenames.

`../music.js` contains Workshop Nocturne, an original note sequence synthesized
locally with oscillators, without audio samples. Existing sound effects are also
synthesized. This provenance records the implementation; it does not claim that
project names or artwork have undergone legal or trademark clearance.
