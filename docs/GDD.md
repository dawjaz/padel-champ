# Game Design Document: Padel Champ

## Pitch
A command-based padel match on your phone. You and a partner face a rival pair. Every time you get the
ball you pick a shot and a direction; stats, guts and the situation decide who wins the point.
16-bit pixel art, comic characters, dramatic special moves (later).

## Inspiration (idea only)
8/16-bit command sports games: menu-driven actions, stamina points ("guts"), duels inside a team match,
flashy special moves, a story-driven tournament. No assets or names are reused.

## Visual direction (decided by the owner, 2026-11-19)
- **16-bit** look (SNES/Mega Drive era), not 8-bit. Richer palette, shading, outlines.
- **Camera:** TV-broadcast view from behind the near baseline, looking down the court: perspective court,
  glass and mesh walls, net across the middle, two players per side (reference: a World Padel Tour broadcast).
  Portrait 360x640, court in the upper half, command menu in the lower half.
- **Characters:** comic style with big heads and small bodies. Diverse on purpose: different skin tones,
  genders, hair styles and outfits.
- **Career mode (later):** earn new clothes, shoes and rackets. Items change the look and **raise skills and
  attributes**. The model is prepared: every garment/skin/hair colour is a separate field in `Appearance`
  (`src/game/types.ts`), so items can override looks; stat bonuses are NOT implemented yet.
- Title name: **Padel Champ 26**.

## The court (visual accuracy requested by the owner)
10 m x 20 m, net in the middle (0.92 m at the posts), service lines 6.95 m from the net, centre service line.
Walls, as drawn in the game (sources: LTA court guidance, Wikipedia "Padel"):
- **Back wall:** 3 m glass + 1 m wire mesh on top = 4 m.
- **Side walls (from each corner):** 2 m of glass 3 m high, then 2 m of glass 2 m high (stepped), with mesh
  above the glass up to 4 m over the first 2 m and 3 m after that; the central part is mesh fence about 3 m high.
  Exact side-wall layouts differ between manufacturers; this is the common one.
- Glass is drawn translucent with panel frames; mesh is drawn as a grid.

## Match flow (v0.4, implemented)
A point is: **serve -> return -> rally**, until someone wins it. Whenever your team has the ball, you pick
a **shot** and, unless the shot fixes it, a **direction**. The CPU does the same on its turns.
There is no separate "response" menu any more: the receiver is decided by the direction and reacts
automatically from their stats.

### Serve
- Always **cross** (diagonal). Serve side alternates every point: right box first, then left.
- The server's partner stands in the **middle of their half** during the serve.
- Choices: **Hard glass** (fast, kicks off the side glass, risky), **Spin glass** (spin off the glass, safer),
  **At opponent** (at the receiver's body, high pressure), **T-serve** (to the centre line T, safe, low).
- A faulted serve gives a second serve; two faults lose the point. An ace wins it outright.
- A good serve puts **pressure** on the receiver: their return is weaker.

### Return (first hit after the serve)
- **Chiquita** (soft, low, short; the hitter moves up), **Lob** (high and deep; the hitter's side drops back),
  **Flat return** (fast and flat).
- Then a **direction**: Parallel (down the line), Middle, Cross.

### Rally shots (every later hit)
- **Vibora**, **Bandeja**, **Volley**, **Bounce shot**, **Rulo**, each with a direction.
- **Rulo** has no direction choice: it is always played cross into the **mesh fence**.
- Later (owner's plan): **Smash** and **Bajada**, which depend on several factors (ball height, position...).

### Directions
- **Parallel:** goes to the opponent in the same lane. Strongest attack, riskiest (narrow, near the glass).
- **Cross:** goes to the opponent in the opposite lane. Balanced.
- **Middle:** between the two. Safest, weakest, and the receiver is slightly confused (random player takes it).
- Lanes: each player owns a lane (index 0 = screen left, index 1 = screen right), on both teams.

### Ball height ("fit")
Every shot leaves the ball **high / mid / low**. Every shot works best against some incoming heights:
bandeja/vibora/rulo like high balls (lobs), volley and bounce shot like mid/low balls. The menu colours
each shot **green (good fit)**, **orange (poor fit)** or **red (too tired)** for the current ball.

### Resolution (`src/game/engine.ts`, numbers are first guesses and will be rebalanced)
1. Unforced-error roll: shot risk + direction risk + rally fatigue - technique skill.
2. Attack = stat x 10 x shot power x direction x height fit x (1 - pressure) + random(0..20); x0.6 if too tired.
3. Defence = (defense x 7 + speed x 3) x 1.3 + random(0..20); x0.88 on a middle ball.
4. Attack - defence > margin: **winner**. Defence - attack > 48 (INTERCEPT_MARGIN): defender wins the point (**intercept**).
   Otherwise the rally continues, and a narrow attack lead becomes **pressure** on the next hit.
- Guts: the hitter pays the shot's cost; everyone recovers 2 per point. Free shots always exist (Lob, T-serve).

### Positions
Formation is **net** or **back** per team and changes with the shot (`advance` in the data):
volley/bandeja/vibora/chiquita and a good serve take the net; a lob sends the opponents back.
Fixed lanes for now; real court coverage and the partner's movement are to be refined with the owner.

## Scoring
0/15/30/40, **golden point** at 40-40 (next point wins the game, as in modern padel).
Prototype match: first to 2 games. Serve alternates every game and the serving team swaps its server.

## Characters (placeholders)
You: Toro (male, power) and Mia (female, technique/speed). Rivals: Bruno (male, defense wall) and Ines
(female, all-rounder). Names and looks are placeholders. Mixed-gender pairs are allowed by the game.
Stats are 1-10: power, technique, speed, defense.

## Planned
- Smash and bajada (conditions to be defined with the owner)
- More realistic positions and partner movement, glass rebounds that change where the ball ends up
- Special moves per character with short cutscenes (cost: a lot of guts, big effect)
- Career mode: tournament bracket, rivals with dialogue, upgrading players between matches
- Save/load (localStorage on web, Capacitor Preferences on mobile)
- Art: 16-bit pixel sprites, character animation (swing, run), music, SFX
- Character creator and equipment (see Visual direction)
- Landscape support is a maybe; portrait is the primary layout

## Open questions
- Should the human player also choose how to defend (e.g. read the direction), or stay fully automatic?
- Golden point: who chooses the receiving side (currently fixed)?
- Match length and pacing on mobile (target: 3-5 minutes per match)
