# How points and shots end in the PorTres engine (v0.155)

Read-only analysis of `src/game/` (nothing in `src/` or `src/data/` was changed). Script: `scripts/simMatrix.ts`
(`npx vite-node scripts/simMatrix.ts /home/claude/analysis 6000 3000`, about 16 min). Full per-cell data: `engine_matrix.csv`
(13,380 cells, 3,000 seeded trials each). Raw output of every table, including the ones left out here: `engine_tables.md`.

Notation: **W/E/C** = winner % / error % / ball continues % of the shot. "Level 4v4" = every attribute 4 for all four players;
"7v4" = hitter's pair all 7, defenders all 4. **pp** = percentage points.

## Summary: the 10 numbers that matter

1. **Points end in errors, not winners.** Even 4v4: **81% errors, 19% winners**; even 7v7: 53% / 46%; default teams 44% / 56%.
   **Aces 0.0-0.4%, double faults 0.3-0.5%** of points in every set-up.
2. **The engine has no forced errors.** The error is rolled *before* the attack/defence duel, from the shot's risk alone; the
   pressure of the incoming ball does not change it. Error rate per hit by incoming pressure (default teams): 7.0 / 7.2 / 6.8 / 6.6 %
   (none / low / medium / high). A proxy (error on a ball with pressure >= 0.10) gives only **1.2-1.6% of points** at even levels
   (4.4% default teams, 7.2% strong v weak).
3. **Every winner is a ball nobody touches**, and in the engine's own terms it is never a ball within reach: 0.0-0.3% of winners came down
   within the defender's full reach. **40-73% of all winners (default and even teams; 19% at 7v4) are smashes / specials over the fence, where the defenders'
   position is not checked at all.** The scene then shows the defender lunging "a moment too late" for every winner.
4. **Rallies are long.** Even levels: **9.2 shots per point** counting the serve, **43-50% of points last 10+ shots**, only 3-6% last 1-2.
   Default teams 7.3; strong v weak 5.8.
5. **The lob is close to half the game:** rally_lob + lob = **42-45% of all hits**, 0% winners (by rule), and **30-37% of all errors**.
6. **At even levels almost no ordinary shot wins:** bajada slow 0%, bajada fast 0% (with **25-37% errors**), flat, block, rulo,
   contrapared 0%, volley 1-2%, bounce shot 0-1%. The winners come from vibora (21% at 4v4, 41% at 7v7), smashes (x3 64/83%,
   x4 49/80%), the dejada against a pair at the back (22/52%) and the specials (60-84%).
7. **A small stat gap decides everything.** At 7v4 most attacking shots win 30-95% of the time (volley 49%, bounce shot 53%, bandeja
   85%, vibora 92%; even the chiquita: 65% against a pair at the back), and vibora, smashes and specials are **never returned (0% continue)**. With equal stats the level alone moves
   winners from 19% (4v4) to 46% (7v7) of points.
8. **Specials win 84% at level 4 with 0% continue** (a defender with defence + speed <= 8 can never answer one), 60-73% at 7v7; the
   defenders' position changes them by 1.5-4 pp at most.
9. **Bajada Low Speed is a cliff, not a curve.** Against a pair at the back it is **never a winner, at any power (4 to 9)**. Against a
   pair at the net (all-5 defenders), with the ball high off the glass: power 6: 0-17% winners, **power 7: 5-69%, power 8: 37-90%,
   power 9: 71-94%**. "Deep to the glass, middle" is the worst case: **69% at power 7, 90% at power 8**. A power-8 hero against the
   default CPU pair (Bruno + Ines) at the net: 72% winners and 1 ball in 4 comes back. The fast bajada: 0% continue at power 9 against a net pair.
10. **Why the bajada does that** (details in Method 4): against defenders at the net their defence is x0.75 (`REBOUND_POSITION.net`) x1.2
   (volley bonus), and their reach is measured to the **bounce spot 4 to 7 m behind them** (reach 0.55-0.70), not to where the scene
   shows them volleying it at the net. On top of that the random spread is only 0-20 points per side, while one power point adds
   about 9 attack points: two stat points take a shot from 0% to 70%.

## 1. Match level (CPU v CPU, `simCore.playMatch`, about 6,000 points per row)

Specials as in the game (`withSpecial`: CPU players whose attributes average 5 or more get one; the 4-rated players get none).
Simulation positions: `simCore` does not pass player positions, so reach is measured from the formation spots (`restPos`) with an
assumed 16 m flight, as in all existing balance scripts. The scene passes the real positions.

| Teams | Points | Winner | Error | of which "forced" (proxy) | Ace | Double fault | Avg shots / point (incl. serve) | 1-2 shots | 3-5 | 6-9 | 10+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| default (Toro+Mia v Bruno+Ines) | 6009 | 55.8% | 43.7% | 4.4% | 0.1% | 0.3% | 7.28 | 4.8% | 39.7% | 28.7% | 26.8% |
| even 4 v 4 | 6020 | 18.7% | 80.9% | 1.6% | 0.0% | 0.4% | 9.16 | 5.9% | 24.1% | 25.1% | 44.9% |
| even 7 v 7 | 6002 | 46.3% | 53.3% | 1.2% | 0.0% | 0.4% | 9.19 | 3.4% | 28.6% | 25.2% | 42.8% |
| even 7 v 7, no specials | 6004 | 37.5% | 62.0% | 1.6% | 0.0% | 0.5% | 10.08 | 4.0% | 23.2% | 23.3% | 49.6% |
| strong 7 v weak 4 | 6001 | 69.8% | 29.3% | 7.2% | 0.4% | 0.4% | 5.76 | 5.5% | 53.0% | 28.2% | 13.4% |

"Forced" proxy: the error was made on a ball that came with pressure >= 0.10 (the previous shot beat the defence by 20+ points
without winning). "Unforced" = error minus that. Shots per point: a point ending in an ace counts 1, a double fault 0.

**What the winners are** (share of all winners):

| Teams | over the fence / rulo (no landing spot, reach not checked) | landed within full reach (reach = 1) | landed out of full reach (reach < 1) | flew back over the net off the glass | Por Cuatro fumbled before the glass | special shots | on the return of serve |
|---|---|---|---|---|---|---|---|
| default | 40.5% | 0.2% | 59.3% | 20.1% | 0.3% | 26.2% | 0.1% |
| even 4 v 4 | 58.7% | 0.0% | 41.3% | 18.5% | 5.2% | 0% (none) | 0.0% |
| even 7 v 7 | 72.6% | 0.1% | 27.3% | 38.4% | 0.5% | 42.5% | 0.0% |
| even 7 v 7, no specials | 53.8% | 0.0% | 46.2% | 17.3% | 0.7% | 0% | 0.0% |
| strong 7 v weak 4 | 19.4% | 0.3% | 80.3% | 10.8% | 0.4% | 13.2% | 0.7% |

(The columns overlap: a special or a rebound winner is also counted in one of the first three.) "Untouched vs reached": the engine has
no "defender reached it but lost the point" outcome. A Por Cuatro fumbled before the glass (`earlyError`) is the only case and is
scored as the hitter's winner. In real-padel terms those would be forced errors.

**Errors do not depend on pressure**:

| Teams | Hits with incoming pressure 0 | (0, 0.05) | [0.05, 0.10) | >= 0.10 | Error rate per hit in each band |
|---|---|---|---|---|---|
| default | 52.7% | 21.0% | 15.7% | 10.6% | 7.0 / 7.2 / 6.8 / 6.6 % |
| even 4 v 4 | 62.4% | 25.9% | 9.7% | 2.0% | 9.8 / 9.8 / 10.7 / 9.3 % |
| even 7 v 7 | 71.8% | 18.6% | 6.8% | 2.7% | 6.4 / 7.1 / 6.1 / 5.4 % |
| strong 7 v weak 4 | 55.9% | 7.8% | 14.8% | 21.6% | 5.3 / 6.5 / 7.8 / 7.1 % |

Mean incoming pressure is 0.013-0.045 (scale 0 to 0.25). For most shots it cannot exceed about margin / 200 = 0.12-0.14, because a
bigger lead is a winner. Its only effect is to scale the next hitter's attack by (1 - pressure), and the spread when aiming at a tapped spot.

**Shots in play** (share of all rally hits, winner %, error %):

