# Career mode: design (proposal of 2026-11-21, awaiting the owner's answers to the questions at the end)

Owner's requirements: the quality of a player's shots comes from attributes (power, spin, technique, accuracy, stamina, ...);
the player grows in a **career mode**: XP, levels, skill points, a **calendar of tournaments** that get harder and pay much more
with level; **gear** that adds attribute points (for example "these shoes: +2 power"); packs with gear; later online tournaments
and paid packs (not now); offline first; audience from about 12 years (see ROADMAP).

## 1. Attributes and what they do in the engine
Today: `power, technique, speed, defense` + `maxGuts` (`src/data/players.json`, `engine.ts`). Proposed: **six attributes, 1-99 scale
on screen** (the engine keeps using the 1-10 style numbers internally, divided down), mapped to the mechanics that exist now:

| Attribute | What it drives |
|---|---|
| Power | attack score of power shots (flat, smashes, bajada), ball speed (`flight.speed` x about 0.9-1.1) |
| Spin | spin of every shot (`flight.spin`, `side`: curve, bounce, glass rebound), attack score of spin shots (vibora, rulo, chiquita, lobs) |
| Technique | error chance (`TECHNIQUE_SAFETY`), fumble chance when taking a ball early, serve faults, touch shots |
| Accuracy | spread of the aim (`aimX`/`aimDepth`, `AIM_SKILL`), finding gaps, risk of putting the ball into the side wall (`edgeRisk`) |
| Stamina | `maxGuts`, guts recovery per point, how fast a long rally tires (`FATIGUE_*`) |
| Speed | reach and defence: chasing balls, getting to the net on a rebound (replaces `speed` and folds `defense` into it) |

`resolveHit` gets the attributes of both players; the existing sim scripts (`/tmp/fl*.js`, CPU vs CPU) are used to re-tune so that
**today's feel is kept at the default attributes** and a level difference changes win rates in a controlled way (target: equal
level 50%, +10 levels about 80%).

## 2. Progression
- **XP** per match (win/loss, points won, longest rally, winners, achievements) and per tournament round. Level curve in JSON.
- **Levels** give skill points (e.g. 3 per level) to spend on the six attributes; per-level attribute cap so nobody maxes one stat early.
- **Training** (optional, later): spend calendar time for a small, free attribute gain.

## 3. Gear
- Six slots: head, top, shorts, shoes, racket, wristband. Rarity: common, rare, epic, legendary = number and size of bonuses
  (e.g. rare shoes +2 Power, epic racket +3 Spin +1 Accuracy). Sets give a bonus for 3 or 4 matching pieces.
- Each item also has an **appearance layer** that changes the generated character (`Appearance`), so new gear is data.
- Rule: **total attribute = base + skill points + gear, never above the cap of the level or the tournament division.**
  Offline career: the cap is the level cap. Online later: one equal cap per division (the agreed pay-to-win answer: gear lets you
  reach the cap with different build, it does not exceed it).

## 4. Packs (soft currency only for now)
Earned from tournaments, achievements and levels; opened on a pack screen with an animation. Drop tables in JSON, shown on the
screen (the odds are shown from the start: it is required by Apple and Google as soon as packs are paid). Duplicates turn into
coins. No real-money purchase in this phase.

## 5. Calendar and tournaments
- **Tiers** (example): Club Cup, City Open, Regional, National, Premier, Masters, World Tour. Each: level gate, entry fee, draw size
  (8 or 16 pairs, knockout), number of rounds, prize money + XP + packs for every round reached and for the title.
- **Season calendar**: about 12 events a year, you choose which to enter (a gate shows the level needed); an event is played
  round by round with the existing match engine; the AI pairs are generated from the tier (attributes around the tier level).
- Unlocked tiers pay clearly more (the owner wants "much more profitable" with level).
- Partner: you build one hero; the partner is chosen from a small roster of NPC players who level slowly and can be swapped.

## 6. Code structure (pure, tested, no Phaser; scenes only draw it)
`src/career/`: `attributes.ts` (derive the engine stats from base + points + gear, caps), `xp.ts` (curve, rewards), `gear.ts`
(items, slots, sets, appearance mapping), `packs.ts` (drop tables, injected rng), `tournament.ts` (bracket, rounds, opponents,
prizes), `profile.ts` (the one serialisable `PlayerProfile` that a server could store later). `src/save.ts` gets a versioned migration.
Data in `src/data/`: `gear.json`, `packs.json`, `tournaments.json`, `levels.json`. Scenes: Character, Inventory, Packs, Calendar,
Bracket, Rewards.

## 7. Steps (each one ends with tests, a sim check and a build on Pages)
B1 attributes in the engine (6 attributes, re-tuned, today's feel kept) -> B2 profile, XP, levels, skill points, save v2, character screen
-> B3 gear, inventory, appearance layers, caps -> B4 packs and coins -> B5 calendar and tournaments (bracket, opponents, prizes)
-> B6 achievements, tutorial, balance pass with the owner's play-tests.

## Questions for the owner
1. Attributes: six (power, spin, technique, accuracy, stamina, speed; defence folded into speed), or keep defence as a seventh?
2. Partner: a roster of NPC partners that you can swap (recommended), or a partner you also level yourself?
3. Gear and caps: offline the level cap applies, online later an equal cap per division. OK?
4. Tournaments: knockout draws of 8 / 16 pairs, you pick events from the calendar, one match per round. OK, or a league/group stage too?
