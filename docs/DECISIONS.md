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

## 2026-11-19: One controlled player, glass serve gives the receiver a choice
Owner: partner and opponents should hit almost instantly, so only one player of the team (index 0) gets menus.
Serve to the side glass: the receiver picks bounce (faster, riskier, less pressure) or glass (more time).
Player parameters that ease or complicate these choices come later (owner's plan).
`buildFlight` owns the geometry of the hitting spot; the engine only knows `ReceiveMode`.

## 2026-11-19: Ball flight is simulated, not drawn by hand
Owner asked for real-world trajectories per shot. `ballPath.ts` simulates gravity, spin-dependent floor bounces, glass,
mesh and drag; shot data (`flight`) holds real speeds, apex and spin. The hitting spot of the next player comes out of
the simulation instead of fixed offsets. The physics is cosmetic plus positioning: win/lose is still decided in
`engine.ts`. Tuned by eye with a script (constants at the top of ballPath.ts); a player-skill layer comes later.

## Secrets
Android keystore, Apple certificates and `.env` files are git-ignored. Back them up in a password manager.

## 2026-11-19: partners keep their halves on serve (v0.7)
The owner asked that, when the point is served from the side opposite to where the human player normally plays,
the partners do not swap halves. Chosen reading: nobody leaves their own lane; the server steps to the centre mark
on the correct side (`CENTRE_SERVE_X`) and serves cross from there. Alternative if this is not what was meant:
let the partner serve those points.

## 2026-11-19: glass state and lob quality drive shot availability (v0.10)
Availability is data (`requires` in shots.json) evaluated against `BallState` (height, lob quality, off-the-glass). The
random rolls (lob quality, glass, rebound height) happen in `stepHit`, so the flight animation only visualises them and
the game result never depends on the physics. Unavailable shots are hidden from the menu instead of greyed out.
After a point the ball is simulated freely (`buildCoast`); it is visual only.

## 2026-11-20: owner answers to the open design questions
- **Defence stays automatic.** The human never picks a defensive action; only attack shots, serve and the glass-serve receive choice have menus.
- **Golden point: the receiving pair chooses the receiving side** (not implemented yet; today the side is fixed).
- **Partners keep their own halves on serve** is confirmed (the v0.7 reading was right; `serveSetup` and `CENTRE_SERVE_X` stay).
- **Real 3D (three.js)** will be a separate prototype branch, but NOT now. Focus first: deepening the match mechanics.

## 2026-11-26: the game is called PorTres (store title "PorTres: Padel Career")
- Chosen by the owner from ten proposals. "Por tres" is the padel shot where the ball bounces in the court, hits the side glass and leaves over the fence; it is the finisher of the game (RUN OUT) and the number allows a sequel ("Por Cuatro").
- Written PorTres (one word) in the logo and the store; the UI draws everything in capitals (PORTRES). The store subtitle carries the word "padel" for search; the name itself stays short and ownable.
- Rejected after a web check: Golden Point (several scorekeeping apps), Padel Heroes, Padel Clash, Padel Pro and Court Legends (existing apps/games), Vibora (a padel racket brand), Bandeja (four apps with that name). Padelheads stays as the runner-up (a compound with "head" near the padel brand HEAD). Por Cuatro is kept for a sequel or mode; "Padel x Cuatro" is an Argentine tournament. Bajada World was free but weak.
- The repository, `package.json` name and the save key `padel-champ-26:save` keep the old working name on purpose (the key would wipe every save). Checklist for names, domains and trademark: `docs/NAMING.md`.