| Shot | default: share / W% / E% | even 4v4: share / W% / E% | even 7v7 (no specials): share / W% / E% |
|---|---|---|---|
| rally_lob | 34.2% / 0.0% / 5.5% | 37.5% / 0.0% / 9.0% | 37.6% / 0.0% / 5.7% |
| volley | 11.1% / 8.3% / 7.2% | 11.7% / 0.1% / 10.5% | 12.3% / 0.1% / 6.6% |
| lob | 8.8% / 0.0% / 2.6% | 7.2% / 0.0% / 4.1% | 6.5% / 0.0% / 2.7% |
| bounce_shot | 8.2% / 12.9% / 7.6% | 7.9% / 0.3% / 9.9% | 8.1% / 0.5% / 6.9% |
| rally_chiquita | 7.7% / 0.7% / 5.4% | 8.4% / 0.0% / 8.3% | 8.5% / 0.0% / 5.3% |
| flat | 5.2% / 0.2% / 7.9% | 3.6% / 0.0% / 9.1% | 3.1% / 0.0% / 5.9% |
| bajada_slow | 3.7% / 18.5% / 5.4% | 3.8% / 0.3% / 9.6% | 3.7% / 0.7% / 6.8% |
| dejada | 3.1% / 7.2% / 8.2% | 3.2% / 0.1% / 13.2% | 3.1% / 0.3% / 9.6% |
| bajada_fast | 2.5% / 12.4% / 30.4% | 2.3% / 0.0% / 33.2% | 2.3% / 1.3% / 29.1% |
| bloqueo | 2.5% / 0.0% / 3.5% | 2.6% / 0.0% / 5.8% | 2.6% / 0.0% / 4.5% |
| vibora | 2.4% / 41.8% / 11.8% | 3.4% / 23.7% / 15.0% | 3.5% / 46.7% / 9.9% |
| bandeja | 2.4% / 17.8% / 3.7% | 3.1% / 3.0% / 6.6% | 3.1% / 5.5% / 4.9% |
| sp_skyrocket | 2.1% / 83.5% / 12.3% | - | - |
| chiquita | 1.9% / 0.1% / 3.2% | 1.4% / 0.0% / 4.1% | 1.4% / 0.0% / 2.4% |
| smash_x4 | 1.3% / 72.8% / 16.0% | 1.5% / 37.4% / 18.5% | 1.5% / 69.1% / 13.7% |
| smash_x3 | 1.1% / 72.6% / 13.5% | 1.3% / 60.4% / 18.0% | 1.4% / 81.8% / 15.0% |
| rulo | 1.0% / 5.4% / 16.3% | 1.2% / 0.0% / 18.7% | 1.3% / 0.0% / 15.9% |
| sp_cornerlock | 0.7% / 75.8% / 13.5% | - | - |

## 2. Shot matrix (`stepHit` called directly)

