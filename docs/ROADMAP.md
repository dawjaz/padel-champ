# Roadmap (proposal of 2026-11-21, to be confirmed by the owner)

Goal: a mobile padel game with character progression, gear packs, tournaments with players from all over the world and
monetisation (packs for about $1-$2). Order of work, with the reason for the order.

## A. Finish the match mechanics (running now, with the owner's Free Practice tests)
Go through the remaining shots and serves in ATTACKING / DEFENDING for every pair of positions (done so far: chiquita, lob,
flat return, vibora, rulo, Por Tres / Cuatro, bajada high speed, serve faults). Left: bandeja, bajada slow, volley, bounce shot,
serves, golden point flow. Exit criterion: the owner signs off the feel; balance numbers live in `src/data/*.json`.

## B. Progression core (next big step, local-first, built so a server can take it over)
- **Data model** (pure TS, tested, no Phaser): `PlayerProfile` (level, XP, unspent skill points, base stats), `GearItem`
  (slot: head, top, shorts, shoes, racket, wristband; rarity; stat bonuses; optional set bonus; appearance layer id), `Wallet`
  (soft currency), `PackDef` (drop tables in JSON), `Inventory`. All randomness goes through the injected `rng` (already the rule).
- **Rules**: XP per match (win, points, rally length, achievements), level curve, skill points to spend on the four stats,
  total stat = base + points + gear, with a cap per level so gear cannot replace skill.
- **Screens**: character (stats, equipped gear, appearance), inventory, shop, pack opening, rewards after a match, daily/achievement list.
- **Appearance**: gear items map to layers of the existing generated `Appearance`, so new gear is data, not code.
- **Save**: extend `src/save.ts` with versioned migration; keep the profile as one serialisable object (the unit a server would store).
- **Economy basics**: all packs earnable by playing (soft currency, achievements); paid packs are a faster way, not the only way.

## C. Online foundation (after B works offline)
- Accounts (Sign in with Apple / Google), a small backend (Supabase / Firebase, or own), server-side inventory and purchases.
- The game logic is deterministic (seed + chosen shots), so a match can be **replayed and verified on the server**: no trusted client.
- First online feature: **asynchronous tournaments and leaderboards** (brackets, your team plays CPU-controlled ghosts of other
  players' teams), then weekly seasons; real-time PvP only later.

## D. Monetisation and compliance (design before building the shop)
- In-app purchases through Capacitor (RevenueCat is the usual choice), Apple / Google review, privacy policy, age rating.
- **Randomised paid packs are loot boxes**: Apple and Google require the odds to be shown; Belgium and the Netherlands have
  restricted them; several markets age-gate them. Decide: odds always visible, a pity timer, no paid-only competitive power.
- **Pay-to-win**: in tournaments either normalise the stat budget (equal power, gear changes style and looks) or cap the gear
  bonus. Recommendation: paid packs mostly cosmetics + small, capped stat bonuses; tournaments with a stat cap per division.
- Licences: the sound recording (Freesound #345759) still has an unconfirmed licence; music and art stay original.

## E. 3D (three.js) prototype: separate branch, after B
Reason to wait: monetisation needs progression, not a new renderer. The renderer is the most expensive swap and the gear
visuals would have to be redone, so the gear data model (B) should be renderer-independent first. Then a 1-2 week spike
(court + two characters + the ball path from `ballPath.ts`, which is already pure) decides whether it is worth it.

## Decisions needed from the owner before B starts
1. Pay-to-win stance for tournaments: normalised stats (recommended) or capped gear bonus.
2. Offline-first with online later (recommended) or online from day one.
3. Target markets / age (decides loot-box rules): worldwide, or start in markets without loot-box restrictions.
