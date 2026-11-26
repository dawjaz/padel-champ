# PorTres: logo and app icon proposals (2026-11-26)

Four directions, shown to the owner on a design canvas (claude.ai artifact "PorTres – logo i ikona (4 kierunki)").
Waiting for the owner's choice; the chosen one gets polished (transparent logo, title-screen version, store assets).

| | Direction | Logo type | Icon |
|---|---|---|---|
| A | Modern | Unbounded 900, two-tone PorTres, navy + lime | the por tres path: bounce, flight over the glass |
| B | Retro 8-bit | Press Start 2P on a pixel grid, sunset + court grid | pixel padel racket and ball |
| C | Dynamic sport | Anton, skewed, speed cuts, POR tag | fireball smashing through glass |
| D | Comic (game style) | Luckiest Guy with 3D extrusion on a burst, Baloo 2 ribbon | the real game hero (exported from `src/art/toon`) smashing |

All fonts are OFL (free for commercial use). Letters are converted to outlines, so the SVGs do not depend on installed fonts.

## Files
- `svg/`: vector sources of A, C, D (logos and 1024 px icons). B is pixel art: `png/B_icon.png` (48 px grid at 1024), `png/B_logo.png` (170x82 grid at x10).
- `png/*_icon_512.png`: previews.
- `tools/`: the generators.
  - `lib.mjs` + `shape.py`: text to SVG paths (HarfBuzz for kerning, fontTools for outlines; opentype.js broke some glyphs).
  - `a.mjs`, `c.mjs`, `d.mjs`: directions A, C, D. `b.py`: direction B (pixel grid, exports crisp SVG rects and PNG).
  - `hero.ts`: exports the game hero as SVG in several poses (`npx vite-node design/brand-proposals/tools/hero.ts` from the repo root); `d.mjs` reads `hero_smashHit.svg`.
  - `render.py`: SVG to PNG with Chrome (playwright). `tile.py`: contact sheets.

## Rebuilding
In a scratch folder: `npm i @fontsource/unbounded @fontsource/anton @fontsource/big-shoulders-display @fontsource/luckiest-guy @fontsource/baloo-2 @fontsource/press-start-2p`,
convert each `node_modules/@fontsource/*/files/*-latin-*-normal.woff` to `ttf/<same name>.ttf` with fontTools, `pip install uharfbuzz`,
copy `tools/` there, export the hero poses next to `d.mjs`, then `node a.mjs`, `node c.mjs`, `node d.mjs`, `python3 b.py` (outputs in `out/`).
