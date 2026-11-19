# Assets

Files live in `public/assets/` (served as-is by Vite, copied into `dist/`).

```
public/assets/
  sprites/   PNG sprite sheets and images
  audio/     music and sound effects (ogg + mp3 for cross-browser support)
```

## Adding an image
1. Put `toro.png` in `public/assets/sprites/`.
2. Register it in `src/assets.ts`:
   `images: [{ key: 'toro', path: 'sprites/toro.png' }]`
3. Use it in a scene: `this.add.image(x, y, 'toro')`.

`BootScene` loads everything listed in the manifest before the title screen opens.

## Pixel art rules
- Logical screen is 360x640; `pixelArt: true` is on, so images scale with nearest-neighbour (no blur).
- Draw sprites at small native sizes (e.g. 32x48) and scale by integers in code if needed.
- Target look is 16-bit (see docs/GDD.md). The UI palette lives in `src/config.ts`.
- Characters are generated from code for now (`src/art/character.ts`); the ball, court and UI are drawn in `MatchScene`.

## Sound
`src/audio.ts` has placeholder square-wave beeps (`sfx('hit')` etc.). For real audio, add files under
`public/assets/audio/`, list them in the manifest, and make `sfx()` play them. Scene code stays unchanged.

## Licensing
Everything must be original or properly licensed (record the licence next to the file or in this doc).
No assets from Captain Tsubasa, Tecmo, or any other game.
