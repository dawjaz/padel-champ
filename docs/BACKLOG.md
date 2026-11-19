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

## Career mode and equipment (owner request, later)
- Earn clothes, shoes, rackets; they change looks AND raise skills/attributes
- Open design questions: slots (racket/shoes/outfit/headband?), bonus ranges and caps, how items are earned
  (prizes, shop, drops), rarity tiers, whether bonuses are visible in match
- Outfit editor screen + character creator (gender, skin, hair, colours)
- Code hook: `Appearance` in `src/game/types.ts`; add an items data file and an `effectiveStats()` in `src/game/`

## Art and audio
- Upgrade the generated characters: animation frames (swing, run, celebrate), more hair styles, accessories, body types
- Proper 16-bit court art: textured floor, real ad boards, crowd, lighting; the ball needs a clearer look
- Screen-shake / impact effects, special-move cutscenes
- Pixel sprites for ball, court, UI frame (characters are generated for now)
- Bundle a pixel font (e.g. an OFL-licensed one) instead of Courier New, so it also works offline in the app
- Real chiptune music and SFX (FamiStudio, jsfxr) replacing the Web Audio beeps in `src/audio.ts`
- App icon and splash screen

## Shots
- Bajada (depends on ball height, position, lob quality). Smash is done (v0.7).
- Let walls affect the maths (rebounds, wall-first returns)
- Per-shot animations, equipment bonuses (rackets, shoes) on stats

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
