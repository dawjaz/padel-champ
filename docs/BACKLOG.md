# Backlog

Dump ideas and feedback here in any order. A future session sorts them.

## Gameplay feedback from the owner (to refine later)
The owner played the v0.1 prototype and said much needs to change. Details are not collected yet.
Areas named so far:
- Choice of shots and how they interact
- Partner position on the court
- Types of shots

Ask the owner for the full list before redesigning (they offered to write it out).

## Design
- Court positions (net / back) that change which shots and responses are strong
- Real glass-wall rebound mechanic
- Special moves with cutscenes
- Use the speed stat
- Career mode: tournament bracket, rivals, dialogue, player upgrades

## Art and audio
- Pixel sprites for 4 players, ball, court, UI frame
- Bundle a pixel font (e.g. an OFL-licensed one) instead of Courier New, so it also works offline in the app
- Real chiptune music and SFX (FamiStudio, jsfxr) replacing the Web Audio beeps in `src/audio.ts`
- App icon and splash screen

## Technical
- First real run: `npm install`, `npm run typecheck`, `npm test`, `npm run dev`; commit `package-lock.json`
- Switch CI from `npm install` to `npm ci`
- Capacitor for Android and iOS (needs network access for npm; see HANDOFF)
- Playwright smoke test (title -> match -> result)
- Landscape support (maybe)

## Release
- Google Play Console account (closed-testing requirement may apply to new personal accounts)
- Apple Developer Program account
- Privacy policy, age rating, store screenshots
- Back up Android keystore and Apple certificates outside git
