# Handoff

_Last updated: 2026-11-19_

## State
Initial scaffold plus a first playable prototype (one match, portrait, coloured rectangles):
- `src/game/`: types, padel scoring (golden point), exchange engine, unit tests
- `src/scenes/MatchScene.ts`: court, 4 players, shot/response menus, CPU opponent, score, guts, restart
- `src/data/*.json`: 4 players, 6 shots, 4 responses
- CI: GitHub Pages deploy workflow

## IMPORTANT: this code was written without being run
The session that created the scaffold had no network access, so `npm install`, `npm test`,
`npm run typecheck` and `npm run dev` were **never executed**. Expect small typing or runtime fixes.
First thing to do in the next session:
1. `npm install` (this also creates `package-lock.json`; commit it)
2. `npm run typecheck && npm test`
3. `npm run dev` and play one full match; fix whatever breaks
4. Then switch the workflow from `npm install` to `npm ci`

## Next steps
1. Make the prototype feel good: pacing of messages, hit feedback, balance (is a match 3-5 min?)
2. Court positions (net/back) and real glass-wall mechanic
3. Special moves with a short cutscene
4. Pixel art sprites, chiptune music
5. Career mode, save/load
6. Capacitor (Android/iOS), touch polish, store assets

## Owner
Chats in Polish. Wants: Android + iPhone release, browser build for testing, everything kept in GitHub so
the project can move between Claude accounts.
