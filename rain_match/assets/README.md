# Rain Match workshop artwork

The current artwork restores the 21 original workshop character designs from
`characters/`, redrawn as 2D cartoon illustrations. The same silhouettes,
expressions, poses, colors and small limbs are retained. Clean colored outlines,
simplified color areas and cel shading replace realistic clay materials.
There are 12 part characters and nine machine characters.

Generated using the built-in image_gen tool, one character at a time. Each
original character is its own edit target, and the new 2D Overload Boiler serves
as a shared rendering-style reference. `toon/prompts.json` records the prompts.
No third-party game artwork was supplied as a reference.

Production assets live in `toon/`: 512px transparent WebP images and a 96px PNG
bulb favicon. Delivery encoding preserves the generated composition and alpha.
The earlier `characters/` (clay), `flat/` (inanimate objects) and SVG sets remain
for design history; the game and homepage load only the current cartoon set.
Covered-card contrast, names, rarity tiers, rules and save IDs remain unchanged.

## Stable equipment IDs → new presentation

| Save/API ID | English | 中文 | Asset (in toon/) |
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
