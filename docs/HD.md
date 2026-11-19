# HD ("128-bit") look: branch `style/hd`

Experimental modern look for the same game. Game rules, physics and data are identical to `main`;
only the rendering changed. Live preview: `<site>/hd/` (built by CI next to the normal version).

## What changed
- Canvas is 720x1280 (`HD_SCALE = 2` in `src/config.ts`); every scene calls `applyHd(this)` (src/hd.ts) to zoom its
  camera, so layouts still use the 360x640 logical screen. `pixelArt: false` (smooth filtering).
- `src/art/hd/arenaHd.ts`: the court is drawn once as a lit picture (stands with a blurred crowd, stadium lights,
  turf grain, glass with reflections and joints, wire mesh, posts, net strip sorted between the players).
- `src/art/hd/characterHd.ts`: the same character shapes as before (`buildCharacter`), drawn as rounded, shaded,
  outlined toon figures at 6x. Appearance data and future equipment work unchanged.
- `src/art/hd/ballHd.ts`: ball and glow. Ball trail, dust on bounces, flashes on glass/mesh/net, ACE/WINNER banners,
  small camera shake on winners.
- `src/ui.ts`: rounded glossy buttons (`drawPanel`), modern font stack, text rendered at HD resolution.

## Size and speed (estimates, not measured on a phone)
- No new image files: everything is drawn by code at start-up, so the installer does not grow (a few KB of code).
  Phaser itself is the bulk of the web build (about 1.2 MB minified, about 0.35 MB gzipped).
- Memory: the 720x1280 arena texture is about 3.7 MB of GPU memory; characters are 4 small textures per facing.
- Smoothness: the arena is one static texture, which is cheaper to draw than the old per-frame vector shapes.
  The cost is the 4x bigger canvas (fill rate). Fine on phones of the last ~6 years; if needed lower `HD_SCALE` to 1.5.

## Merging
`style/hd` branched from `main` at v0.6. Rendering changes touch `config.ts`, `main.ts`, `ui.ts`, all scenes,
`characterTexture.ts` and `src/art/hd/`. Rules/physics files are untouched, so merges are straightforward.
