# Rain Match workshop artwork

These 21 SVG files were drawn directly for this project's workshop reskin. They
use original geometric paths, gradients and a common outline palette; no source
images, third-party item silhouettes, tracing, external fonts or raster samples
are included. The former bundled item WebP files have been removed.

Twelve `part-*.svg` illustrations appear on ordinary tiles. Nine `module-*.svg`
illustrations appear on equipment cards. The small-size silhouettes differ from
the ordinary parts. Cream tile faces and dark, desaturated covered tiles preserve
board readability; rarity colors still describe the existing equipment tiers.

## Stable equipment IDs → new presentation

| Save/API ID | English | 中文 | SVG |
| --- | --- | --- | --- |
| feather | Telescopic Grabber | 伸缩抓手 | module-grabber.svg |
| shield | Safety Cushion | 应急缓冲垫 | module-cushion.svg |
| ukulele | Arc Coil | 电弧线圈 | module-coil.svg |
| cell | Power Flywheel | 储能飞轮 | module-flywheel.svg |
| gasoline | Welding Torch | 焊接喷头 | module-torch.svg |
| behemoth | Overload Boiler | 过载锅炉 | module-boiler.svg |
| clover | Precision Calibrator | 精密校准仪 | module-calibrator.svg |
| blackhole | Vortex Vacuum | 涡流吸尘器 | module-vacuum.svg |
| radar | Sorting Scanner | 分拣扫描器 | module-scanner.svg |

Internal IDs remain stable for browser saves, Undo snapshots and database
whitelists. These IDs are not player-facing names. `core.js` maps the unchanged
ordinary tile IDs/type indices to their new part names and SVG filenames.

`../music.js` contains Workshop Nocturne, an original note sequence synthesized
locally with oscillators, without audio samples. Existing sound effects are also
synthesized. This provenance records the implementation; it does not claim that
project names or artwork have undergone legal or trademark clearance.
