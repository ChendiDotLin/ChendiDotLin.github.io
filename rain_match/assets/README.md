# Rain Match workshop artwork

The current artwork is a set of 21 original workshop illustrations: 12 parts
and nine machines. The flat hand-drawn style uses rounded, slightly asymmetric
silhouettes, bold contours, broad color fills and sparse paper grain. Items have
no faces or human limbs; distinctive proportions and functional details give
them character without anthropomorphism or realistic 3D rendering.

Generated using the built-in image_gen tool, each asset separately, with the
new flat Overload Boiler illustration as a shared style reference. No original
game assets were used as reference. `flat/prompts.json` records the final prompts.

Production assets live in `flat/`: 512px transparent WebP images and a 96px PNG
bulb favicon. Delivery encoding preserves the generated composition and alpha.
The previous `characters/` images are kept for design history but are no longer
loaded by the game or homepage. The earliest SVG set is also superseded.
Covered-card contrast, names, rarity tiers, rules and save IDs remain unchanged.

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

`../music.js` contains Workshop Nocturne, an original note sequence synthesized
locally with oscillators, without audio samples. Existing sound effects are also
synthesized. This provenance records the implementation; it does not claim that
project names or artwork have undergone legal or trademark clearance.
