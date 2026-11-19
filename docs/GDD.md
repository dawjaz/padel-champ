# Game Design Document: Padel Champ

## Pitch
A command-based padel match on your phone. You and a partner face a rival pair. Every exchange is a
duel: the hitter picks a shot, the defender picks an answer. Stats, guts and reading your opponent
decide who wins the point. Pixel art, chiptune, dramatic special moves.

## Inspiration (idea only)
NES-era command sports games: menu-driven actions, stamina points ("guts"), one-on-one duels inside a
team match, flashy special moves, a story-driven tournament. No assets or names are reused.

## Core loop (prototype, implemented)
1. A point starts with the server's team holding the ball.
2. The hitter picks a **shot** (Lob, Bandeja, Chiquita, Vibora, Bajada, Smash). Each costs guts.
3. The defender picks a **response** (Block, Wall read, Volley, Retreat). Each costs guts.
4. Resolution (`src/game/engine.ts`):
   - attack = hitter stat x 10 x shot multiplier + random(0..20), x0.6 if too tired to pay the cost
   - defence = defender's defense x 10 x response multiplier + random(0..20), +15 if the response counters the shot
   - attack - defence > 12: **winner** (hitter's side scores)
   - defence - attack > 15: **intercept** (defender's side scores)
   - otherwise the rally continues and the ball goes to the other side
5. After each point everyone recovers 2 guts.

Two shots are always free (Lob, Retreat), so a tired player can still act, just weakly.

## Scoring
0/15/30/40, **golden point** at 40-40 (next point wins the game, as in modern padel).
Prototype match: first to 2 games. Serve alternates every game.

## Characters (placeholders)
You: Toro (power), Luca (technique/speed). Rivals: Bruno (defense wall), Ivo (all-rounder).
Stats are 1-10: power, technique, speed, defense. Speed is not used yet.

## Planned
- Court positions (net vs back), position affecting which shots and responses are strong
- Glass-wall rebounds as a real mechanic, not just a label
- Special moves per character with short cutscenes (cost: a lot of guts, big effect)
- Career mode: tournament bracket, rivals with dialogue, upgrading players between matches
- Save/load (localStorage on web, Capacitor Preferences on mobile)
- Art: 8-bit palette, pixel sprites, chiptune music (FamiStudio), SFX (jsfxr)
- Landscape support is a maybe; portrait is the primary layout

## Open questions
- How much should speed matter (court coverage)?
- Should responses be hidden from the hitter until the shot is chosen (current: CPU picks after you)?
- Match length and pacing on mobile (target: 3-5 minutes per match)
