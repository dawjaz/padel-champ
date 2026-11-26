# Bajada to the middle, deep: why it is (almost) never returned

Investigation of the owner's complaint: "a Bajada Low Speed to the middle, deep under the glass, is never returned, even after the
bounce, although it looks within their reach". Nothing under `src/` was changed. The simulation script is
`/home/claude/analysis/scratch/tmp_bajada.ts` (run from the repo as `scripts/tmp_bajada.ts`, see the end of this file).

## TL;DR

- The complaint is real, but it depends on the stats. A hero with **power 8** (the default Dani) who plays `bajada_slow` to the tapped
  middle-deep spot wins **61% of those balls outright** against the default CPU pair (Bruno+Ines), **77%** against a level-5 pair and
  **84%** for a level-7 hero with power 9 against a level-6 pair. These are full-match simulations, with the hero playing the bajada at
  every chance. At even stats (4v4, 5v5, 7v7) the same ball wins only 0 to 2.5%.
- In real matches **100% of the hero's bajada chances come with both opponents at the net**. A ball that comes off your back glass mid
  or high has been sent by a pair that moved forward. The net formation is exactly where the model breaks.
- Root causes, from biggest to smallest:
  1. **The reach of a net player is measured to the landing spot 7 m behind him**, although the engine has him *volley* the ball at
     the net (`netVolley`, and the returned ball is animated as a volley). Deep middle: gap 4.9 m (depth-weighted) against a reach
     radius of 3.3 m, so reach = **0.55, the floor**. In reality the ball passes about 1.5 m beside one of them.
  2. **Double penalty for net players**: the bajada has `reboundChase`, so the defence uses `REBOUND_POSITION.net = 0.75` ("he has to
     run back to the glass"). The same roll also gives the volley bonus `AIR_DEFENSE.net = 1.2`. The model treats him as volleying
     and as chasing off his own glass at the same time, and the reach floor comes on top.
  3. **The middle is treated as a gap, not as a ball two players cover**: `reachAgainst` takes only the nearer defender (max of the
     two factors), and the middle also gets `hesitation 0.88` on the defence. The GDD calls the middle "safest, weakest".
  4. **The slow bajada beats the fast one as an attacking shot**: `winnerMargin` is 26 for the slow one and 62 for the fast one, and its
     risk is 0.06 against 0.30. Dani against a net pair, middle deep: slow 85% winners / 7% errors, fast 53% / 34%. In real padel it is
     the other way round.
  5. **Presentation**: on a winner the scene sends the defender all the way to the ball's play point and makes him lunge. He ends
     **0.6 m from the ball** (the stroke gap), with the racket at it, so the ball always looks returnable.
- Fix in two steps:
  - **Data-only quick fix**: `bajada_slow.winnerMargin` 26 to 50. In matches the slow bajada's winners go from 61/77/84% to
    **1/5/7%**. The fast bajada (unchanged, 25 to 48% winners, 35 to 40% errors) becomes the dangerous one. CPU-vs-CPU balance does
    not move.
  - **Structural fix** (point.ts/court.ts): measure a volleying defender's reach to the ball's path, let the second defender cover a
    middle ball, and retune `bajada_fast` (`winnerMargin` 62 to 45, `risk` 0.30 to 0.26). Details and numbers below.

---

## 1. How a bajada is resolved (trace, file:line)

**Aiming.** The default setting is "tap the spot" (`src/save.ts:51`, `aim: 'point'`). `MatchScene.showTargetMenu`
(`src/scenes/MatchScene.ts:2208-2279`) lets the player touch any point (x -4.6..4.6, depth 1..9.4 m past the net). The *direction*
used for attack, risk and hesitation is the one whose nominal landing x is nearest (`:2268-2276`). Nominal landing x
(`src/game/court.ts:34-39`): parallel ±3.6, cross ±2.5, middle ±0.3. A tap at x = 0 is therefore **Middle** (`attack 0.9`,
`hesitation 0.88`, `src/data/directions.json:3`). In the old "directions" mode the ball lands on one of 10 aim points ±0.9 m around
that x (`court.ts:50-63`) and one of 20 depths ±1.5 m around `landDepth` (6.2 slow / 7.4 fast; `court.ts:124-133`). The reach,
however, uses the nominal `shot.landDepth` (`point.ts:678`).

**Availability.** Both bajadas need a ball off the glass, height mid or high (`shots.json:714-721`, `:765-772`). Off a low ball they
are not offered, so "low" is not a real case (forced: fit 0.6, practically no winners).

**`stepHit`** (`src/game/point.ts:628-797`):
- `:649` `defenderIndex` (`court.ts:27-31`): middle gives a random target (only used when x is exactly 0).
- `:652` `targetLanding` (`court.ts:103-109`): the tapped spot plus a triangular spread (`targetSpread`, `court.ts:86-93`; about
  ±0.75 m across and ±1.1 m in depth at accuracy 5 for the slow bajada, more for the fast one and under pressure). Depth > 10 m means
  "into the glass", an error (`:684`). This is why a tap at depth 9 gives 6 to 10% errors even with the slow bajada.
- `:656` the defender is whoever's half the ball lands in (x < 0 → idx 0).
- `:668-669` the `airTake` flag: `netVolley` (`point.ts:555-564`) is true for any non-lob ball against a net pair, which gives the
  defence ×1.2 (`AIR_DEFENSE.net`, `engine.ts:16`). For a mid-court pair `airTake` (`point.ts:587-591`) uses the *nominal*
  `landDepth` (6.2 ≤ 7, so true for the slow bajada even when the tap is at 9 m).
- `:675-678` **reach** = `reachAgainst(...)` at the *real landing spot* (`point.ts:24-35`): for each defender
  `reachFactor(reachGap(pos, landX, landZ), reachRadius(speed) × timeFactor)`, then the **max** of the two.
  - `reachGap` (`court.ts:201`) = hypot(dx, 0.6·dz) from where the defender stood **when the ball was hit**
    (`MatchScene.reachPositions`, `:2282-2287`, a snapshot). His run during the flight only counts through `reachTimeFactor`
    (`court.ts:190`; flight time to the *landing*, clamped 0.8 to 1.3; the extra time until a glass ball is played is not counted).
  - `reachRadius` (`court.ts:172`) = 2.2 + 0.14·speed (2.9 m at speed 5). `reachFactor` (`court.ts:195-198`): 1 up to 0.5 radius,
    then linear down to **0.55 (REACH_MIN) at 1.5 radii**.
- `resolveHit` (`src/game/engine.ts:159-191`):
  - error roll first: `risk + direction.risk - 0.008·technique` (min 1%); slow 0.06 → 2% at technique 5, fast 0.30 → 26%.
  - attack (`:172-175`) = stat × 10 × power × direction.attack × fit × (1 − incoming pressure) + U(0..20). Both bajadas use
    `stat: "power"` (`shots.json:699`, `:750`).
  - defence (`:177-178`) = `defenseRating` (`engine.ts:59-65`): with `reboundChase` the weights are defense ×4 + speed ×8, × 1.3
    × `REBOUND_POSITION[formation]` (`engine.ts:51`: back 1.25, mid 1.0, **net 0.75**) × hesitation (0.88 middle), then × air bonus
    × **reach**, + U(0..20).
  - **winner** if attack − defence > `winnerMargin` (`:187`): slow **26** (`shots.json:763`), fast **62** (`:712`). Otherwise
    continue, with pressure = diff/200 (max 0.25) on the defender's next shot (`:189`).
- Bajada-specific rules: `noReboundBack` (`shots.json:696`, `:747`) switches off the "flies back over the net" winner
  (`point.ts:718-728`) and damps the visual rebound of a winner (`ballPath.ts:975-986`). There is no other special case. A returned
  ball against a net pair is a **volley at the net** (`point.ts:748-757`: `netBlock`, `block`), so the defender never chases it off his
  glass in the returned case.

**The headline case**: Dani (power 8) vs a level-5 pair at the net, slow bajada, tap (0, 9), high ball.

| term | value |
|---|---|
| attack | 8 × 10 × 0.9 (power) × 0.9 (middle) × 1.15 (fit high) = **74.5** + U·20 |
| defence | (5·4 + 5·8) × 1.3 = 78 × 0.75 (net, "rebound chase") × 0.88 (middle) × 1.2 (volley) × **0.55** (reach floor) = **34.0** + U·20 |
| diff vs margin | ≈ 40 ± 20 against 26: winner whenever the error roll (2%) misses and the spread is not very unlucky, so **85% winners** |

At the back the same ball gives defence 78 × 1.25 × 0.88 × 0.865 = 74 (+U·20): no winner is possible (diff never exceeds about 20).

## 2. Numbers (seeded, current code)

### 2a. Distance from the landing spot to the defenders (defender speed 5)

`gap` = hypot(dx, 0.6·dz) to the nearer defender; radius = reach radius × time factor.

| target | formation | gap each (m) | true distance (m) | radius (m) | gap/radius | reach |
|---|---|---|---|---|---|---|
| middle deep (0, 9), slow | net | 4.89 / 4.89 | 7.43 / 7.43 | 3.32 | 1.47 | **0.56** |
| middle deep, slow | mid | 3.68 / 3.68 | 5.15 | 3.32 | 1.11 | 0.73 |
| middle deep, slow | back | 2.66 / 2.66 | 2.92 | 3.32 | 0.80 | 0.87 |
| middle deep, fast | net | 4.89 / 4.89 | 7.43 | 2.52 | 1.94 | **0.55** |
| middle deep, fast | back | 2.66 / 2.66 | 2.92 | 2.52 | 1.05 | 0.75 |
| corner L deep (-3.8, 9), slow | net | 4.40 / 7.57 | 7.12 / 9.42 | 3.31 | 1.33 | 0.63 |
| corner L deep, slow | back | 1.58 / 6.36 | 1.98 | 3.31 | 0.48 | 1.00 |

So yes: the middle is a **gap**. Both back players are 2.66 m from it, and only the nearer one counts, so the reach is 0.87 (slow) or
0.75 (fast), lower than for a ball right at one of them. Against the net pair everything deep is at the floor, because the gap is
measured to the bounce 7 m behind them. The ball actually passes **about 1.5 m** beside the near net player
(hitter at x = -2.5, the line to (0, 9 m deep) crosses the net players' line at x ≈ -1.0).

### 2b. Outcome matrix, tap (0, 9) unless stated: winner / attacker error / returned (%), 10,000 rolls each, incoming pressure 0

| attacker v defenders | shot | net, mid ball | net, high ball | mid, high | back, high | mixed (1 net, 1 back), high |
|---|---|---|---|---|---|---|
| lvl4 v lvl4 | slow | 0.3/9.2/90.4 | 1.2/9.5/89.3 | 0/9.1/90.9 | 0/9.1/90.9 | 0/9.1/90.9 |
| lvl4 v lvl4 | fast | 0/36.6/63.4 | 0/36.6/63.4 | 0/36.6/63.4 | 0/36.6/63.4 | 0/36.6/63.4 |
| lvl7 v lvl7 | slow | 0.5/1.1/98.4 | 2.5/1.2/96.3 | 0/1.1/98.9 | 0/1.1/98.9 | 0/1.1/98.9 |
| lvl7 v lvl7 | fast | 0/27.4/72.6 | 0.1/27.4/72.6 | 0/27.4/72.6 | 0/27.4/72.6 | 0/27.4/72.6 |
| Dani (pow 8) v lvl5 | slow | **77.8**/6.5/15.8 | **85.5**/6.7/7.7 | 12.3/6.2/81.6 | 0/6.4/93.6 | 2.2/6.0/91.7 |
| Dani (pow 8) v lvl5 | fast | 42.1/33.9/24.0 | 52.9/34.0/13.0 | 27.9/34.2/37.9 | 0/34.1/66.0 | 12.0/33.3/54.6 |
| Dani+Lucy v Bruno+Ines | slow | 63.5/6.3/30.2 | 74.9/6.0/19.1 | 3.5/6.3/90.2 | 0/6.4/93.6 | 0.2/6.6/93.3 |
| Dani+Lucy v Bruno+Ines | fast | 31.8/33.4/34.7 | 44.7/33.9/21.4 | 16.6/34.0/49.4 | 0/34.1/66.0 | 4.7/34.0/61.3 |

Other targets, Dani v lvl5 at the net, high ball (slow | fast):

| target | slow | fast |
|---|---|---|
| corner L deep (-3.8, 9) (parallel) | 88.5/11.2/0.3 | 61.0/39.0/0 |
| corner R deep (3.8, 9) (cross) | 82.8/8.1/9.2 | 60.8/36.8/2.5 |
| middle (0, 7.5) | 76.1/1.8/22.1 | 57.9/25.8/16.3 |
| directions mode: parallel | 70.3/11.9/17.8 | 64.4/35.6/0 |
| directions mode: middle | 55.8/2.0/42.3 | 59.1/25.9/15.0 |
| directions mode: cross | 32.1/5.1/62.8 | 60.2/29.5/10.4 |

Mixed set-up, corner deep behind the net player: Dani slow **75.9%** winners. Incoming pressure 0.1 to 0.2 lowers these only a
little (attack × (1 − p)).

### 2c. Real matches (the hero plays the bajada to (0, 9) at every chance, everything else by the CPU AI; 300 matches)

| teams | slow: W / E / R | fast: W / E / R | points won by the hero's side, slow / fast |
|---|---|---|---|
| Dani+Lucy v Bruno+Ines | **60.7** / 9.5 / 29.7 | 24.7 / 39.3 / 35.9 | 63.7% / 51.0% |
| Dani+Lucy v lvl5 pair | **77.1** / 7.4 / 15.5 | 34.7 / 40.5 / 24.7 | 76.9% / 65.7% |
| lvl5 v lvl5 | 1.9 / 10.9 / 87.3 | 0 / 45.1 / 54.9 | 50.8% / 42.1% |
| lvl7 (power 9) v lvl6 | **84.3** / 3.0 / 12.7 | 47.6 / 34.5 / 17.9 | 77.3% / 64.2% |

The opponents' formation at every one of these chances was `net` (100%). Spamming the slow bajada is worth about +10 percentage points
of points won for a power-8 hero.

### 2d. Does the defender's run count? Does "both can reach the middle" count?

- **The run**: no. Reach is measured from the snapshot of the positions when the ball is hit (`MatchScene.ts:2282-2287`, passed at
  `:2401`). Time only scales the radius (`reachTimeFactor`, the flight to the landing only, ×0.8 to ×1.3). For a glass ball the time
  until it is actually played (bounce plus glass, another 0.5 to 1 s) is ignored. The animated run (`playStep`) only follows the
  result.
- **Two defenders**: no. `reachAgainst` takes the max of the two factors (`point.ts:28-34`). A ball between two players who are both
  2.5 to 2.7 m away counts as a partial gap (0.75 to 0.87) instead of a covered ball, and the 0.88 hesitation comes on top.

## 3. Presentation: does a winner look returnable?

`MatchScene.playStep` (`src/scenes/MatchScene.ts:2607`), branches:
- returned (`:2694-2709`): the defender goes to `standingSpot(flight.hit)` and is posed to play. Against a net pair the flight is cut
  at the net (`block`, `ballPath.ts:888-914`): he volleys.
- **winner** (`:2710-2725`): the defender goes **all the way** to `standingSpot(stance, flight.hit)`, the ball's natural play point
  after the glass (`ballPath.ts:1040-1041`; the winner's path continues to the end, `:1043-1045`), with the end pose `…Hit` and a
  full lunge (`planLunge(..., 1)`). After the flight `chaseBall` keeps him running after the dying ball (`:2776`).

Measured with `buildFlight` (200 seeded winners, middle deep, high ball, power 8):

| case | ball passes the defender's line | defender's run to the play point | closest ball-to-defender while the ball is < 2.3 m high |
|---|---|---|---|
| slow winner vs net pair | 2.3 m beside him (1.5 to 3.2), 1.4 m high | 6.4 m in 1.6 s real (4.0 m/s) to z 1.75, h 0.5 | **0.62 m** |
| fast winner vs net pair | 2.3 m beside him, 1.3 m high | 2.4 m | **0.62 m** |
| slow winner vs back pair (rare) | 2.2 m beside, 0.3 m high | 1.7 m | **0.63 m** |

So every winner ends with the defender at racket distance from a ball at knee height, swinging at it. That is exactly "it looked within
their reach". Against the net pair the ball also flies past a player at chest height 1.5 to 2.3 m away, a ball any net player would
volley. The **heat map** that is shown while aiming uses the same `reachAgainst` (`MatchScene.ts:2232`, `:2306-2342`): against a net
pair it paints the whole deep middle **green** ("gap"), which tells the player to aim there.

## 4. Against real padel, and the proposals

Real padel: a bajada (overhead after the back glass) is an attacking shot, not a sure winner. Against a pair at the net it is
volleyed unless it is fast and through a real hole or at the feet. A deep middle ball against a back pair is played after the glass,
and two players cover it (the danger there is a "yours/mine" mix-up, not reach). The slow bajada with backspin is a control shot that
keeps the opponents back and puts them under pressure. The fast flat one is the shot that wins (and misses) points.

### 4a. Data first (no code): `bajada_slow.winnerMargin` 26 to 50 (`src/data/shots.json:763`)

Leave the fast bajada as it is. Lowering its margin without the structural fix pushes it to 46 to 68% winners because of the reach floor.

| teams (real matches, slow to (0, 9)) | now W / E / R | with wm 50 |
|---|---|---|
| Dani+Lucy v Bruno+Ines | 60.7 / 9.5 / 29.7 | **1.3 / 10.1 / 88.6** |
| Dani+Lucy v lvl5 | 77.1 / 7.4 / 15.5 | **5.2 / 9.5 / 85.3** |
| lvl5 v lvl5 | 1.9 / 10.9 / 87.3 | 0 / 11.2 / 88.8 |
| lvl7 (pow 9) v lvl6 | 84.3 / 3.0 / 12.7 | **6.8 / 5.6 / 87.6** |

- Points won by a side that plays it at every chance: 63.7% → 54.9% (Dani+Lucy v Bruno+Ines).
- Single rolls (Dani v lvl5 at the net, high ball): middle deep 7.7% W, corner L 31%, corner R 7%, line 11%, cross 0.4%.
- A returned ball now carries more pressure (mean 0.18 against 0.12): the shot still attacks.
- CPU-vs-CPU (simCore, 300 matches): default teams 6.74 → 6.96 hits per point, server wins 52.1 → 50.7%. CPU slow-bajada winners go from
  19% to 0.5% (default teams); even teams were already about 0%.
- The fast bajada stays at 25 to 48% winners and 35 to 40% errors in the same matches, so it is clearly the riskier, more dangerous
  shot.
- Limits: the reach floor stays, so a power-8+ hero still wins about 30% into the corner behind a net player. Winners stay very
  sensitive to the margin (45 gives about 28%, 40 about 50% in the headline case), because the real cause is structural.
- Alternative data lever (not recommended alone): `bajada_slow.stat` power → spin (it is a spin shot by its description). It removes
  Dani's advantage (61% → 0.4%) but a spin-7+ player gets it back (level-7 test pair: 21%).

### 4b. Structural fix (point.ts / court.ts), then retune the fast bajada

1. **Reach of a defender who takes the ball out of the air** (`reachAgainst`, `point.ts:24-35`, plus a pure helper in `court.ts`).
   When the defender's formation volleys this ball (`netVolley(...)`, or `airTake(...)` with the *real* depth), measure the gap from
   him to the **closest point of the ball's ground track between the net and the landing spot** (depth-weighted as now). Measure the
   time to that point (distance from the hitter to it / speed), not to the landing. Keep the landing-spot gap for balls he lets bounce.
   Pass a flag or the formation in, as the `airTake` flag is already computed at `point.ts:668-669`. The deep middle against a net
   pair then has gap ≈ 1.5 m and reach 1.
2. **The middle is covered by two**: in `reachAgainst` replace `best = max(f0, f1)` with
   `reach = min(1, hi + (1 − hi) · (lo − REACH_MIN) / (1 − REACH_MIN))`. The second defender closes the rest of the gap in proportion
   to how well he reaches it. Middle deep against a back pair: 0.87 → 0.96 (slow) and 0.75 → 0.88 (fast).
3. **Keep** the `REBOUND_POSITION` chase penalty (removing it as well, variant B in the script, makes bajadas against a net pair
   harmless: 0% winners, pressure ≈ 0.02).
4. Data: **`bajada_fast.winnerMargin` 62 → 45** (`shots.json:712`), **`bajada_fast.risk` 0.30 → 0.26** (`shots.json:702`).
   `bajada_slow` stays as it is (26).

Single rolls with 1 to 4 (W / E / R %, high ball; "p" = mean pressure on a returned ball):

| case | slow now → new | fast now → new |
|---|---|---|
| Dani v lvl5, net, middle deep | 86.1/6.8/7.1 → **6.9/6.8/86.3** (p 0.06) | 53.1/34.7/12.2 → **33.8/32.4/33.8** (p 0.19) |
| Dani v lvl5, net, corner L deep | 88.6/11.0/0.3 → 23.7/11.0/65.3 | 60.9/39.1/0 → 60.0/34.2/5.8 |
| Dani v lvl5, net, corner R deep | 83.4/7.9/8.7 → 4.7/7.9/87.4 | 62.2/35.0/2.8 → 36.6/31.2/32.2 |
| Dani v lvl5, net, cross 7.5 | 60.2/3.8/36.0 → 6.6/3.8/89.6 | 59.6/27.3/13.2 → 49.6/23.5/26.9 |
| Dani v lvl5, back, middle deep | 0/6.8/93.3 → 0/6.8/93.3 | 0/34.7/65.3 → 1.2/32.4/66.4 |
| Dani v lvl5, back, corner L deep | 0/11/89 → 0/11/89 | 0.2/39.1/60.7 → 12.3/34.2/53.5 |
| lvl7 (pow 9) v lvl6, net, middle deep | 92.1/1.2/6.7 → 2.3/1.2/96.5 | 67.9/28.9/3.1 → 37.3/25.8/37.0 |
| lvl5 v lvl5 / lvl7 v lvl7, any | about 0 to 6% W → 0% W | 0% W → 0% W |

Real matches (same set-up as 2c):

| teams | slow W / E / R | fast W / E / R | points won, slow / fast |
|---|---|---|---|
| Dani+Lucy v Bruno+Ines | 0.3 / 11.0 / 88.6 | 8.2 / 36.8 / 54.9 | 54.2% / 49.8% |
| Dani+Lucy v lvl5 | 3.8 / 9.8 / 86.4 | 19.1 / 35.5 / 45.4 | 70.0% / 64.1% |
| lvl5 v lvl5 | 0 / 11.8 / 88.2 | 0 / 40.3 / 59.7 | 50.2% / 42.8% |
| lvl7 (pow 9) v lvl6 | 2.2 / 4.9 / 92.9 | 20.1 / 32.1 / 47.8 | 67.7% / 61.1% |

(The 64 to 70% "points won" against the lvl5 / lvl6 pairs is mostly the general strength gap: it is about the same in every variant.)

Notes and caveats:
- Change 1 affects **every non-lob shot against a net pair** (volleys, flat shots, viboras aimed deep past them also get the reach
  floor today). It is the right fix, but run `scripts/simBalance.ts` and `scripts/simShots.ts` before and after.
- The heat map and the button colours use `reachAgainst`, so they follow the fix automatically: the deep middle against a net pair
  will no longer show green.
- At even stats neither bajada ever wins outright, now or after the fix. In this engine winners come from stat edges, reach and
  low-margin shots. If the owner wants the fast bajada to be a real weapon at even stats, its margin has to drop to about 15
  (smashes use 8 to 20). That is a separate balance decision.

### 4c. The middle: "who takes it?" instead of a hole

Proposal (optional, on top of 4b): when the ball comes down between the two defenders, both reach it well (each factor ≥ 0.8) and
they are about equally far from it (|gap0 − gap1| < 1 m), roll a **5% mix-up**. Nobody plays it: a winner flagged e.g.
`step.confusion = true`, with the commentary "Yours! Mine!" and both players stepping in and stopping. In exchange set the middle
`hesitation` 0.88 → 1.0 (`directions.json:3`), so the middle's weakness becomes an occasional visible mix-up instead of a permanent
hidden defence cut. Simulated (variant F): middle deep against a back pair, slow 0% → 3 to 4% winners (all mix-ups) at every level.
Against a net pair the ball passes much nearer one player, so the rule rarely fires and the middle winners drop to 0 to 13% (fast).
Because `hesitation` applies to every middle shot, this needs a whole-game balance run. If that is too broad, keep 0.88 and skip the
mix-up: 4b's two-defender cover already stops the middle from being a hole.

### 4d. Presentation (MatchScene, visual only)

In the winner branch (`MatchScene.ts:2718-2725`) do not send the defender to the play point. Stop him short, so that the ball clearly
passes out of reach: for example, end the run on the line towards `spot` with at least 1.5 m left (racket plus lunge reach ≈ 1.2 m),
or let him cover only part of the way, scaled by the engine's reach. Keep the lunge (now visibly short). Against a net pair the
natural picture for a winner is a volley lunge towards the passing ball (`flight` at the defender's z), not a run back to the glass.
After 4b such winners only happen when the ball is fast or into a real hole, so the picture will match.

## Reproduce

```
cp /home/claude/analysis/scratch/tmp_bajada.ts /home/claude/padel-champ/scripts/tmp_bajada.ts
cd /home/claude/padel-champ
npx vite-node scripts/tmp_bajada.ts gaps 1 5        # 2a (defender speed 5)
npx vite-node scripts/tmp_bajada.ts matrix 10000     # 2b
npx vite-node scripts/tmp_bajada.ts match 300        # 2c (formations, current outcomes)
npx vite-node scripts/tmp_bajada.ts visual           # 3
npx vite-node scripts/tmp_bajada.ts check 20000      # the replica of stepHit agrees with stepHit
npx vite-node scripts/tmp_bajada.ts variants 6000 [A,B,C,D,E,F,current]   # 4: single rolls per variant
npx vite-node scripts/tmp_bajada.ts matchv 300 [names]                     # 4: real matches per variant
npx vite-node scripts/tmp_bajada.ts cpu 300          # CPU-vs-CPU balance with the data patch
rm scripts/tmp_bajada.ts
```

Code variants are simulated with a replica of the bajada path of `stepHit` (`replicaHit`: same `targetLanding`, `resolveHit`, miss
rule). It matches `stepHit` within noise for the current values (e.g. slow vs net 85.6/6.6/7.8 in both). In the match sims the
replica's outcome is fed into `stepHit` via `options.force` and its pressure is copied into the next ball. Data patches are applied to
copies of the shot objects (and to the shared `SHOTS` objects for the CPU run, restored afterwards).