Every rally shot, return shot and special, in every allowed combination of: incoming ball **low / mid / high**; **after the bounce /
off the back glass / out of the air**; hitter's pair at the **back / mid / net**; defenders **back / mid / net / split** (one at the net,
one at the back); aim **parallel / middle / cross** (menu directions, one of the 10 aim points at random, no CPU gap-seeking) and three
**tap targets** (the default aim mode, SETTINGS > AIM = point): **T:mid-deep** (x 0, 8.8 m, "middle deep to the glass"),
**T:mid-nominal** (x 0, the shot's own depth), **T:corner-deep** (x 3.6, 8.8 m); levels **4v4, 7v7, 7v4**. Combinations the
rules forbid (`unavailableReason`) are skipped. Positions are passed as in the scene (`ReachPositions`: formation spots of both pairs).
For every ball that continues, the defender's reply is also played by the CPU (`pickHit`): "reply W/E" is how that next shot ends.

Cells are pooled with equal weight. Read the pooled numbers as "over all situations in which the shot can be played", not as match frequencies.

### 2a. By defender set-up (directions only)

**Level 4v4**

| Shot | def back | def mid | def net | def split (1 up 1 back) | all | mean pressure after continue | reply W/E % (defender's next shot) |
|---|---|---|---|---|---|---|---|
| chiquita | 1/7/91 | 0/7/93 | 0/7/93 | 0/7/93 | 0/7/92 | 0.010 | 0/6 |
| lob | 0/6/94 | 0/6/94 | 0/6/94 | 0/6/94 | 0/6/94 | 0.002 | 6/8 |
| flat | 0/11/89 | 0/11/89 | 0/11/89 | 0/11/89 | 0/11/89 | 0.011 | 1/7 |
| vibora | 17/11/72 | 7/11/82 | 25/12/63 | 33/11/56 | 21/11/68 | 0.051 | 0/6 |
| bandeja | 0/6/94 | 0/6/94 | 3/6/92 | 7/5/87 | 3/5/92 | 0.021 | 0/6 |
| rally_lob | 0/8/92 | 0/8/92 | 0/8/92 | 0/8/92 | 0/8/92 | 0.003 | 6/8 |
| volley | 1/9/89 | 0/10/90 | 0/9/91 | 1/9/89 | 1/9/90 | 0.018 | 0/6 |
| bloqueo | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0.001 | 0/6 |
| bounce_shot | 0/9/90 | 0/9/91 | 0/9/91 | 1/9/90 | 0/9/90 | 0.016 | 0/7 |
| contrapared | 0/14/86 | 0/14/86 | 0/15/85 | 0/14/86 | 0/14/86 | 0.000 | 0/7 |
| rulo | 0/15/85 | 0/14/86 | 0/14/86 | 0/15/85 | 0/15/85 | 0.010 | 0/5 |
| smash_x3 | 65/17/18 | 64/17/19 | 64/17/19 | 65/17/18 | 64/17/18 | 0.019 | 0/9 |
| smash_x4 | 49/15/36 | 49/15/35 | 49/16/35 | 50/15/36 | 49/15/36 | 0.054 | 1/5 |
| bajada_fast | 0/32/68 | 0/31/69 | 0/31/69 | 0/31/69 | 0/31/69 | 0.055 | 0/7 |
| bajada_slow | 0/7/93 | 0/7/93 | 0/7/93 | 0/7/93 | 0/7/93 | 0.005 | 0/9 |
| rally_chiquita | 3/7/89 | 0/7/93 | 0/7/93 | 0/7/92 | 1/7/92 | 0.014 | 0/6 |
| dejada | 22/11/66 | 0/11/88 | - | 7/11/82 | 10/11/79 | 0.043 | 1/6 |
| sp_skyrocket | 84/16/0 | 84/16/0 | 84/16/0 | 83/17/0 | 84/16/0 | 0.000 | 0/0 |
| sp_venom | 82/18/0 | 80/18/2 | 82/18/0 | 83/17/0 | 82/18/0 | 0.014 | 0/7 |
| sp_cornerlock | 82/14/4 | 85/15/0 | 86/14/0 | 82/14/3 | 84/14/2 | 0.026 | 0/9 |
| sp_freeze | 83/17/0 | 73/17/9 | - | 81/18/1 | 79/17/3 | 0.021 | 1/5 |

**Level 7v7**

| Shot | def back | def mid | def net | def split (1 up 1 back) | all | mean pressure after continue | reply W/E % (defender's next shot) |
|---|---|---|---|---|---|---|---|
| chiquita | 3/5/92 | 0/5/95 | 0/5/95 | 0/5/95 | 1/5/95 | 0.006 | 0/3 |
| lob | 0/4/96 | 0/4/96 | 0/4/96 | 0/4/96 | 0/4/96 | 0.000 | 11/5 |
| flat | 0/8/92 | 0/9/91 | 0/9/91 | 0/8/92 | 0/8/92 | 0.008 | 1/4 |
| vibora | 43/8/48 | 17/9/75 | 46/8/46 | 57/8/34 | 41/8/51 | 0.059 | 0/3 |
| bandeja | 0/3/97 | 0/3/97 | 1/4/95 | 13/4/84 | 4/3/93 | 0.015 | 0/4 |
| rally_lob | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0.001 | 10/5 |
| volley | 4/6/90 | 0/6/94 | 0/7/93 | 4/7/90 | 2/6/92 | 0.015 | 0/3 |
| bloqueo | 0/3/97 | 0/3/97 | 0/3/97 | 0/3/97 | 0/3/97 | 0.000 | 1/3 |
| bounce_shot | 1/7/92 | 0/6/94 | 0/6/94 | 2/6/92 | 1/6/93 | 0.013 | 0/4 |
| contrapared | 0/11/89 | 0/11/89 | 0/12/88 | 0/11/89 | 0/11/89 | 0.000 | 0/4 |
| rulo | 0/12/88 | 0/12/88 | 0/12/88 | 0/13/87 | 0/12/88 | 0.007 | 0/3 |
| smash_x3 | 83/15/2 | 84/14/2 | 83/14/2 | 83/15/2 | 83/15/2 | 0.031 | 0/6 |
| smash_x4 | 80/13/8 | 80/13/7 | 79/13/8 | 81/12/7 | 80/13/8 | 0.072 | 1/3 |
| bajada_fast | 0/28/72 | 0/28/72 | 1/29/70 | 0/29/71 | 0/29/71 | 0.073 | 0/4 |
| bajada_slow | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0.003 | 1/6 |
| rally_chiquita | 7/5/89 | 0/5/95 | 0/5/95 | 0/5/95 | 2/5/94 | 0.010 | 0/3 |
| dejada | 52/8/39 | 1/9/91 | - | 18/9/74 | 23/8/68 | 0.042 | 1/3 |
| sp_skyrocket | 74/14/13 | 73/14/13 | 73/14/13 | 73/13/13 | 73/14/13 | 0.250 | 0/3 |
| sp_venom | 61/14/25 | 59/15/26 | 60/15/25 | 60/15/25 | 60/15/25 | 0.250 | 0/5 |
| sp_cornerlock | 61/12/27 | 62/12/26 | 62/12/26 | 62/12/26 | 61/12/26 | 0.250 | 0/4 |
| sp_freeze | 60/14/26 | 58/14/28 | - | 60/14/26 | 59/14/26 | 0.242 | 0/4 |

**Level 7v4 (strong hitter, weak defenders)**

| Shot | def back | def mid | def net | def split (1 up 1 back) | all | mean pressure after continue | reply W/E % (defender's next shot) |
|---|---|---|---|---|---|---|---|
| chiquita | 65/5/30 | 16/5/79 | 3/5/92 | 37/5/59 | 30/5/65 | 0.051 | 0/5 |
| lob | 0/4/96 | 0/4/96 | 0/4/96 | 0/4/96 | 0/4/96 | 0.058 | 0/7 |
| flat | 0/8/91 | 0/9/91 | 0/8/92 | 1/8/91 | 0/8/91 | 0.114 | 0/6 |
| vibora | 91/9/0 | 91/9/0 | 92/8/0 | 92/8/0 | 92/8/0 | 0.000 | 0/0 |
| bandeja | 83/3/13 | 76/3/20 | 93/3/3 | 87/3/10 | 85/3/12 | 0.088 | 0/5 |
| rally_lob | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0/5/95 | 0.064 | 0/7 |
| volley | 59/6/34 | 34/6/59 | 43/7/51 | 60/6/34 | 49/6/44 | 0.077 | 0/5 |
| bloqueo | 3/3/94 | 0/3/97 | 0/3/97 | 0/3/97 | 1/3/96 | 0.015 | 0/5 |
| bounce_shot | 62/6/31 | 38/6/56 | 49/7/45 | 64/6/29 | 53/6/40 | 0.076 | 0/6 |
| contrapared | 17/11/72 | 5/11/84 | 10/12/78 | 16/11/73 | 12/11/77 | 0.060 | 0/6 |
| rulo | 38/12/50 | 39/12/49 | 38/12/50 | 38/13/49 | 38/12/49 | 0.139 | 0/4 |
| smash_x3 | 85/15/0 | 85/15/0 | 85/15/0 | 85/15/0 | 85/15/0 | 0.000 | 0/0 |
| smash_x4 | 88/12/0 | 87/13/0 | 88/12/0 | 88/12/0 | 88/12/0 | 0.000 | 0/0 |
| bajada_fast | 0/28/72 | 11/29/61 | 50/28/21 | 14/28/57 | 19/28/53 | 0.183 | 0/6 |
| bajada_slow | 0/5/95 | 4/5/92 | 64/5/31 | 9/5/87 | 19/5/76 | 0.041 | 0/8 |
| rally_chiquita | 81/5/14 | 29/5/66 | 9/5/87 | 55/5/41 | 44/5/52 | 0.062 | 0/5 |
| dejada | 91/8/1 | 66/8/25 | - | 86/9/6 | 81/8/11 | 0.091 | 0/5 |
| sp_skyrocket | 86/14/0 | 86/14/0 | 86/14/0 | 86/14/0 | 86/14/0 | 0.000 | 0/0 |
| sp_venom | 86/14/0 | 85/15/0 | 86/14/0 | 85/15/0 | 85/15/0 | 0.000 | 0/0 |
| sp_cornerlock | 88/12/0 | 88/12/0 | 88/12/0 | 88/12/0 | 88/12/0 | 0.000 | 0/0 |
| sp_freeze | 86/14/0 | 86/14/0 | - | 86/14/0 | 86/14/0 | 0.000 | 0/0 |

### 2b. By aim (defender set-ups pooled)

**Level 4v4**

| Shot | parallel | middle | cross | T:mid-deep | T:mid-nominal | T:corner-deep |
|---|---|---|---|---|---|---|
| chiquita | 1/13/86 | 0/3/97 | 0/6/94 | 0/4/96 | 0/3/96 | 0/6/94 |
| lob | 0/12/88 | 0/2/98 | 0/5/95 | 0/9/91 | 0/5/95 | 0/11/89 |
| flat | 0/17/83 | 0/7/93 | 0/10/90 | 0/12/88 | 0/7/93 | 0/14/86 |
| vibora | 33/17/51 | 24/7/69 | 5/10/85 | 34/12/54 | 29/7/65 | 22/14/64 |
| bandeja | 6/11/83 | 2/1/97 | 0/4/96 | 3/5/92 | 2/1/97 | 2/7/92 |
| rally_lob | 0/13/87 | 0/3/97 | 0/7/93 | 0/11/89 | 0/6/94 | 0/12/88 |
| volley | 1/15/84 | 1/5/94 | 0/8/92 | 2/11/87 | 1/5/94 | 1/13/86 |
| bloqueo | 0/10/90 | 0/1/99 | 0/3/97 | 0/2/98 | 0/1/99 | 0/3/97 |
| bounce_shot | 1/15/84 | 0/5/95 | 0/8/92 | 1/10/89 | 1/5/94 | 1/12/87 |
| contrapared | - | - | 0/14/86 | 0/16/84 | 0/13/87 | 0/16/84 |
| rulo | - | - | 0/15/85 | - | - | - |
| smash_x3 | 73/20/7 | 60/15/24 | 60/17/23 | - | - | - |
| smash_x4 | 62/18/20 | 43/13/44 | 43/15/42 | - | - | - |
| bajada_fast | 0/37/63 | 0/27/73 | 0/30/70 | 0/34/66 | 0/27/73 | 0/35/65 |
| bajada_slow | 0/13/87 | 0/3/97 | 0/6/94 | 0/6/94 | 0/3/97 | 0/8/92 |
| rally_chiquita | 2/13/85 | 1/3/96 | 0/6/94 | 0/4/96 | 1/3/96 | 0/6/94 |
| dejada | 12/17/71 | 8/7/85 | 9/10/81 | 1/7/92 | 8/8/84 | 0/9/91 |
| sp_skyrocket | 81/19/0 | 86/14/0 | 84/16/0 | - | - | - |
| sp_venom | 77/23/0 | 87/13/0 | 82/16/1 | 82/18/0 | 87/13/0 | 79/21/0 |
| sp_cornerlock | 80/20/0 | 89/10/1 | 83/13/4 | 85/14/1 | 88/11/1 | 81/15/3 |
| sp_freeze | 76/23/1 | 84/13/3 | 78/16/6 | 82/13/5 | 79/18/2 | 78/15/8 |

**Level 7v7**

| Shot | parallel | middle | cross | T:mid-deep | T:mid-nominal | T:corner-deep |
|---|---|---|---|---|---|---|
| chiquita | 2/10/89 | 1/1/98 | 0/3/97 | 0/1/99 | 1/1/98 | 0/2/98 |
| lob | 0/9/91 | 0/1/99 | 0/2/98 | 0/1/99 | 0/1/99 | 0/2/98 |
| flat | 0/14/86 | 0/4/96 | 0/7/93 | 0/4/96 | 0/4/96 | 0/6/94 |
| vibora | 58/14/29 | 54/4/42 | 11/7/82 | 73/4/22 | 61/4/34 | 43/6/51 |
| bandeja | 9/8/83 | 1/1/98 | 0/2/98 | 7/1/92 | 1/1/98 | 2/1/97 |
| rally_lob | 0/10/90 | 0/2/98 | 0/4/96 | 0/3/97 | 0/2/98 | 0/3/97 |
| volley | 3/12/86 | 3/2/95 | 0/5/95 | 8/3/90 | 4/2/94 | 4/5/91 |
| bloqueo | 0/7/93 | 0/1/99 | 0/1/99 | 0/1/99 | 0/1/99 | 0/1/99 |
| bounce_shot | 1/12/87 | 1/2/96 | 0/5/95 | 5/2/93 | 2/2/96 | 2/4/93 |
| contrapared | - | - | 0/11/89 | 0/11/89 | 0/11/89 | 0/11/89 |
| rulo | - | - | 0/12/88 | - | - | - |
| smash_x3 | 82/18/0 | 84/12/4 | 83/14/3 | - | - | - |
| smash_x4 | 85/15/0 | 77/10/13 | 77/12/10 | - | - | - |
| bajada_fast | 1/34/65 | 0/24/76 | 0/27/73 | 0/25/75 | 0/24/76 | 0/27/72 |
| bajada_slow | 0/10/90 | 0/1/99 | 0/3/97 | 2/1/97 | 0/1/99 | 0/2/97 |
| rally_chiquita | 3/10/87 | 2/1/97 | 0/3/97 | 0/1/99 | 2/1/97 | 0/2/98 |
| dejada | 26/14/60 | 22/4/73 | 22/7/71 | 3/4/93 | 23/4/72 | 1/6/93 |
| sp_skyrocket | 71/16/13 | 75/11/13 | 74/13/13 | - | - | - |
| sp_venom | 56/20/24 | 63/10/27 | 61/14/26 | 62/11/27 | 63/10/27 | 61/13/26 |
| sp_cornerlock | 58/17/25 | 63/9/27 | 63/10/27 | 64/9/27 | 63/9/27 | 63/9/27 |
| sp_freeze | 56/20/24 | 63/10/27 | 59/13/28 | 63/10/27 | 62/11/27 | 60/13/27 |

### 2c. By incoming ball and hitter's place: each cell is "4v4 | 7v7"

| Shot | low | mid | high | after bounce | off glass | out of the air | hitter back | hitter mid | hitter net |
|---|---|---|---|---|---|---|---|---|---|
| chiquita | 1/7/92 \| 2/5/94 | 0/7/92 \| 1/5/95 | 0/7/93 \| 0/5/95 | 0/7/92 \| 1/5/95 | 0/7/92 \| 1/5/95 | 0/7/92 \| 1/5/95 | 0/7/93 \| 0/5/95 | 0/7/92 \| 0/5/95 | 1/7/92 \| 2/5/93 |
| lob | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 |
| flat | 0/11/89 \| 0/9/91 | 0/11/89 \| 0/8/92 | 0/11/89 \| 0/8/92 | 0/11/89 \| 0/8/92 | 0/11/89 \| 0/9/91 | 0/11/89 \| 0/8/92 | 0/11/89 \| 0/8/92 | 0/11/89 \| 0/8/92 | 0/11/89 \| 0/8/92 |
| vibora | - | - | 21/11/68 \| 41/8/51 | - | - | 21/11/68 \| 41/8/51 | 18/11/70 \| 38/8/54 | 23/11/66 \| 44/9/48 | - |
| bandeja | - | - | 3/5/92 \| 4/3/93 | - | - | 3/5/92 \| 4/3/93 | 2/5/93 \| 3/3/94 | 3/6/91 \| 4/3/92 | - |
| rally_lob | 0/10/90 \| 0/8/92 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/6/94 \| 0/4/96 | 0/10/90 \| 0/8/92 | 0/6/94 \| 0/4/96 | 0/8/92 \| 0/5/95 | 0/8/92 \| 0/5/95 | 0/8/92 \| 0/5/95 |
| volley | 0/9/90 \| 0/7/93 | 2/9/89 \| 5/6/88 | 0/9/91 \| 0/6/94 | - | - | 1/9/90 \| 2/6/92 | 1/9/90 \| 2/7/92 | 1/9/90 \| 2/6/92 | 1/10/90 \| 2/7/92 |
| bloqueo | 0/5/95 \| 0/3/97 | 0/5/95 \| 0/3/97 | - | - | - | 0/5/95 \| 0/3/97 | - | - | 0/5/95 \| 0/3/97 |
| bounce_shot | 1/9/90 \| 2/7/91 | 0/9/91 \| 0/6/93 | 0/9/91 \| 0/6/94 | 0/9/90 \| 1/6/93 | 0/9/90 \| 1/6/93 | - | 0/9/90 \| 1/6/93 | 0/9/90 \| 1/6/92 | - |
| contrapared | 0/14/86 \| 0/11/89 | 0/15/85 \| 0/11/89 | - | 0/14/86 \| 0/11/89 | - | - | 0/14/86 \| 0/11/89 | - | - |
| rulo | - | - | 0/15/85 \| 0/12/88 | - | - | 0/15/85 \| 0/12/88 | 0/15/85 \| 0/13/87 | 0/15/85 \| 0/13/87 | 0/15/85 \| 0/12/88 |
| smash_x3 | - | - | 64/17/18 \| 83/15/2 | - | - | 64/17/18 \| 83/15/2 | - | 64/17/18 \| 83/15/2 | 64/17/19 \| 83/14/2 |
| smash_x4 | - | - | 49/15/36 \| 80/13/8 | - | - | 49/15/36 \| 80/13/8 | - | 49/15/35 \| 80/13/7 | 49/15/36 \| 80/13/8 |
| bajada_fast | - | 0/31/69 \| 0/29/71 | 0/31/69 \| 0/28/71 | - | 0/31/69 \| 0/29/71 | - | 0/31/69 \| 0/29/71 | 0/31/69 \| 0/28/71 | 0/31/69 \| 0/29/71 |
| bajada_slow | - | 0/7/93 \| 0/5/95 | 0/7/93 \| 0/5/95 | - | 0/7/93 \| 0/5/95 | - | 0/8/93 \| 0/5/95 | 0/7/93 \| 0/5/95 | 0/7/93 \| 0/5/95 |
| rally_chiquita | 1/7/91 \| 3/5/92 | 0/7/92 \| 1/5/95 | - | 1/7/92 \| 2/5/94 | 1/7/92 \| 2/5/94 | 1/7/92 \| 2/5/94 | 0/7/93 \| 0/5/95 | 1/7/92 \| 1/5/94 | 2/7/91 \| 4/5/91 |
| dejada | 14/11/74 \| 33/9/58 | 5/11/83 \| 14/8/78 | - | 10/11/79 \| 23/8/68 | - | 10/11/79 \| 23/9/68 | - | 8/11/81 \| 20/8/72 | 11/11/77 \| 27/8/64 |
| sp_skyrocket | - | - | 84/16/0 \| 73/14/13 | - | - | 84/16/0 \| 73/14/13 | - | 84/16/0 \| 74/13/13 | 84/16/0 \| 73/14/13 |
| sp_venom | - | - | 82/18/0 \| 60/15/25 | - | - | 82/18/0 \| 60/15/25 | 82/17/0 \| 60/15/25 | 82/18/0 \| 60/14/26 | - |
| sp_cornerlock | - | - | 84/14/2 \| 61/12/26 | - | - | 84/14/2 \| 61/12/26 | 84/14/2 \| 62/12/27 | 84/14/2 \| 61/12/26 | - |
| sp_freeze | 82/17/1 \| 60/14/26 | 77/17/6 \| 59/14/27 | - | 79/17/3 \| 59/14/26 | - | 79/17/3 \| 59/14/26 | - | 78/17/4 \| 59/14/27 | 80/17/3 \| 60/14/26 |

## 3. Outliers

### 3a. Cells with winner > 35%, error > 30% or 0% continue

| Shot | outlier cells / all cells | max winner% (cell) | max error% | cells with 0% continue |
|---|---|---|---|---|
| chiquita | 215 / 1944 | 93.6% (7v4 low bounce hitter net def back middle) | 14.5% | 3 |
| lob | 0 / 1944 | 0.0% (4v4 low bounce hitter back def back parallel) | 13.6% | 0 |
| flat | 0 / 1944 | 7.8% (7v4 mid bounce hitter net def split parallel) | 18.9% | 0 |
| vibora | 90 / 144 | 96.3% (7v4 high air hitter mid def split T:mid-deep) | 17.9% | 48 |
| bandeja | 49 / 144 | 99.2% (7v4 high air hitter mid def net T:mid-deep) | 12.0% | 7 |
| rally_lob | 0 / 1944 | 0.0% (4v4 low bounce hitter back def back parallel) | 25.1% | 0 |
| volley | 142 / 648 | 98.0% (7v4 mid air hitter mid def split middle) | 16.1% | 12 |
| bloqueo | 0 / 144 | 5.9% (7v4 mid air hitter net def back parallel) | 10.9% | 0 |
| bounce_shot | 208 / 864 | 97.8% (7v4 low glass hitter mid def split T:mid-nominal) | 16.3% | 14 |
| contrapared | 15 / 96 | 81.0% (7v4 mid bounce hitter back def net T:mid-deep) | 17.8% | 0 |
| rulo | 12 / 36 | 39.9% (7v4 high air hitter mid def mid cross) | 15.5% | 0 |
| smash_x3 | 72 / 72 | 88.6% (7v4 high air hitter net def net middle) | 20.8% | 32 |
| smash_x4 | 72 / 72 | 90.7% (7v4 high air hitter net def back middle) | 18.8% | 29 |
| bajada_fast | 156 / 432 | 67.7% (7v4 high glass hitter net def net parallel) | 37.9% | 0 |
| bajada_slow | 38 / 432 | 94.1% (7v4 high glass hitter net def net T:corner-deep) | 14.3% | 0 |
| rally_chiquita | 222 / 1296 | 97.3% (7v4 low bounce hitter net def back T:mid-nominal) | 14.2% | 6 |
| dejada | 172 / 432 | 95.9% (7v4 low bounce hitter mid def back middle) | 18.5% | 28 |
| sp_skyrocket | 72 / 72 | 89.7% (7v4 high air hitter net def split middle) | 20.5% | 48 |
| sp_venom | 144 / 144 | 91.0% (7v4 high air hitter back def net middle) | 24.1% | 81 |
| sp_cornerlock | 144 / 144 | 92.1% (7v4 high air hitter back def net T:mid-nominal) | 22.0% | 71 |
| sp_freeze | 432 / 432 | 90.5% (7v4 low bounce hitter net def mid T:mid-deep) | 25.0% | 200 |

- **Winner > 35%** at even levels: smash x3 / x4, every special, the vibora (vs net, back or split pairs; parallel / middle / deep aims),
  the dejada against a pair at the back (52% at 7v7). At 7v4 almost every attacking shot is above 35%.
- **Error > 30%**: only the **fast bajada** (risk 0.30; 31% pooled at 4v4, 29% at 7v7, up to 38% aimed parallel). Every other shot
  stays at or under 25%, even the lobs (25% max: a low ball off the glass, parallel).
- **0% continue (never returned)**: the specials (48-200 cells each, at level 4 and 7v4), the smashes and the vibora at 7v4, the dejada / chiquitas /
  volley / bounce shot in 7v4 cells against a badly placed pair, and the **fast bajada at power 9 against a net pair** (Table 3c).
- The **cross** direction is the weakest attack for every shot (for example vibora 5% cross vs 33% parallel at 4v4). The parallel direction is the riskiest
  (+5 pp error from the direction and more from the side-wall edge risk).

### 3b. Where the defenders' position has no effect

| Shot | mean range (pp) | max range (pp) | cells where all 4 set-ups are within 2 pp |
|---|---|---|---|
| chiquita | 17.2 | 88.9 | 276 / 486 |
| lob | 0.0 | 0.0 | 486 / 486 |
| flat | 0.2 | 7.8 | 468 / 486 |
| vibora | 25.4 | 73.5 | 12 / 36 |
| bandeja | 11.5 | 41.9 | 6 / 36 |
| rally_lob | 0.0 | 0.0 | 486 / 486 |
| volley | 11.7 | 57.7 | 74 / 162 |
| bloqueo | 0.9 | 5.9 | 30 / 36 |
| bounce_shot | 11.1 | 50.2 | 96 / 216 |
| contrapared | 10.9 | 52.0 | 16 / 24 |
| rulo | 0.6 | 2.4 | 7 / 9 |
| smash_x3 | 1.5 | 2.7 | 13 / 18 |
| smash_x4 | 1.6 | 3.9 | 12 / 18 |
| bajada_fast | 15.4 | 67.7 | 69 / 108 |
| bajada_slow | 24.8 | 94.1 | 65 / 108 |
| rally_chiquita | 21.5 | 89.7 | 155 / 324 |
| dejada | 23.5 | 83.4 | 23 / 144 |
| sp_skyrocket | 1.5 | 2.5 | 13 / 18 |
| sp_venom | 1.7 | 7.4 | 31 / 36 |
| sp_cornerlock | 2.3 | 9.4 | 22 / 36 |
| sp_freeze | 3.9 | 33.1 | 83 / 144 |

- **No effect at all**: lob and rally lob (0.0 pp; never winners, the reach can only change the pressure), flat, block, rulo,
  smash x3 / x4 and the Sky Rocket (over the fence: no landing spot, reach = 1, so the position is never asked), Venom and
  Corner Lock (the attack is so far above the defence that the reach does not matter).
- **No effect at even levels, a huge one with a stat gap**: both bajadas. At 4v4 and 7v7 they never win whatever the set-up (the
  distance sweep 3d shows 0% at 0 to 4 m), while at 7v4 the same shot goes from 0% (back pair) to 64% (net pair).
- The defender's position matters most for the vibora, the dejada and the chiquitas. For example the vibora at 7v7: from 0% with the
  defender on the spot to 95% with him 4 m away (Table 3d).

### 3c. Bajada Low Speed and Bajada Fast

**F. Ball HIGH off the glass, hitter at the back (W/E/C per defender set-up)**

| Shot | Level | Aim | def back | def mid | def net | def split | reach back/mid/net/split | reply W/E vs net |
|---|---|---|---|---|---|---|---|---|
| bajada_slow | 7v7 | parallel | 0.0/10.7/89.3 | 0.0/10.2/89.8 | 0.0/9.9/90.1 | 0.0/9.3/90.7 | 0.99/0.99/0.85/0.85 | 1.0/3.1 |
| bajada_slow | 7v7 | middle | 0.0/1.0/99.0 | 0.0/0.8/99.2 | 0.0/1.1/98.9 | 0.0/1.1/98.9 | 0.93/0.92/0.79/0.88 | 1.0/3.1 |
| bajada_slow | 7v7 | cross | 0.0/3.2/96.8 | 0.0/2.9/97.1 | 0.0/3.0/97.0 | 0.0/3.1/96.9 | 1.00/1.00/0.89/1.00 | 1.4/3.6 |
| bajada_slow | 7v7 | T:mid-deep | 0.0/1.0/99.0 | 0.0/1.2/98.8 | 2.8/0.9/96.4 | 0.0/0.7/99.3 | 0.92/0.79/0.64/0.89 | 0.6/3.1 |
| bajada_slow | 7v7 | T:mid-nominal | 0.0/1.2/98.8 | 0.0/1.1/98.9 | 0.0/0.9/99.1 | 0.0/0.6/99.4 | 0.90/0.89/0.77/0.87 | 1.0/3.8 |
| bajada_slow | 7v7 | T:corner-deep | 0.0/2.7/97.3 | 0.0/2.1/97.9 | 0.0/2.4/97.6 | 0.0/2.4/97.6 | 1.00/0.88/0.70/1.00 | 1.1/3.2 |
| bajada_slow | 7v4 | parallel | 0.0/10.1/89.8 | 5.1/9.3/85.5 | 77.5/9.5/13.0 | 18.5/8.4/73.1 | 0.98/0.97/0.79/0.79 | 0.0/4.6 |
| bajada_slow | 7v4 | middle | 0.2/1.2/98.6 | 5.0/1.3/93.7 | 66.3/0.8/32.9 | 2.5/1.0/96.5 | 0.89/0.87/0.72/0.83 | 0.0/5.5 |
| bajada_slow | 7v4 | cross | 0.0/3.3/96.7 | 0.0/3.1/96.9 | 44.2/3.9/51.9 | 0.0/3.5/96.5 | 1.00/1.00/0.83/1.00 | 0.0/5.6 |
| bajada_slow | 7v4 | T:mid-deep | 0.0/0.8/99.2 | 26.3/0.9/72.9 | 90.3/1.0/8.7 | 1.2/1.1/97.7 | 0.88/0.73/0.56/0.84 | 0.0/6.9 |
| bajada_slow | 7v4 | T:mid-nominal | 0.2/0.8/99.0 | 7.4/1.1/91.5 | 70.1/0.8/29.1 | 2.7/0.7/96.6 | 0.85/0.84/0.70/0.82 | 0.0/4.7 |
| bajada_slow | 7v4 | T:corner-deep | 0.0/3.0/97.0 | 10.6/2.3/87.0 | 88.5/2.1/9.4 | 0.0/2.3/97.7 | 0.99/0.82/0.62/0.99 | 0.0/5.3 |
| bajada_fast | 7v7 | parallel | 0.0/33.2/66.8 | 0.0/33.8/66.2 | 4.1/34.1/61.8 | 0.0/34.0/66.0 | 0.98/0.86/0.63/0.63 | 0.0/3.4 |
| bajada_fast | 7v7 | middle | 0.0/25.4/74.6 | 0.0/24.2/75.8 | 0.1/23.4/76.5 | 0.0/24.6/75.4 | 0.87/0.76/0.57/0.79 | 0.0/2.8 |
| bajada_fast | 7v7 | cross | 0.0/27.3/72.7 | 0.0/26.4/73.6 | 0.0/27.8/72.2 | 0.0/29.1/70.9 | 1.00/0.92/0.67/1.00 | 0.0/2.6 |
| bajada_fast | 7v7 | T:mid-deep | 0.0/24.8/75.2 | 0.0/26.4/73.6 | 0.0/25.0/75.0 | 0.0/25.5/74.5 | 0.84/0.66/0.55/0.79 | 0.0/4.5 |
| bajada_fast | 7v7 | T:mid-nominal | 0.0/24.0/76.0 | 0.0/25.7/74.3 | 0.1/23.6/76.3 | 0.0/25.0/75.0 | 0.85/0.74/0.57/0.79 | 0.0/3.7 |
| bajada_fast | 7v7 | T:corner-deep | 0.0/26.8/73.2 | 0.0/26.1/73.9 | 1.3/28.4/70.3 | 0.0/27.6/72.4 | 0.98/0.76/0.56/0.98 | 0.0/2.8 |
| bajada_fast | 7v4 | parallel | 0.0/33.7/66.2 | 27.2/32.8/39.9 | 63.9/35.3/0.8 | 47.6/33.7/18.7 | 0.96/0.81/0.56/0.56 | 0.0/4.2 |
| bajada_fast | 7v4 | middle | 0.0/24.6/75.4 | 10.5/24.6/64.9 | 44.0/24.2/31.9 | 1.7/25.1/73.2 | 0.82/0.69/0.55/0.73 | 0.0/5.4 |
| bajada_fast | 7v4 | cross | 0.0/26.4/73.6 | 1.7/27.0/71.3 | 55.6/26.3/18.1 | 0.0/26.8/73.2 | 1.00/0.87/0.59/1.00 | 0.0/4.2 |
| bajada_fast | 7v4 | T:mid-deep | 0.0/26.6/73.4 | 26.3/24.5/49.2 | 41.9/26.6/31.4 | 1.6/26.2/72.2 | 0.78/0.59/0.55/0.72 | 0.0/5.8 |
| bajada_fast | 7v4 | T:mid-nominal | 0.0/23.7/76.3 | 12.8/25.0/62.1 | 42.4/25.1/32.5 | 0.9/24.8/74.3 | 0.79/0.67/0.55/0.72 | 0.0/5.1 |
| bajada_fast | 7v4 | T:corner-deep | 0.0/27.0/73.0 | 22.8/26.6/50.6 | 57.7/28.3/14.1 | 0.0/29.0/71.0 | 0.95/0.69/0.55/0.95 | 0.0/5.7 |

**H. The hitter's power (other attributes 5) against two defender pairs**

| Shot | Defenders | Def set-up | Aim | power 4 | power 5 | power 6 | power 7 | power 8 | power 9 |
|---|---|---|---|---|---|---|---|---|---|
| bajada_slow | all-5 pair | net | middle | 0.0/1.7/98.3 | 0.0/2.2/97.8 | 1.5/2.1/96.4 | 20.4/1.6/78.0 | 58.6/2.3/39.1 | 88.1/1.9/10.0 |
| bajada_slow | all-5 pair | net | cross | 0.0/5.1/94.9 | 0.0/4.8/95.2 | 0.0/5.3/94.7 | 5.5/5.0/89.5 | 35.4/4.7/59.8 | 77.4/5.1/17.5 |
| bajada_slow | all-5 pair | net | T:mid-deep | 0.0/3.4/96.6 | 2.6/3.4/94.0 | 22.5/3.4/74.0 | 61.7/3.5/34.8 | 89.7/3.2/7.2 | 96.7/3.3/0.1 |
| bajada_slow | all-5 pair | net | T:mid-nominal | 0.0/2.2/97.8 | 0.0/2.1/97.9 | 3.7/2.0/94.2 | 25.4/1.8/72.8 | 63.7/2.4/33.9 | 90.6/1.8/7.7 |
| bajada_slow | all-5 pair | back | middle | 0.0/1.9/98.1 | 0.0/2.4/97.6 | 0.0/1.6/98.4 | 0.0/2.3/97.7 | 0.0/1.9/98.1 | 0.9/1.9/97.2 |
| bajada_slow | all-5 pair | back | cross | 0.0/4.9/95.1 | 0.0/5.9/94.1 | 0.0/5.2/94.8 | 0.0/5.2/94.8 | 0.0/4.9/95.1 | 0.0/5.0/95.0 |
| bajada_slow | all-5 pair | back | T:mid-deep | 0.0/3.4/96.6 | 0.0/3.5/96.5 | 0.0/2.8/97.2 | 0.0/3.0/97.0 | 0.0/2.9/97.1 | 0.4/2.9/96.8 |
| bajada_slow | all-5 pair | back | T:mid-nominal | 0.0/2.2/97.8 | 0.0/2.4/97.6 | 0.0/1.5/98.5 | 0.0/1.8/98.2 | 0.0/1.8/98.2 | 1.6/1.7/96.7 |
| bajada_slow | all-5 pair | split | middle | 0.0/1.9/98.1 | 0.0/2.4/97.6 | 0.0/1.6/98.4 | 0.0/2.3/97.7 | 0.2/1.6/98.2 | 7.3/2.0/90.7 |
| bajada_slow | all-5 pair | split | cross | 0.0/4.9/95.1 | 0.0/5.9/94.1 | 0.0/5.2/94.8 | 0.0/5.2/94.8 | 0.0/4.9/95.1 | 0.0/5.0/95.0 |
| bajada_slow | all-5 pair | split | T:mid-deep | 0.0/3.4/96.6 | 0.0/3.5/96.5 | 0.0/2.8/97.2 | 0.0/3.0/97.0 | 0.0/2.9/97.1 | 4.6/3.5/91.9 |
| bajada_slow | all-5 pair | split | T:mid-nominal | 0.0/2.2/97.8 | 0.0/2.4/97.6 | 0.0/1.5/98.5 | 0.0/1.8/98.2 | 0.1/1.9/98.0 | 6.6/2.2/91.2 |
| bajada_slow | Bruno+Ines (default CPU) | net | middle | 0.0/1.8/98.2 | 0.0/2.2/97.8 | 0.2/2.2/97.6 | 8.9/1.7/89.3 | 38.2/1.8/60.0 | 74.2/1.7/24.1 |
| bajada_slow | Bruno+Ines (default CPU) | net | cross | 0.0/5.1/94.9 | 0.0/4.8/95.2 | 0.0/5.3/94.7 | 0.0/5.2/94.8 | 7.7/5.9/86.3 | 39.5/4.8/55.8 |
| bajada_slow | Bruno+Ines (default CPU) | net | T:mid-deep | 0.0/3.6/96.4 | 0.4/3.8/95.8 | 11.0/3.6/85.4 | 43.3/3.4/53.3 | 77.0/4.1/18.9 | 93.9/3.7/2.4 |
| bajada_slow | Bruno+Ines (default CPU) | net | T:mid-nominal | 0.0/2.2/97.8 | 0.0/2.0/98.0 | 0.6/2.3/97.0 | 11.4/2.0/86.6 | 41.3/2.4/56.3 | 78.2/1.8/20.0 |
| bajada_fast | all-5 pair | net | middle | 0.0/25.7/74.3 | 0.0/26.0/74.0 | 0.3/25.8/73.9 | 20.4/25.2/54.4 | 59.0/25.9/15.1 | 71.7/28.3/0.0 |
| bajada_fast | all-5 pair | net | cross | 0.0/30.1/69.9 | 0.0/29.8/70.2 | 0.2/29.3/70.5 | 22.3/29.7/47.9 | 62.7/28.0/9.3 | 67.8/32.2/0.0 |
| bajada_fast | all-5 pair | net | T:mid-deep | 0.0/31.1/68.9 | 0.0/30.7/69.3 | 0.2/31.3/68.6 | 18.7/31.8/49.5 | 57.3/30.1/12.6 | 69.6/30.4/0.0 |
| bajada_fast | all-5 pair | net | T:mid-nominal | 0.0/26.7/73.3 | 0.0/25.7/74.3 | 0.3/26.2/73.4 | 19.0/25.7/55.3 | 58.1/26.3/15.7 | 74.2/25.4/0.3 |
| bajada_fast | all-5 pair | back | middle | 0.0/25.1/74.9 | 0.0/25.4/74.6 | 0.0/27.1/72.9 | 0.0/25.6/74.4 | 0.0/26.1/73.9 | 2.1/27.6/70.3 |
| bajada_fast | all-5 pair | back | cross | 0.0/30.3/69.7 | 0.0/29.2/70.8 | 0.0/29.7/70.3 | 0.0/28.7/71.3 | 0.0/29.5/70.5 | 0.0/29.8/70.2 |
| bajada_fast | all-5 pair | back | T:mid-deep | 0.0/30.9/69.1 | 0.0/29.4/70.6 | 0.0/30.3/69.7 | 0.0/31.4/68.6 | 0.0/31.9/68.1 | 2.9/31.7/65.4 |
| bajada_fast | all-5 pair | back | T:mid-nominal | 0.0/26.0/74.0 | 0.0/24.9/75.1 | 0.0/25.1/74.9 | 0.0/26.3/73.7 | 0.0/26.5/73.4 | 3.1/26.1/70.8 |
| bajada_fast | all-5 pair | split | middle | 0.0/25.1/74.9 | 0.0/25.4/74.6 | 0.0/27.1/72.9 | 0.0/25.6/74.4 | 3.1/25.8/71.0 | 16.3/28.4/55.3 |
| bajada_fast | all-5 pair | split | cross | 0.0/30.3/69.7 | 0.0/29.2/70.8 | 0.0/29.7/70.3 | 0.0/28.7/71.3 | 0.0/29.5/70.5 | 0.0/29.8/70.2 |
| bajada_fast | all-5 pair | split | T:mid-deep | 0.0/30.9/69.1 | 0.0/29.4/70.6 | 0.0/30.3/69.7 | 0.0/31.4/68.6 | 1.5/30.7/67.8 | 15.2/31.3/53.5 |
| bajada_fast | all-5 pair | split | T:mid-nominal | 0.0/26.0/74.0 | 0.0/24.9/75.1 | 0.0/25.1/74.9 | 0.0/26.3/73.7 | 1.5/25.9/72.6 | 14.8/26.1/59.1 |
| bajada_fast | Bruno+Ines (default CPU) | net | middle | 0.0/25.4/74.6 | 0.0/26.3/73.7 | 0.0/26.4/73.6 | 11.1/24.9/64.1 | 49.1/26.4/24.5 | 70.5/28.2/1.3 |
| bajada_fast | Bruno+Ines (default CPU) | net | cross | 0.0/30.1/69.9 | 0.0/29.8/70.2 | 0.0/29.2/70.8 | 5.3/28.3/66.4 | 42.4/29.1/28.5 | 67.3/31.6/1.1 |
| bajada_fast | Bruno+Ines (default CPU) | net | T:mid-deep | 0.0/30.8/69.2 | 0.0/31.1/68.9 | 0.0/32.0/68.0 | 10.7/31.0/58.3 | 47.1/31.3/21.6 | 68.1/31.1/0.8 |
| bajada_fast | Bruno+Ines (default CPU) | net | T:mid-nominal | 0.0/26.8/73.2 | 0.0/25.7/74.3 | 0.0/26.5/73.5 | 10.5/27.8/61.6 | 47.8/25.9/26.3 | 72.1/25.9/1.9 |

**I. The reach the defenders keep against a bajada (1 = full defence; the floor is 0.55)**

| Landing spot | bajada_slow: def net | def mid | def back | bajada_fast: def net | def mid | def back |
|---|---|---|---|---|---|---|
| middle, nominal depth | 0.70 | 0.83 | 0.84 | 0.55 | 0.65 | 0.75 |
| middle, deep (8.8 m) | 0.56 | 0.73 | 0.86 | 0.55 | 0.57 | 0.75 |
| at the right defender (x 2.5), nominal | 0.86 | 1.00 | 1.00 | 0.62 | 0.90 | 1.00 |
| at the right defender (x 2.5), deep 8.8 | 0.67 | 0.87 | 1.00 | 0.55 | 0.76 | 1.00 |
| right corner deep (3.6, 8.8) | 0.65 | 0.84 | 1.00 | 0.55 | 0.72 | 0.98 |
| short, at the net player (2.5, 2.5) | 1.00 | 1.00 | 0.75 | 1.00 | 0.99 | 0.64 |

What this shows:
- With equal stats neither bajada ever wins. With a power edge **only a pair at the net** loses to it, and then very quickly:
  power 7 is enough for the low-speed bajada to the middle deep spot (69% winners against all-5 defenders), and with power 8, 7 balls
  in 10 are not returned against the default CPU pair.
- The "deep to the glass" and "middle" aims are the worst for the defenders at the net. A ball to the middle gets the `hesitation`
  0.88 of the middle direction, and the deeper the bounce, the lower the reach (0.56 at 8.8 m against 0.70 at the nominal 6.2 m),
  although the defenders' real task (volleying the ball as it passes them at the net) does not get harder.
- The same bajada against a pair at the back never wins: their defence is x1.25 (`REBOUND_POSITION.back`) and the ball lands
  next to them (reach 0.84-1.0).
- The low-speed bajada's continue is not a hard ball for the reply. Mean pressure after it is 0.003-0.04, and the defender's next shot ends
  0-2% winner / 0-10% error, the base rates. So "practically never returned" is decided entirely by the winner roll at the bajada itself.

### 3d. Distance sweep: the receiving defender d m to the side of the tapped spot (level 7v7)

| Shot | Level | Def formation | Spot | d=0 m W/E/C | d=1 m W/E/C | d=2 m W/E/C | d=3 m W/E/C | d=4 m W/E/C |
|---|---|---|---|---|---|---|---|---|
| bajada_slow | 7v7 | back | mid-deep | 0.0/1.1/98.9 | 0.0/1.4/98.6 | 0.0/1.1/98.9 | 0.0/1.0/99.0 | 0.0/1.1/98.9 |
| bajada_slow | 7v7 | back | mid-nominal | 0.0/1.4/98.6 | 0.0/0.9/99.1 | 0.0/0.8/99.2 | 0.0/1.0/99.0 | 0.0/0.9/99.1 |
| bajada_slow | 7v7 | net | mid-deep | 0.0/1.1/98.9 | 0.0/1.4/98.6 | 0.0/1.1/98.9 | 0.0/1.0/99.0 | 0.1/1.1/98.8 |
| bajada_slow | 7v7 | net | mid-nominal | 0.0/1.4/98.6 | 0.0/0.9/99.1 | 0.0/0.8/99.2 | 0.0/1.0/99.0 | 0.7/0.8/98.5 |
| bajada_fast | 7v7 | back | mid-deep | 0.0/25.5/74.5 | 0.0/26.4/73.6 | 0.0/25.6/74.4 | 0.0/26.3/73.7 | 0.0/25.6/74.4 |
| bajada_fast | 7v7 | back | mid-nominal | 0.0/24.9/75.1 | 0.0/24.3/75.7 | 0.0/24.0/76.0 | 0.0/24.9/75.1 | 0.0/24.8/75.2 |
| bajada_fast | 7v7 | net | mid-deep | 0.0/25.5/74.5 | 0.0/26.4/73.6 | 0.0/25.6/74.4 | 0.0/26.3/73.7 | 0.0/25.6/74.4 |
| bajada_fast | 7v7 | net | mid-nominal | 0.0/24.9/75.1 | 0.0/24.3/75.7 | 0.0/24.0/76.0 | 0.0/24.9/75.1 | 0.1/24.8/75.1 |
| vibora | 7v7 | back | mid-deep | 17.2/3.7/79.0 | 18.3/4.6/77.1 | 43.3/4.9/51.7 | 83.5/4.6/11.9 | 94.6/4.9/0.4 |
| vibora | 7v7 | back | mid-nominal | 17.2/5.2/77.6 | 18.7/4.4/76.9 | 51.1/4.4/44.6 | 88.1/5.3/6.6 | 96.0/4.0/0.0 |
| vibora | 7v7 | net | mid-deep | 0.0/4.1/95.9 | 0.1/4.1/95.8 | 5.6/4.4/90.1 | 44.8/5.1/50.1 | 86.1/4.9/9.0 |
| vibora | 7v7 | net | mid-nominal | 0.0/4.5/95.5 | 0.0/4.5/95.5 | 10.0/4.1/85.9 | 60.1/3.6/36.3 | 92.8/4.4/2.8 |
| bandeja | 7v7 | back | mid-deep | 0.0/1.7/98.3 | 0.0/1.0/99.0 | 0.0/0.9/99.1 | 7.6/1.2/91.3 | 40.1/0.7/59.2 |
| bandeja | 7v7 | back | mid-nominal | 0.0/0.9/99.1 | 0.0/1.0/99.0 | 0.1/0.9/99.0 | 10.3/0.7/89.0 | 47.9/0.9/51.2 |
| bandeja | 7v7 | net | mid-deep | 0.0/1.7/98.3 | 0.0/1.0/99.0 | 0.0/0.9/99.1 | 0.1/0.8/99.1 | 8.6/1.4/90.0 |
| bandeja | 7v7 | net | mid-nominal | 0.0/0.9/99.1 | 0.0/1.0/99.0 | 0.0/0.9/99.1 | 0.2/1.0/98.8 | 14.6/0.7/84.7 |

The vibora reacts to the distance as expected; the bandeja only from 3-4 m. Both bajadas do not react at all at even levels: the defence is so
far above the attack that the reach factor never matters.

## 4. Method: how the engine decides winner / error / continue

Everything happens in `stepHit` (`src/game/point.ts:628`), which calls `resolveHit` (`src/game/engine.ts:159`) once per shot.

1. **Who defends, where the ball goes** (`point.ts:649-657`): the direction gives a target defender (`defenderIndex`), the aim is one of
   10 points across the direction (`aimX`, `court.ts:50`) or a tapped spot rolled with an accuracy spread (`targetLanding`,
   `court.ts:103`). The player on the side of the centre line where the ball lands defends it. Smashes that go over the fence and the rulo have **no
   landing spot** (`fixedAim`, `point.ts:651`).
2. **Error roll first** (`engine.ts:166-170`): `errorChance` (`engine.ts:72-76`) = shot.risk + direction.risk (parallel 0.05, cross
   0.02, middle 0) + rally fatigue (after hit 6, +0.02 per hit) + side-wall edge risk (|x| > 2.4 m) - 0.008 x technique + 0.15 per missing
   guts point (+ `lowGlassRisk` for a lob off a low glass ball), times the timing factor, + 0.08 for a CPU/AUTO special. Clamped 1-60%.
   **If this roll fails the shot is an error, whatever the defender does.** Neither pressure nor defender nor reach enters it.
   A tapped spot that falls off the court is also an error (`point.ts:684`).
3. **Duel** (`engine.ts:172-187`):
   - attack = stat x 10 x shot.power x direction.attack (parallel 1.1, cross 1.0, middle 0.9) x height fit x (1 - incoming pressure)
     + U(0, 20), times the timing factor (human ring only);
   - defence = `defenseRating` (`engine.ts:59-65`): (7 x defence + 3 x speed) x 1.3; for shots with `reboundChase` (bajadas)
     (4 x defence + 8 x speed) x 1.3 x `REBOUND_POSITION` {back 1.25, mid 1.0, net 0.75} (`engine.ts:51`); for drop shots
     (3 x defence + 7 x speed) x 1.3 x `DROP_POSITION` {back 0.75, mid 0.95, net 1.2}; x 0.88 for a middle ball; x `AIR_DEFENSE`
     1.2 (net) / 1.12 (mid) when the defender takes it out of the air (`netVolley` / `airTake`, `point.ts:555-591`, passed at
     `point.ts:668-669`); **x reach**; + U(0, 20).
   - **winner** if attack - defence > margin (`WINNER_MARGIN` 24 or the shot's `winnerMargin`: vibora 24, bajada slow 26, bajada fast
     62, flat 60, smash x3 8, x4 20, specials 6-8), never for a lob (apex >= 3 m, `engine.ts:186-187`);
   - otherwise **continue**, with pressure = clamp(diff / 200, 0, 0.25) on the next hitter (`engine.ts:189`).
4. **Reach: where the defenders' position enters** (`reachAgainst`, `point.ts:24-35`, called at `point.ts:675-678`): for each defender
   the gap to the **nominal landing spot** (x of the aim point, depth = the shot's `landDepth`, the CPU's preferred depth or the tapped
   depth) is `reachGap` = hypot(dx, 0.6 x dz) (`court.ts:201`). His radius is 2.2 + 0.14 x speed (`court.ts:172`) times a flight-time
   factor 0.8-1.3 (`court.ts:179-190`; the hitter's distance / ball speed, 16 m assumed without positions). `reachFactor` (`court.ts:195-198`):
   full defence within 0.5 radius, then linearly down to 0.55 at 1.5 radii (0.75 floor for lobs); the better of the two defenders counts.
   Positions: the scene passes the real ones (`MatchScene.ts:2401`); simulations use the formation spots (`restPos`, `court.ts:154`:
   z 2 m from the net at the net, 4.5 m mid, 7.5 m back; x +/-2.5).
   - **Inconsistency behind the bajada complaint:** a defender at the net who volleys the ball (`netVolley` true, the scene sets
     `block`, `point.ts:748-757`, and shows him playing it in front of the net) still has his reach measured to the **bounce spot**
     6-9 m from the net, 4-7 m behind him, and for `reboundChase` shots he also gets `REBOUND_POSITION.net` 0.75, as if he had to
     chase the glass rebound. The volley bonus 1.2 gives back only part of that.
5. **After the roll** (`point.ts:688-746`): a special that would win can be answered (`specialAnswerChance`, `point.ts:294-298`:
   0.05 x (defence + speed - 8), max 0.4, so 0 at level 4 and 0.3 at level 7) and continues with pressure 0.25. A continuing hard ball
   (>= 22 m/s) that comes off the glass with a lead > 0.8 x margin becomes a winner off the glass (`point.ts:717-733`). A Por Cuatro can
   be fumbled before the glass (35% try, 62% - 4% x technique fail, `point.ts:740-746`).
6. **Serve** (`resolveServe`, `engine.ts:209-240`): fault roll from risk - 0.008 x technique (x0.75 on the second serve). The ace needs
   attack - defence > 48 (56 for the hard glass serve), which explains the ~0% aces.

**Why a small stat gap is decisive:** for a given shot, diff = L_att x (10 x power x dir x fit) - L_def x (1.3 x weights x place x air
x reach) + (U1 - U2), with U1 - U2 a triangle on +/-20. One stat point moves the attack by about 9-15 points and the defence by
8-13 x reach, so 2-3 points of gap move the mean diff by 20-40 points: the whole width of the random spread. That is also why
winners grow with the level at equal stats (attack coefficients are larger than defence x reach coefficients, while the margins stay fixed).

**Measurement details.** Seeded `mulberry32` (`seededRng`), one seed per cell. Matrix: 3,000 trials per cell, guts full, rally hit 3
(no fatigue), hitter = left-hand player of the near pair; the ball carries the extras some shots require (speed 25 m/s for the block,
`nearWall`, zone mid, a weak lob for a high ball out of the air). The engine keeps one formation per pair, so the "split" set-up uses
the real split positions for the reach and formation 'back' for the rules. "Within reach" in Part 1 = `reachAgainst` >= 0.999 at the
step's landing x and the nominal depth the engine used, from the formation spots. Specials in Part 1: `withSpecial` (the default teams
get Sky Rocket and Corner Lock, the 7-rated pairs Sky Rocket; nobody had Venom or Freeze in matches, so for those see the matrix).
Run-outs after a Por Tres are not simulated (`simCore` never runs out).
