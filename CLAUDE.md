# Padel Champ

Mobile-first (portrait, 360x640) command-based padel game in the spirit of NES-era "command soccer" games
(think Captain Tsubasa, 1988). Runs in the browser first; Android and iOS builds come later via Capacitor.

**Read `docs/HANDOFF.md` first**: it says where the project stands and what to do next.

## Stack
- Phaser 3 + TypeScript (strict) + Vite
- Vitest for unit tests (game logic only; scenes are not unit-tested)
- Capacitor for Android/iOS (not added yet, see docs/DECISIONS.md)

## Commands
- `npm install`
- `npm run dev`: local dev server (also reachable from a phone on the same Wi-Fi)
- `npm test`: unit tests
- `npm run typecheck`: TypeScript check
- `npm run build`: typecheck + production build into `dist/`

## Structure
- `src/game/`: pure game logic, NO Phaser imports (types, scoring, engine). Keep it that way so it stays testable.
- `src/scenes/`: Phaser scenes (rendering, input, flow)
- `src/data/*.json`: players, moves, responses. Balance changes go here, not into code.
- `docs/`: GDD (design), DECISIONS (why), HANDOFF (state and next steps)

## Rules
- Original content only: no names, characters, art or music from Captain Tsubasa, Tecmo or any other
  existing game. We copy the *idea* (command duels, guts, special moves), not the assets.
- Randomness always goes through an injected `rng` function in `src/game/` so tests are deterministic.
- Never commit signing material (keystores, certificates, `.env`). See `.gitignore`.
- Update `docs/HANDOFF.md` at the end of every working session.
- Language: code and docs in English; the owner chats in Polish.
