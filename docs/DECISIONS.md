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

## 2026-11-19: Name "Padel Champ 26", NES look
Chosen by the owner. Palette in `src/config.ts`. Placeholder font is Courier New; a bundled pixel font is in the backlog
(it needs a font file, which also keeps the mobile app working offline).

## 2026-11-19: Placeholder sound via Web Audio, no audio files yet
`sfx(name)` generates square-wave beeps, so there is an NES-like feel with zero assets. Real chiptune replaces
the internals of `sfx()` later without touching scenes.

## 2026-11-19: Save data in localStorage behind `src/save.ts`
Defensive parsing, works without storage. Same code runs in the browser and in a Capacitor WebView.

## Secrets
Android keystore, Apple certificates and `.env` files are git-ignored. Back them up in a password manager.
