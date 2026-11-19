# Handoff

_Last updated: 2026-11-19 (v0.4)_

## State
Game name: **PADEL CHAMP 26**, NES look, portrait 360x640.

Flow: `BootScene` -> `TitleScene` -> (`SettingsScene` | `MatchScene` -> `ResultScene` -> rematch/title).

- v0.1: prototype match (see docs/GDD.md for the rules). Owner played it in the browser: buttons, ball movement,
  full match and replay all work. Owner says shot choice, partner position and shot types will need a lot of
  changes; details to come (see docs/BACKLOG.md).
- v0.2 (this session): title screen, settings (sound on/off, reset save), result screen, save system
  (`src/save.ts`, localStorage, with tests), placeholder 8-bit SFX (`src/audio.ts`), shared UI helpers
  (`src/ui.ts`), palette/config (`src/config.ts`), asset manifest (`src/assets.ts`, `docs/ASSETS.md`).
- CI deploys every push to `main` to GitHub Pages: https://dawjaz.github.io/padel-champ/ (Pages source = GitHub Actions).

## v0.3: 16-bit broadcast view (this session)
Owner changed the art direction (see docs/GDD.md "Visual direction"): 16-bit, TV-broadcast perspective,
comic big-head characters with diverse skin/gender/outfits; equipment in career mode comes later.
- `src/art/camera.ts`: fake-3D projection (metres -> screen), tested
- `src/art/character.ts` + `characterTexture.ts`: generated pixel characters (front/back view), tested;
  previewed as a PNG in the session and looked right (diverse looks, readable rackets)
- `MatchScene` rewritten: perspective court, glass walls, net with depth sorting, ad board, crowd, sprites,
  ball flying in an arc with a shadow, hop on hit
- `TitleScene`: the two heroes flank the bouncing ball
- 4 players with `appearance` in `src/data/players.json` (Toro, Mia vs Bruno, Ines)
- NOT visually verified in a browser by the agent (sandbox cannot reach github.io). The owner should look at the
  match view first: check court proportions, label overlap, menu fit, ball visibility.

## v0.4: new shot mechanics (this session)
Implements the owner's shot spec (docs/GDD.md has the full rules): serve always cross, server's partner in the middle
of the half; serves hard glass / spin glass / at opponent / T; returns chiquita / lob / flat; rally shots vibora /
bandeja / volley / bounce shot / rulo; direction parallel / middle / cross; rulo always cross into the mesh fence.
- Pure logic: `src/game/{court,engine,point,ai,catalog,rng}.ts`, data in `src/data/{shots,directions}.json`
  (old moves/responses removed). 84 local tests pass via a shim runner; balance checked by 20k CPU-vs-CPU points.
- Art maths: `src/art/walls.ts` (real wall layout: back 3 m glass + 1 m mesh, stepped side walls, mesh centre),
  `src/art/ballPath.ts` (flight with glass/fence bounces).
- `MatchScene` rewritten: glass drawn translucent with panel joints, mesh as a wire grid, two-step menu
  (shot, then direction showing the target defender), colour hints (green good fit, orange poor, red tired).
- NOT visually verified in a browser and NOT typechecked against Phaser locally: CI is the first real check.
  Owner should check glass/mesh proportions, menu fit, label overlap, ball visibility.
- Smash and bajada come later (they depend on several factors); see BACKLOG.

## Verification status
The v0.1 code passed CI (install, tests, typecheck, build). The v0.2 changes were written in a session
without network access, so only the Phaser-free files were typechecked locally; the rest relies on CI.
**First thing next session: check the latest Actions run** (`gh run list`), fix anything red, and play through
title -> match -> result -> rematch once.

## Constraints to know
- A session without network cannot `npm install`, so it cannot add Capacitor or new packages.
  Network settings are changed by the claude.ai organization owner and apply to NEW chats.
- No `package-lock.json` yet (CI uses `npm install`). Generate it on first install, commit it, then use `npm ci`.

## Next steps
1. Collect the owner's feedback on the v0.4 shots; add smash and bajada (BACKLOG)
2. Art direction with the owner (character look, palette, pixel font), then sprites
3. Capacitor (Android/iOS) once network is available
4. Career mode, special moves
5. Store accounts and release prep (owner)

## Owner
Chats in Polish. Wants: Android + iPhone release, browser build for testing, everything kept in GitHub so
the project can move between Claude accounts.
