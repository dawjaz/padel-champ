# Handoff

_Last updated: 2026-11-20 (v0.27)_

## v0.27: rulo
- Rulo flies slow and in a high parabola with topspin: speed 25 -> 15, apex 1.2 -> 2.6, spin 1.6 -> 1.8 (peak about 3.9 m, flight about 1.3 s to the bounce). The hitter plays it overhead (smash stance) with the body turned sideways towards the fence it is played to (`swing(id, shot, aimDx)`; profile facing, there is no three-quarter view in the sprites).

## v0.26: vibora
- Vibora playable on a **mid or high** ball (never low, never off the glass): `requires.heights` ['mid','high']. In Free Practice the `*` shots (not normally playable) stay available on purpose.
- Flatter and cut: speed 23 -> 27, backspin -0.5 -> -0.2, new `flight.bounceMul` 0.75 (floor bounce height only, speed along the court kept) and `flight.reboundMul` 0.6 (rebound height off the back glass). First-bounce height from the baseline 1.36 -> about 0.8 m; the ball still reaches the glass. `deaden` (speed + bounce) would have stopped it short of the glass, hence the separate knobs.

## v0.25: fewer winners against defenders who volley
- A defender who takes the ball out of the air (net volley or mid-court `airTake`) now defends `AIR_DEFENSE` better (engine.ts: net x1.2, mid x1.12; `HitInput.airTake`). Flat return cross from the net at a mid-court pair: winners 44% -> 15% (net pair: 4%); vs a back pair unchanged (44%). CPU-vs-CPU rallies are longer (avg hits 4.9 -> 5.9). Tune the two multipliers.

## v0.24: more air balls, lob from the net
- **Air take** (`airTake`, point.ts): a defender in mid-court plays a ball that lands no deeper than `AIR_TAKE_DEPTH` 7 m from the net out of the air (not lobs, rulo, serves) at `airDist` 2.2 to 4.2 m from the net, as a volley (reuses `block`; `buildFlight({airDist})`). Net defenders already volleyed everything. The rest of the court (deep balls) still bounces. Tune: `AIR_TAKE_DEPTH`, the 0.6 factor.
- Lob (`rally_lob`) is now offered from the net too (the formation restriction is gone).

## v0.23: tuning from Free Practice (owner's notes)
- Chiquita (both variants): speed 9 -> 7.5, spin -0.9 -> -0.55 (flatter), new `flight.deaden` 0.72 (multiplies floor bounce height and kept speed; generic knob for any shot). First-bounce height about halved (1.0 -> 0.46 m from the baseline).

## v0.22: rebound winner, Free Practice
- **Rebound back over the net** (`stepHit`, point.ts): a hard shot (flight speed >= `REBOUND_BACK_SPEED` 22, not a lob/rulo) that comes off the glass (`next.glass`) and beats the defence by >= half the winner margin ends the point for the hitter (`step.reboundBack`, outcome 'winner'). `buildFlight({reboundBack})`: after the first back-wall contact the ball flies on in a new arc and lands in the hitter's own half (nobody touches it). CPU-vs-CPU: about 5% of points.
- **Free Practice** (title menu: ATTACKING / DEFENDING; `MatchScene` with `scene.start('MatchScene', {practice})`): ATTACKING = you pick any shot (also ones the ball does not allow, marked `*`) and direction, SETUP sets ball height, off-glass, both teams' positions and RESULT (auto, continue, winner, error, intercept, rebound); DEFENDING = you pick the shot the opponents play at you (serves too), then return it with the normal menu. After every exercise the menu comes back, guts refilled. `stepHit(..., options: HitOptions)` has `force` and `ignoreRequires`. Not unit-testable (scene), checked in CI build only: play it on the phone.

