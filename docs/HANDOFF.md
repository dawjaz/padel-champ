# Handoff

_Last updated: 2026-11-21 (v0.49)_

## v0.53: brand gear (plan point 3, first part)
- 6 invented brands, 5 slots (shirt, shorts, shoes, racket, bag), 4 models each = 120 items; cap, wristband and balls removed. Mapping to real makers and racket shapes: `docs/BRANDS.md`. Starter set: the five basic Adaro items.
- Rackets have a head shape (diamond, teardrop, round) drawn on the character (`racketHead` in `art/character.ts`, `Appearance.racketShape`).
- GEAR screen: five slot tabs, six brand tabs, four models per brand (racket silhouette icons). Old saves: old items dropped, better ones paid back in coins. Achievements Collector 15 and Equipment Room 40.
- Open: brand sets, brand packs / shop filter, brand colours and logos on the outfit, collection screen (plan point 4). Not checked on a phone.

## Plan for next sessions (agreed 2026-11-21, owner chats in Polish)
Order is a proposal; the owner can reorder.
1. **Balance after the latest changes (do first).** The XP curve was slowed (`xpBase` 300) but stat caps (`levelsPerCap`), gear and division `minLevel` gates, shop prices and prizes were NOT rescaled: re-tune them together. Play-test RISKY (+15 pp per missing G), rally length after INTERCEPT was removed, and guts at +2 per point. Tune opponent difficulty per division (never tuned).
2. **Check on a phone** what was changed without a device test: ResultScene button rows (GO TO SHOP / MAIN MENU), ShopScene boost grid, BracketScene boost picker, the new guts bar.
3. **New gamification.** Daily and weekly challenges and streaks (coins or packs as rewards); a collection screen with gear sets and legendary items (builds on the "new" stars); rivals with short dialogue in the career; one special move per player with a short animation.
4. **Look and sound.** More hair styles and accessories in the editor, hero animations (run, celebrate), hit effects; real SFX and music instead of the Web Audio beeps; app icon and splash screen.
5. **Release.** Capacitor for Android and iOS, a Playwright smoke test (title -> match -> result), Google Play and Apple accounts, privacy policy, store screenshots. Keep signing material out of git.
6. **3D stays a prototype on `style/3d`** (`/3d/3d.html`, `/3d/char.html`). The owner is not sure about it yet; `main` keeps the stylised 2D/3D look.
Workflow reminders: gameplay changes go to `main` first, then rebase `style/3d` onto it and push both (3D-look-only changes go to `style/3d` only); Pages deploys only from `main`, so push `style/3d` before `main` when `/3d/` should update; bump `GAME_VERSION` in `src/config.ts` with every section here.

## v0.52: 3D character (branch style/3d only)
- `src/art/three/player3d.ts` is now a jointed skeleton (hips, waist, neck, shoulders, elbows, wrist, knees, ankles), driven by pure pose functions: `READY`, `runPose(phase)`, `strokePose(stroke, t)` with nine strokes (forehand, backhand, volley, lob, serve, smash, bandeja, vibora, bajada). Feet stay planted when he crouches; `strokeContact()` says when the racket meets the ball.
- `char.html` (+ `charviewer.ts`) is a viewer for one character: buttons per stroke, IDLE, RUN, SLOW; `?stroke=smash&t=0.36&yaw=0.7&nobar=1` freezes a pose for screenshots. Published at `/3d/char.html`; the match demo is `/3d/3d.html`.
- The demo maps shots to strokes (`strokeFor`). Known rough spots: the forehand follow-through puts the racket in front of the face, the ball leaves at the start of the swing (contact comes 0.1-0.5 s later), right-handed only, no leg motion for side steps.
- Stylised, not realistic: realistic would need modelled characters and padel animations as assets (see the chat notes: three paths).

**Version label**: the title screen shows `GAME_VERSION` from `src/config.ts` (it was stuck at 0.47 until v0.52, now 0.52). Bump it with every HANDOFF section; the number in brackets is the commit of the deployed build.

