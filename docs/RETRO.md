# Modern retro look: branch `style/retro`

Experimental look on top of `style/hd` (same smooth canvas pipeline, 720x1280). Rules, physics and data are identical
to `main`; only rendering changed. Live preview: `<site>/retro/` (built by CI). Title screen shows `v0.7-retro`.

- Arena (`src/art/hd/arenaHd.ts`): 80s synthwave: gradient sky, striped sun, neon skyline instead of a crowd, neon
  perspective grid around the court, flat two-tone court, neon court lines, glass with hard highlights, pink mesh,
  CRT scanlines over the picture (not the menu).
- Characters (`characterHd.ts`): flat colours, one hard shadow tone, thick outline and a hard drop shadow.
- Ball: neon green with cyan glow. UI: square neon panels with a hard offset shadow, monospace font.
- No new image files; arena render about 20-40 ms.
