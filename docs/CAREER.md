# Career mode: design (agreed with the owner on 2026-11-21)

**Decisions (owner, 2026-11-21):** seven attributes (defence stays separate); a partner who can be swapped (NPC roster); the level cap applies
offline, an equal cap per division online later; knockout draws only (no group stage); audience 13+ (design for Apple 13+, odds visible,
no real-money purchase yet); a second currency of coins plus quick consumables; two more gear slots (sports bag, balls); the calendar
follows the real padel tour structure (section 5).

Owner's requirements: the quality of a player's shots comes from attributes (power, spin, technique, accuracy, stamina, ...);
the player grows in a **career mode**: XP, levels, skill points, a **calendar of tournaments** that get harder and pay much more
with level; **gear** that adds attribute points (for example "these shoes: +2 power"); packs with gear; later online tournaments
and paid packs (not now); offline first; audience from about 12 years (see ROADMAP).

## 1. Attributes and what they do in the engine
**Seven attributes** (1-99 on screen later; the engine uses the 1-10 style scale, 5 = neutral, so today's balance is kept at 5):

| Attribute | What it drives (all in `src/game/attributes.ts`) |
|---|---|
| Power | attack score of power shots, ball speed (x0.9 to x1.1) |
| Spin | spin of every shot (curve, bounce, glass rebound; x0.6 to x1.4), attack score of the vibora |
| Technique | error chance, fumble chance when taking a ball early, serve faults, touch shots |
| Accuracy | `AIM_SKILL` (finding the gap), spread of the aim across and in depth, the risk of putting the ball into a side wall |
| Stamina | `maxGuts`, guts recovery per point, when a long rally starts to tire |
| Speed | reach: chasing balls, getting to the net on a rebound |
| Defense | holding the ball: returning hard shots, volleys |

Done in B1 (v0.34). Re-tuning rule: at all-5 attributes the engine behaves as before; each point away from 5 moves the mechanics a little.

## 2. Progression
- **XP** per match (win/loss, points won, longest rally, winners, achievements) and per tournament round. Level curve in JSON.
- **Levels** give skill points (e.g. 3 per level) to spend on the six attributes; per-level attribute cap so nobody maxes one stat early.
- **Training** (optional, later): spend calendar time for a small, free attribute gain.

## 3. Gear and consumables
- **Eight slots:** head (cap), top, shorts, shoes, racket, wristband, sports bag, balls. Rarity: common, rare, epic, legendary = number and
  size of bonuses (e.g. rare shoes +2 Power, epic racket +3 Spin +1 Accuracy, balls: spin or speed bonus, bag: stamina). Sets give a bonus for
  3 or 4 matching pieces. Each item has an appearance layer where it shows on the character (cap, shirt, shorts, shoes, racket, wristband; the bag
  and balls show on the character screen and at the court side).
- Rule: **total attribute = base + skill points + gear, never above the cap of the level (offline) or of the division (online later).**
- **Consumables** bought with coins or won (use before a match or in a break): isotonic drink (+10% of the guts recovered), energy gel, grip tape
  (fewer errors for one match), new balls (+spin for one match), physio (restores stamina between tournament rounds). Stackable, JSON-defined.

## 4. Currency and packs (soft currency only for now)
Two kinds of reward: **XP** (progression) and **coins** (spending). Coins buy packs and consumables in a shop; packs are also won in tournaments
and achievements. Pack types: gear pack (common), premium gear pack, slot packs (shoes, rackets, ...), consumables bundle. Drop tables in JSON, odds
shown on the screen from the start (Apple and Google require it once packs are paid). Duplicates turn into coins. Pity timer: a rare or better item
at least every N packs. No real-money purchase in this phase; the design is ready for it (13+ audience).

## 5. Calendar and tournaments (modelled on the real tours: Premier Padel and the FIP Tour)
Real structure used as the model: **Premier Padel** has Majors (the top: 2000 ranking points to the winner), P1 (1000) and P2 (about 600) plus a year-end
Finals for the top 16; the **FIP Tour** below it has Platinum, Gold, Silver, Bronze, Rise and the youth Promises circuit; below that come club and
regional amateur categories. A season is about 25 events in a rolling ranking (the best results of the last 52 weeks count).
Game divisions (each with a level gate, entry fee, draw size, prize coins + XP + packs and ranking points):
1. **Club** (amateur club cups, 8 pairs) -> 2. **Regional** (16) -> 3. **FIP Rise** -> 4. **FIP Bronze** -> 5. **FIP Silver** -> 6. **FIP Gold** ->
7. **FIP Platinum** -> 8. **Premier P2** -> 9. **Premier P1** -> 10. **Major** (4 a year) -> **Season Finals** (top 16 of the ranking).
- Knockout draws of 8 or 16 pairs; one match per round; rewards for every round reached and bigger ones for the title.
- **Season calendar**: about 25 weekly slots in a year with named events in tour order (cities, surface/speed variety later); you choose which
  events to enter, a locked event shows the level or ranking it needs; **ranking points** per round and a world ranking in which you start low
  (also gating Premier events and the Finals); the season ends with a summary and a new season starts, tiers get harder (opponents' attributes
  scale with the division, seeded pairs at the top of the draw).
- Partner: the roster of NPC partners can be swapped between events; each has attributes, a price (coins) and a rating that grows slowly.

## 6. Code structure (pure, tested, no Phaser; scenes only draw it)
`src/career/`: `attributes.ts` (derive the engine stats from base + points + gear, caps), `xp.ts` (curve, rewards), `gear.ts`
(items, slots, sets, appearance mapping), `packs.ts` (drop tables, injected rng), `tournament.ts` (bracket, rounds, opponents,
prizes), `profile.ts` (the one serialisable `PlayerProfile` that a server could store later). `src/save.ts` gets a versioned migration.
Data in `src/data/`: `gear.json`, `packs.json`, `tournaments.json`, `levels.json`. Scenes: Character, Inventory, Packs, Calendar,
Bracket, Rewards.

## 7. Steps (each one ends with tests, a sim check and a build on Pages)
- **B1** seven attributes in the engine (done in v0.34): `attributes.ts`, players get all seven, balance kept at 5.
- **B2** (done in v0.35) profile, XP, levels, skill points, save v2 migration, character screen. Numbers in `levels.json` (30 levels, 2 points per level, caps 5 to 10).
- **B3** gear (8 slots), inventory, appearance layers, caps, consumables.
- **B4** coins, shop, packs and pack opening, drop tables.
- **B5** career calendar, divisions, draws, opponents from the division, rewards and ranking, partner roster.
- **B6** achievements, tutorial, balance pass with the owner's play-tests.

## Open decisions (small, defaults chosen)
Level cap: 50 levels, 3 skill points per level, an attribute is capped at level + 10 (a level-1 hero cannot put 40 points into one attribute).
The default starting hero has all seven attributes at 3 (the NPCs of the first divisions are around 3-5, a Major pair around 8-9).