## v0.21: real impact sounds, Por Tres lands halfway
- **Sounds** cut from the owner's recording (Freesound #345759 by "refrain", **licence not confirmed yet: ask the owner / check the page before any store release**) with `tools/cut_sounds.py` (`python3 tools/cut_sounds.py IN.wav OUTDIR`): ball clicks are found in the 4-14 kHz band, denoised (spectral subtraction, moderate: the hall is noisy), trimmed, 32 kHz mono WAV. 38 clips in `public/assets/audio/sfx/` with `manifest.json`: racket_strong/soft/spin/serve, floor, glass, mesh (net stays synthesised).
- The classification is an automatic spectral heuristic, **not verified by ear**. `/sounds.html` is an audition page; fix wrong clips by moving the name between lists in manifest.json.
- `src/sfxKind.ts` (`racketKind`, tested) maps shot to racket recording (serve; soft: chiquita, lobs, bandeja, bajada_slow; spin: vibora, spin_glass, rulo, bounce_shot, bajada_fast; smashes strong; others by speed). A kind without files falls back to the synthesised racket. Samples now pitch only +-4% with power.
- **Por Tres** first bounce prefers 1.5 m from the back glass (`POR_TRES_UB`; results 1.2 to 2.5 m depending on the geometry); non-winning smash_x3 `landDepth` 8.5.

