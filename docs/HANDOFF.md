# Handoff

_Last updated: 2026-11-19 (v0.2)_

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
1. Collect the owner's gameplay feedback into docs/BACKLOG.md and redesign shots/positions in docs/GDD.md first,
   then code
2. Art direction with the owner (character look, palette, pixel font), then sprites
3. Capacitor (Android/iOS) once network is available
4. Career mode, special moves
5. Store accounts and release prep (owner)

## Owner
Chats in Polish. Wants: Android + iPhone release, browser build for testing, everything kept in GitHub so
the project can move between Claude accounts.
