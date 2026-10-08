# Current companion artwork

Equipment uses the original animal atlases in `companions/`: four families,
sixteen partners, five forms each. The ordinary match tiles, emergency tools,
favicon and existing homepage illustration retain the flat workshop objects.

- `cats.webp`: critical tiger, smashing lion, lucky lynx, pair-pulling snow leopard.
- `dragons.webp`: lightning serpent, fire salamander, piercing viper, timed gecko.
- `birds.webp`: reaching sparrow, pair-finding swallow, scouting owl, repeating phoenix.
- `shells.webp`: guarding turtle, storage snail, charging crab, finishing pangolin.

Rows follow those lists; columns are levels 1–5. Original transparent PNGs are
preserved. `atlas.js` indexes tight alpha bounds; the browser renders each sprite
through its SVG view window. Production WebP keeps the same pixels/dimensions and
alpha with compressed color encoding. `prompts.json` records all four built-in
image_gen prompts and source filenames. The generated cat atlas was the style
reference for the other three families. No third-party characters were referenced.

Each saved equipment ID keeps its function across the rename. `companions.js`
provides per-level Chinese/English names; `expedition.js` provides family/row maps.
Old machine art below remains as design history and for prior screenshots.

---

# Clackworks workshop artwork

The game uses the original faceless flat workshop set: 12 part icons and sixteen
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

`../music.js` plays the licensed, locally hosted recording
`audio/george-street-shuffle.mp3` by Kevin MacLeod and synthesizes game effects.
Its CC BY 4.0 attribution, original source and checksum are recorded in
`audio/george-street-shuffle-NOTICE.txt` and linked from the in-game credits.
The `audio/piano/` samples remain as unused history of the retired generated score.
This provenance does not claim project names or artwork have undergone trademark clearance.

The plug now uses `flat/part-plug-side.webp`: a horizontal lavender-blue body,
gold pins and a left-side cord, distinct from the red U-shaped magnet. Built-in
image_gen edit prompt: `flat/part-plug-side.prompt.json`. Saved item IDs are unchanged.

## Arsenal expansion

Seven additional original icons were generated with the built-in image_gen tool
as individual transparent illustrations. `flat/arsenal-prompts.json` records
each exact prompt and output filename. The delivery WebPs preserve alpha and
use the same faceless 2D workshop palette, outline and readable silhouettes.

| Save/API ID | English | 中文 | Asset (in flat/) |
| --- | --- | --- | --- |
| prism | Focus Prism | 聚焦棱镜 | module-prism.webp |
| seeker | Seeking Paper Rocket | 追踪纸火箭 | module-seeker.webp |
| resin | Clockwork Blast Can | 发条爆破罐 | module-resin.webp |
| turbine | Reflux Turbine | 回流涡轮 | module-turbine.webp |
| capacitor | Afterglow Capacitor | 余火电容 | module-capacitor.webp |
| echo | Echo Record | 复写唱片 | module-echo.webp |
| recycler | Cleanup Press | 清场压机 | module-recycler.webp |
