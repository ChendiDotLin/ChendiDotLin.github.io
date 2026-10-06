# Clackworks workshop artwork

The game uses the original faceless flat workshop set: 12 part icons and nine
machine icons. Rounded silhouettes, dark-teal outlines and warm color blocks
provide character without eyes, mouths or limbs. The glove and bulb have been
replaced with a pocket tape measure and a mini battery in the same style.

Production assets live in `flat/`: 512px transparent WebP images, plus
`favicon-battery.png`. Artwork was generated with the built-in image_gen tool.
The flat Overload Boiler was the style reference for the two new objects;
`flat/replacements.prompts.json` records their prompts and `flat/prompts.json`
records the earlier set. No third-party game artwork was used as a reference.
Delivery encoding preserves the generated composition and alpha.

The unused glove/bulb, `characters/` (clay), `toon/` (characters) and SVG files
remain as design history. Gameplay, homepage, animations and the favicon use
only the active flat assets. Recent animation recovery and rarity frames remain
in place. Item type indices and internal IDs stay stable for existing saves.

## Stable equipment IDs → new presentation

| Save/API ID | English | 中文 | Asset (in flat/) |
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

`../music.js` contains Assembly After Hours, an original layered score and effects synthesized
locally with oscillators, without audio samples. Existing sound effects are also
synthesized. This provenance records the implementation; it does not claim that
project names or artwork have undergone legal or trademark clearance.
