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
`src/audio.ts` plays the ball contacts (`impactSound(kind, power)`: racket, floor, glass, mesh, net).
- **Real recordings**: put the files in `public/assets/audio/sfx/` and list them per kind in `public/assets/audio/sfx/manifest.json`,
  e.g. `{ "racket": ["racket_1.ogg", "racket_2.ogg"], "floor": ["floor_1.ogg"], "glass": [...], "mesh": [...], "net": [...] }`.
  Several files per kind are chosen at random; `power` sets the volume and a little pitch. Short mono clips (50-400 ms), ogg or mp3.
- **No files for a kind**: the synthesised sound plays instead (so the game always has sound).
- Sound ideas (check the licence of each file, CC0 or CC-BY, and record it below): padel/tennis ball hits, a ball bouncing on a
  court, a glass door/wall knock, a chain-link fence rattle, a tennis net cord. Good sources: OpenGameArt ("100 CC0 metal and wood SFX",
  "100 CC0 SFX"), Kenney "Impact Sounds" (CC0), Freesound (filter by CC0).
- Current recording: `sfx/*.wav` are cut from Freesound #345759 ("padel-practice" by refrain) by `tools/cut_sounds.py`; licence UNCONFIRMED. Kinds: racket_strong, racket_soft, racket_spin, racket_serve, floor, glass, mesh. Audition at `/sounds.html`.
- UI beeps (`sfx('select')`, `sfx('point')`, ...) are still square-wave placeholders.

## Licensing
Everything must be original or properly licensed (record the licence next to the file or in this doc).
No assets from Captain Tsubasa, Tecmo, or any other game.