## v0.51: second batch of owner notes (main and style/3d)
- **Flat return** after a cross on serve receive was too easy a winner: `flat.winnerMargin` 24 -> 60 in `shots.json` (test in `point.test.ts`).
- Result screen: after a tournament there is **GO TO SHOP**, and TITLE is now **MAIN MENU**.
- **Start SP is 2** (`levels.json: startPoints`); `pointsPerLevel` is still 2.
- **Slower XP curve** (owner's choice): `xpBase` 60 -> 300 (exponent still 1.5), so a won tournament gives about 1 level (2 SP) at entry level instead of 3-6. Level 30 now needs 46,851 XP. Existing saves keep their XP, so their level drops; stat caps (`levelsPerCap`) and gear/division `minLevel` gates were NOT rescaled, so progression through them is now much slower: re-tune together if the pace feels wrong.
- **Guts recovery back to +2 per point at stamina 5** (`1 + 0.2 * stamina`, rounded).
- **GEAR**: a gold star on a category button when it holds gear not yet seen (`Inventory.seen`, `hasNewIn`, `markSeen`). Old saves treat all owned gear as seen.
- **Boosts moved to the shop** (`consumables.json`, price and short label each; no boost pack any more). Bought one by one with `buyBoost`, bag max 2 (`MAX_BOOSTS`). Before each tournament match the BRACKET screen lets you pick one boost from the bag (`Inventory.queued`, max 1, consumed with the match). `queued` is cleared when the tournament ends. Boosts apply only in tournament matches.
- Not yet checked on a phone: ResultScene button rows, ShopScene boost grid, BracketScene picker.
- **RISKY shots** (owner's choice): a shot the hitter cannot pay for is still playable, but no longer loses attack (`TIRED_FACTOR` removed). Instead error/fault chance gets `RISKY_PER_G` (0.15) for every missing G point (`errorChance`/`faultChance` take `missingGuts`, clamped by `MAX_ERROR` 0.6). The button is red with the label RISKY (was 'tired'). The CPU does not take guts into account when choosing a serve (`ai.ts`).
- **Guts bar**: the "G 10/10" text next to the player names is now a rounded bar (`drawGutsBar`, `gutsBarColor` in MatchScene): green from 75%, lime from 50%, orange from 30%, red below 30%. Checked in a headless screenshot (name above the bar for opponents, below the feet for the hero).
- **Publishing**: Pages now also builds `style/3d` and serves it under `/3d/` (open `/3d/3d.html`). The workflow only deploys from `main` (a push to `style/3d` is rejected by the environment rule); to refresh `/3d/` after pushing `style/3d`, re-run the workflow on `main`.

## v0.49: owner changes after play-tests (main and style/3d)
- **Flat shot** (`bounce_shot`) no longer flies back over the net off the back glass: new `ShotDef.noReboundBack` (set in shots.json, checked
  in `stepHit`). The generic rule (shots >= 22 m/s that come off the glass) is unchanged for the others (vibora, bajada, smashes); in the
  CPU sim it fell from 4.1% to 0.9% of points.
- **Receiving a serve to a wall**: decision time is `receiveDecisionMs(guts, maxGuts)` (attributes.ts): 6.2 s at full G (was 5.2 s), down to 40%
  of that (2.5 s) at empty G. When the bar runs out the receiver never touches the ball: `stepServe(..., late = true)` turns a serve that is in
  into an ace (`step.late`, text "did not decide in time"); a fault stays a fault. The scene rebuilds the ace flight (same path up to the bounce,
  longer after it) and converts the resume point (`progress * in.duration / ace.duration`).
- **Guts recovery** is `max(1, round(0.2 * stamina))` per point: 1 at stamina 5 (2 only from stamina 8), was 2. **Balance warning**: in a
  CPU-vs-CPU sim (CPU does not manage its G) 70% of player-points are below half G by point 11 and 86% by point 21 (with +2: about 31% / 37%),
  so fatigue (power, accuracy, speed down to x0.7) now dominates the second half of a match. Decide with the owner: more max G, cheaper shots,
  or recovery on game change.
- **Tournaments** (`career/careerFlow.ts`, `season.ts`): while `career.active` is set, match rewards are NOT paid per match. They are kept in
  `active.pending {xp, coins}` and paid with the prize in `finish()` (also on withdraw), so level ups, free packs and the summary come after the
  tournament (`Finished.matches`). ResultScene hides reward, level, bar and HERO after a tournament match, and shows "MATCHES +xp +coins" in the
  final summary. HERO, SHOP (title buttons greyed, note "FINISH THE TOURNAMENT FIRST"), GEAR, PARTNER (calendar button locked) are closed until
  the tournament ends (scenes also redirect). A quick match played meanwhile still pays and shows its reward, but a free pack says "after the tournament".
- **INTERCEPTED removed** (owner: it did not look natural): `INTERCEPT_MARGIN`, the `intercept` outcome, its flight in `ballPath.ts`, the banner and
  the Free Practice result are gone. A defence that beats the attack by a lot now just keeps the rally going. CPU sim: avg hits 6.7 -> 8.5, server
  wins 52.8%, 2% of points above 20 hits (longest 31): watch the rally length and the tiredness (see the guts note) when play-testing.

## v0.34: B1, seven attributes in the engine
- `src/game/attributes.ts`: power, spin, technique, accuracy, stamina, speed, defense (5 = neutral, all multipliers 1 there).
- Power -> ball speed (`speedMul`); spin -> `FlightDef.spin/side` via `FlightOpts.spinMul` and the vibora attack stat; accuracy -> `AIM_SKILL`, aim spread, side-wall risk; stamina -> `maxGuts`, guts recovery, fatigue start; technique/speed/defense as before.
- players.json has all seven; `maxGuts = gutsFor(stamina)`. Sim at defaults unchanged: avg hits 7.4, server wins 53.8%. 193 tests pass.
- Next: B2 (profile, XP, levels, skill points, save v2, character screen). docs/CAREER.md updated with the owner's decisions (13+, coins, 8 gear slots, consumables, real-tour calendar).

## v0.47: icons and pack opening
- `src/art/icons.ts`: vector icons (8 gear slots, 7 attributes, coin, boost, trophy) drawn with Graphics. Used on HERO (attribute rows), GEAR (slot buttons now show the item name and a rarity-coloured icon), SHOP (coin) and the pack cards.
- Pack opening: face-down cards pulse, tap flips a card (scaleX), rare+ gets a ring and sparkles, epic/legendary also a screen flash; item or boost icon on the card.
- Not checked on a phone: icon sizes and positions on HERO and GEAR.

## v0.46: shared look for the menu screens
- `applyScreen(scene, fade)` in `src/hd.ts` (replaces `applyHd` in every menu scene; the match still uses `applyHd`): night gradient, lit court in perspective, drifting lights, vignette, 220 ms fade-in. Buttons sink on press (`ui.ts`).
- Owner: play-tests of v0.43/v0.44 are fine; prices and opponent difficulty come later. Next topic: visuals and a more attractive layout, then three.js.
- three.js plan (needs network for `npm install three`, so a NEW chat after the network setting is changed): branch `style/3d`; keep `src/game/` untouched; replace the court and player drawing in MatchScene with a three.js scene behind the Phaser UI (or a Phaser-free scene), reuse `buildFlight` ball paths for the ball, the camera from `art/camera.ts` as the starting TV view; menus stay Phaser. Priorities from the owner: menus/screens, court and players, effects (replays, crowd, broadcast captions).

## v0.45: menu exit, 10 partners
- MATCH has a MENU button (top left, tap twice) in quick match and practice; a career match has no exit.
- 10 partners in `partners.json`, ordered by rating and price: Olek (free default, weakest), Lena 200, Tomek 450, Marco 800, Mia 1300, Kasia 2000, Sofia 3000, Ivan 4200, Diego 6000, Ana 9000. Different profiles (power hitter, defender, technician). PartnerScene pages 5 per screen. Old saves that own Mia keep her.

## v0.44: owner tweaks
- Serve-receive decision time doubled (crawl 2.6 s -> 5.2 s). The point banner on the court stays 1/3 longer (1100 -> 1470 ms; the point pause grew by the same).

## v0.43: B6 achievements, tutorial
- `src/career/achievements.ts` + `src/data/achievements.json` (17 goals, coin rewards); `SaveData` has `achievements` and `records` (streak, best streak, longest rally, shutouts) and `settings.tutorialSeen`. Checked in `MatchScene.endMatch`; the result screen lists new trophies; `AchievementsScene` (menu TROPHIES).
- `TutorialScene`: 5 pages, shown once before the first QUICK MATCH, again via SETTINGS > HOW TO PLAY.
- Balance: no change (no play-test data yet). Pacing: level 10 about 13 matches, level 30 about 75.

## v0.42: volley only from the air, volley goes down, no overheads after a lob
- `ShotRequires.air` (ball must not have bounced) and `ShotRequires.noLob` (not off a deep lob); `BallState.air` is set only for balls a net player or a mid-court defender takes out of the air (block / net return).
- Correction (same session, owner): bandeja and vibora ARE offered after a deep lob that did not touch the glass (`noLob` is no longer used by the data; the code stays). After a glass rebound only bajadas, flat shot, lob.
- Volley requires `air: true`: never offered after a bounce. Bandeja and vibora require `noLob`: after a deep lob (bounced, off the glass or not) only both bajadas (glass), flat shot, lob (+ chiquita on low/mid) are offered.
- Volley flight: `deaden 0.5`, `landDepth 4.8`: steep descent, dead bounce, stays low (test in `ballPath.test.ts`).
- Open: Chiquita is still limited to low/mid balls; the owner listed it for the high ball after the glass too: decide.

## v0.41: Star Point, receive decision in the air, power impact, layout
- Scoring: the FIP **Star Point** rule replaces the golden point (`scoring.ts`: `deuce` 0..3, `advantage`; at 40-40 advantage is played twice, the third deuce is one deciding point and the receivers choose the side; score line shows DEUCE 1/2, ADVANTAGE, STAR POINT). `pickGoldenReceiver` -> `pickStarReceiver`, `isGoldenPoint` -> `isStarPoint`.
- Receiving a serve that goes to a wall: the human no longer decides before the serve. The serve is played (racket sound, swing), the ball flies until just before its bounce and then crawls for 2.6 s with the speed in km/h, where it goes (T / body / wide off a glass), pulsing rings at the bounce and at the glass, and a bar that runs out (default: on the bounce). The same seed rebuilds the same flight, which resumes from where it stopped (`previewServe`, `playStep(..., {seed, from, startH})`, `performServe` with a seed). A fault plays without a decision. CPU receivers still decide at once. Serves with no wall (at the opponent, T) never had a choice.
- The CPU serves with all four serves (hard glass, spin glass, at the opponent, T) chosen by stat x power x safety weights (`pickServe`); it does not yet choose by the receiver's position.
- Por Cuatro and a strong Por Tres (winner or glass rebound back over the net) mark the court at the bounce: white core flash, glow, shock rings, sparks, a scuff and a small camera shake (`powerImpact`, `powerStyle`).
- Layout: title menu spacing (the stats line no longer sits on SETTINGS), Boost Bundle text in the shop anchored at the top.
- Check on a phone: the pause in the serve (does the slow crawl feel right? is 2.6 s enough?) and the strength of the court mark.

## v0.40: nobody freezes, calmer status line
- When a ball ends the point (winner, ace, error) or a serve is a fault, nobody stands still any more: the defender runs for the ball (all the way on a winner, about two thirds of the way on an error, a few steps on a fault), the partner covers, the hitting pair follows its shot into the new formation (`performHit` in MatchScene: `movePartner`, `shiftHitters`).
- Status line: removed "X is going to serve", "X serves: ...", "to return" and the "Point to X" overwrite. The last text (how the point ended, now with "POINT TO YOU/CPU") stays until the next shot replaces it; a won game appends "GAME TO ...".
- Aiming grid (unchanged): 10 points across x 20 in depth = 200 aim points per shot, about 18 cm apart; the real limit is the aim spread (+-0.9 m across, +-1.5 m in depth), not the density.

## v0.39: second serve, what the guts do, faster pace, shop layout
- Second serve (after a fault): attack x0.82 (fewer aces), pressure on the return x0.5, fault chance x0.75, ball speed x0.8 (scene); the receiver returns it with power and accuracy x1.2 (`SECOND_SERVE_*` in engine.ts, `Step.second`).
- Guts now have a practical effect (`fatigueFactor`/`fatigued` in attributes.ts): from half the bar up nothing changes; below that power, accuracy and speed fall to x0.7 on an empty bar (applied to attacker and defender in `stepHit`, receiver in `stepServe`; ball speed via `Step.powerFactor`; players run up to 30% slower in the animation). The old rule stays: a shot you cannot pay for loses 40% attack. In the sim about 17% of player-points are played below half guts; avg hits 7.05, server wins 52.9%.
- Pace: the pause before a hit is halved (CPU_DELAY 56 ms, NEXT_HIT_DELAY 88, CPU 44).
- Shop: the Boost Bundle text no longer runs under the price button; the footer note no longer overlaps BACK.
- Next: UI polish pass on the other screens (owner's screenshots), then B6.

## v0.38: B5, career calendar, tournaments, partners
- `src/career/tournament.ts` (+ tests): 11 divisions in `src/data/divisions.json` (Club, Regional, FIP Rise/Bronze/Silver/Gold/Platinum, Premier P2/P1, Major, Season Finals): level gate, ranking gate, fee, opponent rating (1-10), title prize (coins, XP, ranking points, pack); round shares 8-draw [.2,.5,1], 16-draw [.08,.2,.45,1]. Opponents are generated pairs (`opponents.json`); the bracket is rebuilt from `{event, seed, hero results}` so the save is tiny; other matches are simulated by rating (logistic, slope 0.8).
- `src/career/season.ts` (+ tests): 24-week season (`calendar.json`, 71 events), ranking points (half carry over to the next season), `Career {season, week, rankPoints, partner(s), active, titles, history}` in the profile (sanitised). `careerFlow.ts`: enter (fee), report match, finish (prize, rank, pack, week), withdraw, skip week, buy/choose partner.
- Partners (`partners.json`): Mia (free), Lena 400, Marco 900, Sofia 2000, Diego 4500 coins; fixed attributes.
- Scenes: CAREER hub (CalendarScene), BracketScene (round, pairings, next opponent, strength comparison, play/withdraw), PartnerScene; ResultScene has CONTINUE in career; MatchScene takes `{career: {opponents, name}}` (always pass `career: null` for other matches; the CPU team is reset every match). The title menu is now QUICK MATCH, CAREER, HERO, SHOP, SETTINGS (and Free Practice when `SHOW_FREE_PRACTICE`).
- Balance data (sim, uniform attributes, point win rate of the first team): 5v5 51%, 6v5 67%, 7v5 91%, 8v5 97%, 4v3 57%. One point of average attribute is worth a lot, so the division ratings step 0.8 and are about the hero's level cap at the level gate (hero cap 5 at levels 1-5, +1 per 5 levels). Tune `rating` and the prize numbers after the owner's play-test.
- Next: B6 (achievements, tutorial, balance pass) and a UI polish pass for all menu screens (the owner will send screenshots of overlaps).

## v0.37: B4, coins, shop, packs; Free Practice hidden
- Free Practice is hidden from the title menu (`SHOW_FREE_PRACTICE = false` in config.ts; all code is kept; the menu re-lays out for 4 or 5 buttons).
- `src/career/packs.ts` (+ tests) and `src/data/packs.json`: Gear Pack (150 coins, 2 items: 70% common, 26% rare, 4% epic; sure rare+ every 6 packs), Premium Pack (500, 3 items: 70% rare, 26% epic, 4% legendary; sure epic+ every 5), Boost Bundle (80, 3 consumables). A duplicate pays coins (15/40/100/250). Odds and the pity counter are shown in the shop.
- gear.json: 8 legendary items added (minLevel 20, +4 bonus). Rare/epic/legendary are now pack-only (no level unlock; commons are owned from the start). An owned item still needs its `minLevel` to be equipped.
- Every level up brings one free Gear Pack (`inventory.packs`, opened from the top of the SHOP); ResultScene shows FREE PACK. Inventory also keeps `pity`.
- New scenes: SHOP (title menu) and PackScene (tap to turn the cards one by one). Real money is still not involved.
- Economy to review with the owner: about 40-70 coins per match; a Gear Pack is 2-4 matches.
- Next: B5 career calendar (divisions, knockout draws, opponents from the division, rewards, ranking, partner roster).

## v0.36: B3, gear and consumables; vibora not at the net
- Vibora has `formations: [mid, back]`: not offered to a team that stands at the net (test in point.test.ts).
- `src/career/gear.ts` (+ tests), `src/data/gear.json` (8 slots x common/rare/epic = 24 items; bonus total 1/2/3 by rarity, e.g. Power Sprint Shoes +2 Power), `src/data/consumables.json` (isotonic +10% guts recovery, gel +2 max guts, grip tape +2 technique, fresh balls +2 spin; 2 of each at the start, max 3 queued).
- Rules: total attribute = base + skill points + gear + boost, capped at `statMax` (10); an item needs its `minLevel` (common 1, rare 5, epic 12) to be equipped; items with `unlock` arrive in the inventory at that level (ResultScene shows NEW GEAR); packs in B4 add the rest. Sets and legendary items are not done yet.
- `Profile.inventory {owned, equipped, stock, queued}` is part of the save (sanitised on load). `heroFrom(base, profile, boost)` applies gear, boost and the look.
- Look: `Appearance.cap` (new drawing, all four views) and `Appearance.wristband`; shirt/shorts/shoes/racket colours come from the gear; bag and balls have no look yet (only bonuses).
- MatchScene: queued consumables boost the match and are used up at its start (not in Free Practice); guts can be fractional (shown floored).
- New GEAR screen (from HERO): hero preview with the look, 8 slots, items of the chosen slot, boosts. HERO shows gear bonuses in yellow.
- Next: B4 coins, shop, packs and pack opening, drop tables (odds visible).

## v0.35: B2, profile, XP, levels, hero screen
- `src/career/profile.ts` (+ tests) and `src/data/levels.json`: XP curve (60 x (L-1)^1.5), 30 levels, hero starts at 4 in every attribute with 6 free points, +2 points per level, attribute cap 5 at level 1 rising to 10 at level 26 (one step per 5 levels); match rewards (XP and coins by played/win/points/long rally) all in JSON.
- Save is v2: `profile {xp, coins, alloc}`; v1 saves migrate to a fresh profile; `sanitizeProfile` cuts cheating (points above earned or above the cap).
- MatchScene: the human hero (Toro, idx 0) now plays with the profile attributes (`heroFrom`), so quick matches and Free Practice use the hero you build; the match tracks points and the longest rally and pays XP and coins at the end. Mia and the CPU team keep their fixed stats.
- New HERO screen (CharacterScene): level, XP bar, coins, seven attribute bars with + buttons, RESET (free respec for now). Title menu got a HERO button; ResultScene shows the reward, the level bar and LEVEL UP.
- Tunables to review with the owner: start at 4 (weaker than the old Toro 8/5/5/5), rewards, cap steps.
- Next: B3 gear (8 slots, inventory, appearance layers, caps, consumables).

## Planning (2026-11-21): career mode
- `docs/CAREER.md` = design of attributes (power, spin, technique, accuracy, stamina, speed), XP/levels, gear with bonuses, packs, tournament calendar, code structure and steps B1-B6. Waiting for the owner's answers to its 4 questions before B1. Owner decisions so far: mechanics done, three.js later, online/monetisation later (offline first), gear gives attribute points but tournaments are capped.

## v0.33: Free Practice shows only playable shots; roadmap
- Free Practice ATTACKING lists only the shots that can be played with the SETUP ball (the match rules, no `*` any more), so e.g. no vibora off the glass or on a low ball. New SETUP switch WEAK LOB (needed for Por Tres / Cuatro). DEFENDING still lists every shot the opponents can play.
- `docs/ROADMAP.md`: proposed plan (A mechanics, B progression core, C online, D monetisation and compliance, E 3D later). Waiting for the owner's three decisions listed at its end.

## v0.32: bug: START MATCH after Free Practice
- Phaser re-uses the data of the previous `scene.start` when a scene is started without data, so START MATCH / REMATCH after a practice session opened Free Practice again. Both now start `MatchScene` with `{ practice: null }`. Rule: always pass data explicitly when starting MatchScene.

## v0.31: rulo on high balls only, more kinds of serve faults
- Rulo `requires.heights` ['high'].
- Faulted serves (`SERVE_ERRORS`, point.ts): net 30%, back glass low 12%, side glass low first 18% (`side`), **long** 25% (bounce beyond the service line, ball runs on), **bouncemesh** 15% (bounces in the court, then lands on the mesh over the side glass). Serves with wall 'none' skip side/bouncemesh. New `ErrorKind`s 'long' and 'bouncemesh' (ballPath.ts error branch; the log/banner text in MatchScene `faultWhere`/`errorText`).

## v0.30: Por Cuatro defence choice, low glass errors, side-wall errors
- **Por Cuatro defender judges the ball** (point.ts, continue branch): `EARLY_TAKE` 35% go for it before the glass (volley 2.4 m from the net, `EARLY_TAKE_DIST`), which can be fumbled: `EARLY_TAKE_ERROR` 0.62 minus 0.04 x technique (28-44%), the hitter wins (`step.earlyError`). The rest wait for the glass and run to the net (`netReturn`, v0.28). The deep rebound winner (out of reach) share is still `reboundWin` 0.45.
- **Errors into the back glass are low** (0.35-1.25 m, was 1.4-2.7); mesh errors weigh x0.35 (`MESH_ERROR_SCALE`).
- **Side wall**: new `ErrorKind` 'side'. A ball aimed past |x| 2.2 m goes straight into the side wall (glass, 25% mesh) with up to 55% of its errors, and the error chance rises up to +9% at the edge (`EDGE_RISK`, `HitInput.landX`). `ErrorKinds` is a Partial now.

## v0.29: rulo and bajada high speed are defensible
- **Rulo**: power 1.5 -> 1.02, winnerMargin 16 -> 35. Winners vs the CPU pair: strongest hitter 20% (was 86%), the others 0-4%; most rulos stay in play. The bounce off the mesh is more random: wider speed and direction ranges, and 30% of them are "swallowed" by the mesh (drops a short way off the fence, nearly all speed gone). Visual only (seeded), the outcome does not depend on it.
- **Bajada high speed**: power 1.6 -> 1.25, winnerMargin 16 -> 32: winners 73% -> about 33% for the strongest hitter (rebound winners included), 24% for the next, the rest less (error rate unchanged, 26%).
- `REBOUND_BACK_SHARE` 0.5 -> 0.8: the generic rebound-over-the-net winner was too frequent after the vibora change (14% of CPU points); now about 6%, mostly Por Cuatro.

## v0.28: Por Tres / Por Cuatro
- Both need a **mid or high** ball (not low) plus the existing weak-lob / net-or-mid conditions.
- **Por Cuatro = the nail.** Winners are one of two kinds (`reboundWin` 0.45 = share of the second): (1) nail: lands in the front of the court (`winLandDepth` 4.6 m from the net), bounces and flies out over the full 4 m of glass + mesh (the exit must be at h >= 4 m, otherwise the boost search falls back to any exit: about 2 of 18 test cases); (2) deeper (`REBOUND_WIN_DEPTH` 8 m): hard bounce, off the back glass, back over the opponents' heads into the attackers' half (`reboundBack`, return arc now has 1.8 m of apex). Badly hit (continue off the glass): `netReturn`: the defender goes to the net (formation 'net') and plays the returning ball as a volley (mid ball) 3.5 m or less from the net.
- CPU-vs-CPU: rebound winners about 10% of points (was 5%): lower `reboundWin` or `REBOUND_BACK_SHARE` if too many.

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
