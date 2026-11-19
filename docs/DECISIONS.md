# Decisions

## 2026-11-19: Stack = Phaser 3 + TypeScript + Vite, Capacitor later
- Phaser runs natively in the browser, so the game is testable from day one and the same code ships to phones.
- TypeScript strict: AI agents write it well and types catch mistakes early.
- Capacitor wraps the web build for Android and iOS. Not added yet: we add it once the game is worth shipping,
  to keep the early repo small.
- Alternative considered: Godot 4. Good editor, but weaker fit for agent-driven coding and web export has
  more quirks (notably Safari on iPhone).

## 2026-11-19: Portrait layout, 360x640 logical size
Chosen by the owner for comfortable one-handed phone play. Phaser `Scale.FIT` scales it to any screen.

## 2026-11-19: Pure logic separated from Phaser
`src/game/` has no Phaser imports and takes an injected `rng`. Makes balance changes and rules testable.

## 2026-11-19: Data in JSON under `src/data/`
Players, moves and responses are JSON so balance can change without touching code.
(The first plan said `data/`; `src/data/` was chosen so Vite imports the files directly.)

## 2026-11-19: Original content only
No Captain Tsubasa / Tecmo names, characters, art or music. Only the design idea is borrowed.

## 2026-11-19: Web preview via GitHub Pages
`.github/workflows/pages.yml` builds and deploys on every push to `main`.
Uses `npm install` because no `package-lock.json` was generated yet (see HANDOFF).

## 2026-11-19: Name "Padel Champ 26"
Chosen by the owner. Placeholder font is Courier New; a bundled pixel font is in the backlog
(it needs a font file, which also keeps the mobile app working offline).

## 2026-11-19: 16-bit look, broadcast camera, comic big-head characters (supersedes "NES look")
Owner's direction, with a World Padel Tour broadcast screenshot as reference. Details in docs/GDD.md.
- Court is a fake-3D perspective projection (`src/art/camera.ts`, pure maths, tested): world metres -> screen.
  Not a real 3D engine: cheap, crisp, and keeps pixel art simple.
- Characters are **generated from code** (`src/art/character.ts`): rectangles and discs on a 32x46 grid with a
  dark outline, from an `Appearance` record (skin, hair style/colour, shirt, shorts or skirt, shoes, racket,
  headband). Placeholder-quality but already diverse, and it lets a future character creator and equipment recolour
  characters for free. Trade-off: no real animation frames yet (only a hop). If hand-drawn or AI-assisted sprite
  sheets replace this, keep `Appearance` as the data model and swap the renderer.
- Preview for checking sprites without a browser: dump ops with node, rasterise with Python PIL (done once in
  the session that created this; not committed).

## 2026-11-19: Placeholder sound via Web Audio, no audio files yet
`sfx(name)` generates square-wave beeps, so there is an NES-like feel with zero assets. Real chiptune replaces
the internals of `sfx()` later without touching scenes.

## 2026-11-19: Save data in localStorage behind `src/save.ts`
Defensive parsing, works without storage. Same code runs in the browser and in a Capacitor WebView.

## 2026-11-19: Shots as data, point as a pure state machine
Every serve/return/rally shot is an entry in `src/data/shots.json`; direction modifiers are in `directions.json`.
`src/game/point.ts` (`stepServe`, `stepHit`) is pure and immutable, with an injected `rng`; the scene only animates
the returned `Step`. Rulo has `fixedDirection: cross`. Walls only affect the animation for now (the ball path),
not the maths. Balance was tuned by simulation, constants live at the top of `engine.ts`.

## Secrets
Android keystore, Apple certificates and `.env` files are git-ignored. Back them up in a password manager.