## v0.20: hitters look for gaps, volley at the net, pace by ball height
- **Gap seeking** (`pickHit(teams, state, rng, opp)` in ai.ts; CPU and the human's partner only, the human still chooses): `opp` are the
  opponents' real positions (`MatchScene.hitTurn`). The hitter scores each direction by its distance from both opponents (`gapX`), prefers
  lobs against two net players and chiquitas against two players at the back, and returns an `AimPreference` (x and depth) that `stepHit`
  uses to choose among the 10 x aim points and 20 depths (`aimX`/`aimDepth` `prefer`, kept with probability `AIM_SKILL` 0.75).
- **Net player volleys** (`netVolley` in point.ts): a defender at the net takes every reachable ball out of the air (not lobs, smashes,
  rulo): `step.block`, the ball is MID (fast shot) or LOW (soft shot) and he stays at the net. `blockAtNet` in shots.json is now unused.
  CPU-vs-CPU: volley share of shots 21% -> 36%, avg 5.4 hits, server wins 53%.
- **Flat shot is not offered at the net** (`requires.formations` mid/back); the volley is.
- **Pace** (`src/game/pace.ts`, `paceFactor`, passed to `buildFlight` as `speedMul`, speed capped at 35 m/s): LOW ball = 15% slower; MID/HIGH =
  +8% / +15% when the hitter is not under pressure; a volley on a slow incoming ball (`BallState.speed`, <= 14 m/s) gets up to +30%, on a fast
  one (>= 20 m/s) no change. Serves, lobs, chiquitas and the rulo are unchanged. The pace is visual (flight); win/lose is still `engine.ts`.
- Tests: pace.test.ts, and new suites in point.test.ts (net volley, flat shot hidden at the net, CPU gap seeking).

## v0.19: bajada stance, both defenders move, Por Tres flight
- **Bajada / ball off the back glass**: no more turning to the glass. The player keeps his face to the net, stands `REBOUND_BEHIND_BALL`
  (0.55 m) behind the ball (`standingSpot(..., behindBall)`) and plays a forehand/backhand from the side (ball at about 1-2 o'clock),
  never the overhead pose (`MatchScene.playStep`, the old `rebound` facing set is gone).
- **Both defenders move** after every hit: the partner slides 55% of the way towards the ball, keeps at least 1.8 m from his partner,
  drops back or comes forward (60% of the defender's depth change) and takes a small step if he would not move at all. The hitting pair
  shifts together towards the side the ball was sent to (25% of landX, max 1.2 m).
- **Por Tres, winning version** (`scriptedSideExit` in ballPath.ts): medium-hard topspin ball (25 m/s) into the court near the end line,
  floor bounce, back glass, then over the top of the side wall. Built from three ballistic legs with the contact rules of the simulation
  (each surface cuts speed: tested), the aim point is searched so that the ball really clears the wall; falls back to the old simulation
  if no aim works. New shot fields: `winLandDepth` (unused by the script, kept for the simulation fallback), `wallKick` 1.0, side spin 1.1.
  A non-winning Por Tres is unchanged (stays in play off glass/mesh).
- Side spin now kicks the ball along the back glass (against the way it bends in the air).
- Sound: see docs/ASSETS.md; the game plays real files as soon as they are in `public/assets/audio/sfx/` and listed in `manifest.json`.

## v0.18: glass rebounds, stronger spin curvature, smaller ball, faster hits, no captions
- **No caption above the buttons** (`showButtons` ignores its `title`; the golden-point question is still said in the message line).
- **Glass rebound** (`ballPath.ts`): `glassNormalE` (the faster the ball arrives the more it loses along the normal: 0.76 -> ~0.55), `wallVertical`
  (friction + spin kick: topspin kicks UP off a wall, backspin pushes down; limited by `GLASS_MU` and `SPIN_SURFACE`). Spin turns over at
  every wall (`lift *= -0.7`). The rebound class (low/mid/high) now **tilts the physical rebound instead of inventing speed**: the ball keeps the
  speed the contact left it with and leaves at most ~44 degrees steep (`0.7 * total`), so a hard flat ball comes off fast at an angle.
- **Spin curvature**: `MAGNUS_LIFT` 9, `MAGNUS_SIDE` 9, and the Magnus force now also acts AFTER the first bounce (spin fades 30%/s, a floor
  bounce keeps 60%). Spin/side values in shots.json raised (e.g. vibora side 1.3, bandeja -1.1, rulo 1.6, bajada_fast 0.9, bajada_slow -0.9).
- Winning smashes must leave over the receiving half (they used to be able to come back past the net).
- **Ball** drawn ~25% smaller (`p.scale * 0.3`, min 6 px). **Hit pauses halved**: `CPU_DELAY` 112 ms, `NEXT_HIT_DELAY` 175 ms (CPU hits 87 ms).
- Tests: new "glass rebound physics" and "spin curvature" suites. Research notes: pros hit smashes at 80+ km/h and control shots at 40-60 km/h;
  the glass studies found were not detailed enough to take constants from, so the contact model uses textbook friction/spin physics, tuned by eye.
  Owner should play-test: does the ball feel natural off the back glass? Tune `GLASS_MU`, `SPIN_SURFACE`, `MAGNUS_*`.

## v0.17: golden point, the receiving pair chooses
- At 40-40 the **receiving pair chooses who receives**, which sets the serving lane (the serve is always cross; partners keep their halves).
  `serveLane` / `serveSetup` / `startPoint` take an optional `receiverChoice` (receiver index). `MatchScene.beginPoint` shows a
  "who receives?" menu when the human pair receives; `pickGoldenReceiver` (ai.ts) decides for the CPU (weights: defense x7 + speed x3).
- Tests added in court.test.ts and point.test.ts. Checked locally only as far as the sandbox allows: game files typecheck and the new
  logic was run in a node script; `MatchScene` and vitest are checked by CI. **Play a golden point on a phone** (30-30 -> 40-40).
- Owner plans to play-test and then rework shot types and shot mechanics.

## Owner decisions, 2026-11-20
Defence stays automatic; the receiving pair picks the side at the golden point (done in v0.17); partners keep their halves on serve
(confirmed); three.js 3D prototype later, as a separate branch. **Current focus: deepen the match mechanics** (no new art
direction, no Capacitor yet). See DECISIONS.md.

## v0.16: bajada can be run down, smaller characters
- **Bajada rebound** (`ShotDef.reboundChase`): the defender's rating counts speed more (4 defence + 8 speed) and his position
  (`REBOUND_POSITION`: back 1.25, mid 1.0, net 0.75). A fast player at the back can return a bajada; a player at the net hardly can.
- Characters shrunk from 2.0 to 1.75 m on screen (`VISUAL_HEIGHT_M` in MatchScene): the scale was physically right for a 10x20 m court,
  but the comic big head and the wide racket sprite made players fill too much of it. Change the constant to taste.
- Checked: vibora and bandeja are never offered after the back glass (`requires.glass: false`) and a flight with `glass: false` never touches
  the back glass before the hit (swept over 1,680 random flights).

## v0.15: ball height banner, lob/net rules, rulo stays in court, sound samples
- **Height banner**: big HIGH (green) / MID (blue) / LOW (yellow) BALL text in the lower court while the human chooses a shot.
- **Lob**: 85% deep from a high or mid ball (70% from a low one); not offered at the net (`requires.formations`).
- **Volley** gets `flight.netBoost` 0.3: +30% speed right at the net (within 2 m, none from 4.5 m) and a lower net clearance there.
- **Rulo winner** no longer climbs out of the court: it comes off the mesh unpredictably and the free ball stays inside the court.
- **Sounds**: `audio.ts` now plays real recordings listed in `public/assets/audio/sfx/manifest.json` and falls back to the synthesis.
  **No recordings are in the repo yet**: the sandbox has no internet access to download any. Drop CC0 files in and fill the manifest
  (see docs/ASSETS.md).

## v0.14: Magnus flight, bajada speeds, lost-ball variety, nearest partner, ball never stops
- **Magnus effect** (`magnus()` in ballPath): topspin raises the effective gravity (steeper dip), backspin lowers it (float), side spin bows the
  flight sideways, the aim point stays the same. Constants `MAGNUS_LIFT`, `MAGNUS_SIDE` (stronger than reality on purpose, as asked).
  Rotation on screen doubled (`SPIN_RATE` 52, flat shots turn too).
- **Bajada** split in `bajada_fast` (33 m/s, topspin, risk 0.3, mistakes go into the net or the back glass: out) and `bajada_slow` (15 m/s,
  backspin + side spin, always off the back glass, 85% low rebound). Menu buttons use `menuLabel`.
- **Lost balls** (`errorKind`): net / back glass without bounce (out) / mesh above the glass (out), weights per shot (`errorKinds`).
  Also for serve faults. The contact itself is played by the free-flight (`buildCoast`).
- **Who plays the ball**: the aim x is rolled first and the player on that side of the court takes it (partner closer to the ball).
- **The ball is never stopped** after a point: it rolls out (outside ground is softer) and the next serve ball is put down only afterwards.

## v0.13: win banner, padel sounds, rulo rule, side views, chasing
- **Point banner**: WINNER / ACE / ERROR plus a yellow chip with the shot name (e.g. "Por Cuatro"), a camera flash and shock rings.
- **Sounds** (`audio.ts` `impactSound(kind, power)`): synthesised racket, floor, glass, mesh and net. Power comes from the ball speed at the
  contact (`speedAt` in ballPath): a smash cracks, a chiquita is a dull pop, a soft bounce is quiet.
- **Rulo** needs `glass: false` and the new `zones: ['mid']`: only from the air, on a ball that falls in the middle of the court
  (`BallState.zone`, set from the landing depth: <3.5 m net, <7 m mid, else back).
- **Serve to the side glass**: the receiver takes it after the side glass, before the back glass.
- **Losing defender** runs for the ball to the end (to the hit spot, then after the rolling ball: `chaseBall`).
- **Facing**: new profile views `'left'` / `'right'` (`buildProfile` in character.ts, 12 poses). Players run in profile, and a player who
  waits for a ball off the back glass turns to the glass, then hits side-on (`MatchScene.rebound`).

## v0.12: visible ball spin, blocks at the net, overhead on weak lobs
- **Ball rotation** (`src/art/spin.ts`, `ballHd.drawBall`): the ball is drawn each frame with a band, a seam and two dots, turning with
  its angular velocity. `FlightDef.spin` = top/back spin, new `FlightDef.side` = side spin (vibora 1.0, spin glass 1.0, rulo 0.8,
  smash x3 0.5, t-serve 0.5, bandeja 0.4, ...). The vector is fixed in the world at the hit, so topspin turns into backspin after a
  rebound off the back glass. Values are an estimate from real shots: slice/backspin for serve, volley, bandeja, chiquita; heavy
  top+side for rulo; side+back for vibora; flat/topspin for bajada and smashes.
- **Block**: shots with `blockAtNet` (flat shot, flat return, vibora, bandeja, bajada) are blocked out of the air by a defender at the
  net (`Step.block`; next ball is mid, off no glass; the defender holds the volley pose).
- **Weak lob**: the defender takes it out of the air at about 2 m (`airHit`), so Smash/Vibora/Bandeja are played before a bounce.
- **Chiquita** lands 1.1-2.1 m behind the net (`landDepth` 1.6, `depthSpread` 0.5). Bounce shot is now called **Flat shot**.

## v0.11: net play, partner movement, backhand, aim points
- **Net fight** (`nextFormation`): after a lob the hitter goes to the net (weak lob: mid-court); after other shots from the back to
  mid-court; from mid-court to the net when the opponents are back. Net shots keep the net.
- **Partner** follows the player who runs for the ball: half of the depth change, 30% of the sideways move (`MatchScene.playStep`).
- **Backhand poses** redrawn: racket arm across the chest, racket out on the far side, other hand on the throat, follow-through up and out.
- **Aim points** (`aimX`, `aimDepth` in court.ts): 10 random x points per direction, 20 random depths around the shot's usual depth
  (not for rulo/smashes that leave the court). Values arrive in `Step.landX` / `Step.landDepth`.
- CPU shots start half as late (`CPU_DELAY`, `CPU_NEXT_HIT_DELAY`).

## v0.10: rules rework, free ball, slower pace
- **Ball state** (`BallState`): height, pressure, `lob` (`'deep' | 'weak'`) and `glass` (the ball is played after it came off the back glass).
- **Lob** is random: 70% good (deep), 30% weak (lands 2.5-5.5 m past the net, `weakDepth` in shots.json). A weak lob does not push
  the opponents back: players at the net stay there, the others come to mid-court.
- **Back glass**: shots with `glassChance` can reach it; the rebound is low/mid/high (`rebound` weights per shot). The flight
  steers the rebound peak (`REBOUND_PEAK`) so the next ball really has that height.
- **Availability** (`ShotDef.requires`, only playable shots are shown in the menu, the CPU obeys the same rules):
  Por Tres / Por Cuatro (renamed smashes): net or mid-court + weak lob, not off the glass. Vibora and Bandeja: high ball, not off the glass.
  Volley: not off the glass. Bajada (new): off the glass, mid or high rebound. After a low rebound: Lob (risky, `lowGlassRisk`),
  Flat shot (id `bounce_shot`) or Chiquita (new rally shot `rally_chiquita`).
- **Free ball**: after a point `buildCoast` lets the ball fall, bounce (spin decides how much it keeps), hit glass/mesh/net, fly on
  over the fence or roll out. `MatchScene.playCoast` plays it before the next point.
- **Pace**: `TIME_SCALE` 0.62, flight 450-2000 ms, longer CPU/point/game pauses.
- Next: play-test the balance (glassChance, rebound weights, weak lob share) and tune in `src/data/shots.json`.

## v0.9: rulo physics, player animation, labels removed
- Removed the GLASS/MESH text labels on the near back wall (the faint wall and the dashed 3 m line stay).
- Rulo (`rulo` in shots.json: `edgeX` 4.55, `landDepth` 4.2): the ball bounces on the floor right beside the side fence,
  in the mesh-only part of the wall (z 4-10 from the back), then hits the mesh. Clean + winner: it climbs the fence and
  leaves over the top. Clean + in play: unpredictable bounce off the loose mesh (random speed, sideways, sometimes back;
  `seed` in `buildFlight`, visual only, kept on the receiving half). Mishit (`error`): straight into the mesh with no
  bounce, drops dead. Based on how the real shot works (topspin ball played at the side fence).
- Player animation: 12 poses in `art/character.ts` (`PoseName`: ready, runA/B, fh/bh/smash x Prep/Hit/Follow). The sprite
  is now 56 px wide (racket reach). `art/stance.ts` (tested) picks forehand/backhand/overhead from where the ball lands
  (racket in the right hand: screen right for the near team, left for the far team) and where the player stands.
  MatchScene: running (two leg poses) while moving, the player stands beside the ball in the prep pose while you pick the
  shot, then the stroke (hit, follow-through; overhead shots with a jump); the server tosses (smashPrep). A defender who
  cannot reach a winner lunges late.

## v0.8: stylized 2D/3D look is now the main version
- The owner chose the faux-3D look (see docs/3D.md). `main` now has it; the HD pipeline (720x1280 canvas, `HD_SCALE`,
  `src/art/hd/*`, `src/hd.ts`) is the base of that look. Rules, physics and data are unchanged.
- The old pixel-art 16-bit version is kept on branch `style/16bit` (title shows `v0.7-16bit`) and published by CI under
  `/16bit/`. Branches `style/hd`, `style/retro` and `style/3d` were deleted (retro and plain HD were dropped; 3d is in main).
- Next idea: real 3D (three.js) as a separate prototype branch; see docs/BACKLOG.md.

## State
Game name: **PADEL CHAMP 26**, NES look, portrait 360x640.

Flow: `BootScene` -> `TitleScene` -> (`SettingsScene` | `MatchScene` -> `ResultScene` -> rematch/title).

- v0.1: prototype match (see docs/GDD.md for the rules). Owner played it in the browser: buttons, ball movement,
  full match and replay all work. Owner says shot choice, partner position and shot types will need a lot of
  changes; details to come (see docs/BACKLOG.md).
- v0.2 (this session): title screen, settings (sound on/off, reset save), result screen, save system
  (`src/save.ts`, localStorage, with tests), placeholder 8-bit SFX (`src/audio.ts`), shared UI helpers
  (`src/ui.ts`), palette/config (`src/config.ts`), asset manifest (`src/assets.ts`, `docs/ASSETS.md`).
- CI deploys every push to `main` to GitHub Pages: https://dawjaz.github.io/padel-champ/ (Pages source = GitHub Actions).

## v0.3: 16-bit broadcast view (this session)
Owner changed the art direction (see docs/GDD.md "Visual direction"): 16-bit, TV-broadcast perspective,
comic big-head characters with diverse skin/gender/outfits; equipment in career mode comes later.
- `src/art/camera.ts`: fake-3D projection (metres -> screen), tested
- `src/art/character.ts` + `characterTexture.ts`: generated pixel characters (front/back view), tested;
  previewed as a PNG in the session and looked right (diverse looks, readable rackets)
- `MatchScene` rewritten: perspective court, glass walls, net with depth sorting, ad board, crowd, sprites,
  ball flying in an arc with a shadow, hop on hit
- `TitleScene`: the two heroes flank the bouncing ball
- 4 players with `appearance` in `src/data/players.json` (Toro, Mia vs Bruno, Ines)
- NOT visually verified in a browser by the agent (sandbox cannot reach github.io). The owner should look at the
  match view first: check court proportions, label overlap, menu fit, ball visibility.

## v0.4: new shot mechanics (this session)
Implements the owner's shot spec (docs/GDD.md has the full rules): serve always cross, server's partner in the middle
of the half; serves hard glass / spin glass / at opponent / T; returns chiquita / lob / flat; rally shots vibora /
bandeja / volley / flat shot / rulo; direction parallel / middle / cross; rulo always cross into the mesh fence.
- Pure logic: `src/game/{court,engine,point,ai,catalog,rng}.ts`, data in `src/data/{shots,directions}.json`
  (old moves/responses removed). 84 local tests pass via a shim runner; balance checked by 20k CPU-vs-CPU points.
- Art maths: `src/art/walls.ts` (real wall layout: back 3 m glass + 1 m mesh, stepped side walls, mesh centre),
  `src/art/ballPath.ts` (flight with glass/fence bounces).
- `MatchScene` rewritten: glass drawn translucent with panel joints, mesh as a wire grid, two-step menu
  (shot, then direction showing the target defender), colour hints (green good fit, orange poor, red tired).
- NOT visually verified in a browser and NOT typechecked against Phaser locally: CI is the first real check.
  Owner should check glass/mesh proportions, menu fit, label overlap, ball visibility.
- Smash and bajada come later (they depend on several factors); see BACKLOG.

## v0.5: owner feedback on v0.4 (this session)
Owner wanted a faster, more believable game. Done:
- Pace: you control ONE player; partner and CPU hit automatically after ~120 ms; shorter flights and pauses.
- Serve: first point of a game from the LEFT, then alternating; 2nd serve after a fault from the same side.
  Server's partner stands in the centre of his own quarter (other lane), not the middle of the court.
- Ball: `landDepth` was inverted for several shots (lob/bandeja landed next to the net, chiquita deep): fixed, it is
  metres from the net. `buildFlight` now returns `{path, hit}`; the defender walks to `hit` (after bounce, or where
  the ball comes down after glass/fence) instead of the ball flying into wherever he stood.
- Glass serve: receiver chooses ON THE BOUNCE or OFF THE GLASS (`ReceiveMode`, engine constants in `engine.ts`;
  menu for your receiver, `pickReceive` for the CPU).
- 91 tests pass; MatchScene typechecks against a Phaser stub; balance re-simulated (avg ~4.9 hits, aces ~0.8%).
- Still NOT seen in a browser by the agent. Later: per-player parameters that ease or complicate these shots.

## v0.6: ball physics, lob, partner position (this session)
- `rally_lob` ("Lob") added to the rally menu (owner missed it on LOW balls); 6 rally shots now.
- Server's partner stands 10/3 m from the net (`SERVE_PARTNER_DEPTH`), for both teams and every server.
- `src/art/ballPath.ts` is now a small physics simulation (see docs/GDD.md): arcs with gravity and net clearance,
  floor bounce with spin, glass vs mesh, drag. `buildFlight` returns `{path (time samples), hit, hitH, events,
  duration}`; the scene passes `startH` (ball height when hit) and keeps `ballH`. Shot data has a `flight` block.
  `ARRIVAL_HEIGHT` sets the height the next player meets the ball at. Rally balls that reach the glass are played
  after it; serves to the glass follow the receiver's choice. Cross landing x is now +-2.5 (parallel 3.6).
- 93 tests, balance re-simulated (avg ~4.9 hits, server wins ~52%). Visuals not seen in a browser by the agent:
  check lob height on screen (apex 6 m) and defenders near the glass corners.

## v0.7: smash, bandeja after a lob, partners, version label (this session)
- Title screen showed a hardcoded "v0.2" (the owner thought the old build was running). Now `GAME_VERSION` +
  `BUILD_ID` (git hash from `GITHUB_SHA`, set in `vite.config.ts`) are shown; `index.html` has a no-cache meta.
- New shots `smash_x3` ("przez 3") and `smash_x4` ("przez 4"), menu button "Smash" opens the x3/x4 choice, then
  the direction. Allowed only when the hitter's team is at the net or mid-court AND the ball is high or mid
  (`ShotDef.requires`, `unavailableReason`, `playableShots` in point.ts; CPU respects it). New formation `mid`:
  a lob that did not beat its defender (`attackScore < defenseScore`) only pushes the opponents to mid-court.
  x3: lands next to the back glass, kicks high to the side glass/mesh; a winning x3 leaves over the side wall.
  x4: hard into the court; a winning x4 clears the back glass (`exitVia: 'back'`); otherwise both come back off
  the glass or mesh and stay in play. Winning smash/rulo flights are boosted until the ball really leaves
  (`overFence`, `exitVia`, `boost` in ballPath.ts). Balance: smash wins ~57-62% of points where used.
- Bandeja now needs an incoming lob that did not rush the hitter (`ball.lob`, pressure <= 0.12), else the
  button is greyed out with a hint. Unavailable shots are shown greyed instead of hidden. With more than 6
  buttons the menu uses 3 compact columns.
- Serve set-up: partners keep their own halves. `serveSetup(side, points, serverIdx)`: the partner always stays
  in their own lane; a server who must serve from the other half stands beside the centre mark
  (`CENTRE_SERVE_X`) instead of swapping with the partner. (Owner's wording was ambiguous: confirm.)
- Near back wall: drawn faint, with a dashed line + labels where the glass (3 m) ends and the mesh (to 4 m) begins.
- HD branch: the per-element canvas blur on the crowd froze browsers (2.6 s per arena render); removed.
- 101 tests.

## Verification status
The v0.1 code passed CI (install, tests, typecheck, build). The v0.2 changes were written in a session
without network access, so only the Phaser-free files were typechecked locally; the rest relies on CI.
**First thing next session: check the latest Actions run** (`gh run list`), fix anything red, and play through
title -> match -> result -> rematch once.

## Constraints to know
- A session without network cannot `npm install`, so it cannot add Capacitor or new packages.
  Network settings are changed by the claude.ai organization owner and apply to NEW chats.
- No `package-lock.json` yet (CI uses `npm install`). Generate it on first install, commit it, then use `npm ci`.

## Next steps
1. Check the latest Actions run, play a full match on a phone, fix anything red or odd
2. Owner play-tests v0.17 (golden point) and gives feedback on shot types and shot mechanics
3. Balance pass in `src/data/shots.json` (glassChance, rebound weights, weak-lob share, bajada speeds)
4. Further match mechanics with the owner (per-player parameters, special moves, fatigue/guts use)
5. Real SFX files (CC0) into `public/assets/audio/sfx/` + manifest; `package-lock.json` and `npm ci`
6. Later: Capacitor, career mode and equipment, three.js prototype branch, release prep

## Owner
Chats in Polish. Wants: Android + iPhone release, browser build for testing, everything kept in GitHub so
the project can move between Claude accounts.
