# Handoff

_Last updated: 2026-11-26 (v0.152)_

## v0.152: brand C (fireball) in the game: intro, start screen, icons, title bar
- Owner chose direction C from round 2 (the fireball). Assets and icon sets: `design/brand/README.md`.
- Launch flow: BootScene -> **SplashScene** (about 1.9 s, a touch skips: the fireball flies in, glass cracks with a flash and a shake, TRES slides in, the POR tag drops, PADEL CAREER slides in; built from logo layers in one frame) -> **StartScene** (night court, the logo, the player's own hero in the smash pose, pulsing TAP TO PLAY) -> TitleScene.
- TitleScene: the one-line logo (`logo_bar`) in the bar; CAREER in the sport lettering (Anton, slanted, red shadow). Anton is loaded (`@fontsource/anton`, `SPORT` in theme.ts) and is meant only for brand moments.
- Palette: `TC.orangeLight` = the logo orange #ff5a1f, `TC.gold` #ffc21f. Web: favicons, apple-touch-icon, `manifest.webmanifest`, theme colour #0a0f2e.
- Left for the end (owner): the studio splash ("<studio> presents") before the intro, once the owner has a studio name.
- Checked in desktop Chrome at 360x640: intro frames, start screen, title screen. Not checked on a phone yet.

## Brand proposals (no game change): logo and app icon, four directions
- `design/brand-proposals/` (README there): A modern (Unbounded, navy + lime, the por tres path), B retro 8-bit (pixel title, pixel racket), C dynamic sport (Anton skewed, fireball through glass), D comic (the real game hero smashing, comic POR TRES! in the game colours). SVG sources, PNG previews and the generators.
- Shown to the owner on a design canvas (claude.ai artifact "PorTres – logo i ikona (4 kierunki)"): overview, home-screen and store-row comparison, one detail board per direction with small-size tests.
- Round 2 (owner: A and B out, C liked most, D not liked): C2 esports crest, C3 championship gold with the numeral 3, C4 urban brush, D2 pop-art comic panel; on page "Runda 2" of the same canvas.
- Round 3 (owner: keep only C and C2, mix them): H1 crest in C colours (navy/orange), H2 crest in C2 colours (black/lime) with the fireball; page "Runda 3".
- Next: the owner picks one (or a mix); then a transparent logo for the title screen, the store icon set (iOS/Android sizes, Android adaptive foreground/background) and the splash.

## v0.151 (small): the all-capitals UI writes POR TRES with a space (`GAME_TITLE`), the logo and store keep PorTres

## v0.150: the game is called PorTres
- Owner's decision (2026-11-26): name **PorTres**, store title **PorTres: Padel Career**. Reasons, rejected names and the web check are in DECISIONS.md; the checklist for trademark, domains, stores and social handles (to be done by hand) is `docs/NAMING.md`.
- In the game: `GAME_TITLE = 'PORTRES'`, new `GAME_SUBTITLE = 'PADEL CAREER'` (config.ts); title bar, footer line, court banners (`arenaHd.ts`), `index.html` title, README and CLAUDE.md heading. Repository, `package.json` name and the save key `padel-champ-26:save` are unchanged on purpose (the key would erase every save).
- Open: logo and icon design, animated title and studio splash (needs the studio name), store texts. Name has not been searched in the trademark registers (only the web).

## v0.149: tutorial matched to the current game
- Lessons: THE TIMING RING and SPECIAL SHOTS now say that special shots need the ring too (green = full shot, otherwise a normal shot); RECEIVING says the opponent drops the ball and serves after the bounce. The `special` slide shows the ball, the ring, the tap on green and only then the four level chips (they hid the ring at the top before). Serve slide and menu lesson were already right (bounce first, knee-hip bubble, plain list).
- Checked in the browser (desktop Chrome, 360x640): special and serve slides. Not checked: receive page 2 text on a phone.

## v0.148 (small): the serve takes 700 ms (was 1000) and the knee-hip marker is gone; see v0.147 below

## v0.147: the serve is struck after a bounce, everywhere; the shot menu is the list again
- Owner's brief: a padel serve is underarm, after one bounce, with the ball between the knee and the hip. Rules checked (FIP rules and club guides): both feet behind the service line, the ball dropped and bounced inside the server's own area, struck at or below waist height, sent diagonally into the opposite box; a fault gives the slower second serve (already in the engine).
- `src/art/serveDrop.ts` (pure + tested): `serveBallH(ms)` is the one ball path (hand 1.15 m, bounce, peak at the hip 0.95 m, struck at ~0.78 m after `SERVE_DUE_MS` 700 ms), `KNEE_M`, `HIP_M`, `inServeZone` (the zone marker was tried and removed at the owner's request; the serve was shortened from 1000 to 700 ms).
- Match / career / quick match / Practice Court: `timingRing('serve')` uses the shared path (the zone marker is gone since v0.148); every other serve (opponents', partner's, yours with TIMING: AUTO) goes through `MatchScene.serveDrop` first (`performServe` with `dropped`, `previewServe(shot, dropped)` for a human receiver). Camp Serve & Return: your serve uses the same path and zone, and the rival drops the ball before his serve (`MinigameScene.dropBall`). Tutorial: serve and receive slides show the drop and the bounce; lesson texts say it.
- Shot menu: default back to the plain list (setting renamed `shotMenu`, default `'list'`, so the old stored value is ignored); SETTINGS > SHOT MENU still switches to the columns if wanted. Tutorial menu lesson describes the list again.

## v0.146: season trophies in the trophy cabinet
- `CupsScene` has a third mode (CUPS -> SEASONS -> SETS): one trophy per finished season from `career.seasons` (gold top 3, silver top 10, bronze the rest; grey for seasons still to play), details on touch. `SeasonEndScene` says a trophy was added. Reached from HERO > TROPHIES.
- Owner's decisions (18:31): the other ring games keep the current timing (maybe a cosmetic input-lag compensation later, see BACKLOG idea); balance stays as is; tutorial to be extended/updated only after he decides on the shot menu layout (v0.145). Next topic: how and when to move to Unity or Unreal.

## v0.145: shot menu in columns by intent (owner's test, easy to undo)
- `MatchScene.showShotMenu` draws the menu in three columns: DEFENCE (left, blue), NEUTRAL (middle, grey), ATTACK (right, orange), each shot in a fixed order inside its column (`FAMILY_OF`), the specials in a gold row on top with a fixed slot each. Quality of the shot (good / poor / tired) stays in the edge colour and the RISKY mark. The rows shrink when a column is long (`showButtons` layout `'columns'`).
- SETTINGS > SHOT MENU: COLUMNS / LIST switches back to the old plain list (`settings.menu`), so the owner can compare on the phone. Practice Court and other menus still use the list. Prototype page: `proto/menus.html` (layouts A fixed grid, B columns, C two steps).
- Tutorial: the menu lesson describes the columns.

## v0.144: tutorial slides corrected after the owner's look
- Serve slide: all three spots (T, the opponent, the glass) are inside the far court; the glass serve bounces in the court first and then goes on to the side glass. Receive slide: the chips LOB / CHIQUITA / DRIVE no longer hide behind the speech bubbles (bubbles got a `ttl`). After the glass: the ball bounces in the court, then hits the side glass, then goes over the fence. Lob or door: new stage `'outside'` and cast `'side'` (the player stands outside the court beside the side glass with a door in it; LOB goes over the glass, DOOR flat through the opening).
- Open question for the owner: the shot menu changes places as the playable shots change (`showShotMenu`: `playableShots` in catalog order, specials unshifted). Three layouts proposed (fixed grid, columns by intent, two-step categories); waiting for his choice.

## v0.143: owner's test round (spin, Smash Show, Settings, Hero, seasons) and tutorial stage 2
- Camp balls turn: `MinigameScene` keeps the ball's orientation like the match (`ballR`, `ballOmega`, `redrawBall`); serves spin by kind (flat little, kick hard topspin, slice backspin + side), smashes by kind. The camp ball is a bit larger (min 9 px) so the turning shows.
- Smash Show "MISS": the timing window was as narrow as 90 ms while the ring shrinks slowly, so a human could not tell. `SMASH_MIN_WINDOW` 150, and a touch is judged `SMASH_INPUT_LAG` (50 ms) earlier (screen and finger lag). A bad touch now says TOO EARLY or TOO LATE instead of NET. The other camp timing games were not changed (same lag idea may apply).
- Settings: buttons and captions re-spaced (they overlapped). Hero: TROPHIES, RANKS, ACHIEVEMENTS in a row under the attributes (rows are 46 px now); `RankingScene` takes `from` and has a SEASONS tab (history from `career.seasons`).
- Owner decided: no change to seasons for now (same calendar, level-gated events); season-end rewards stay. Ideas left: season trophy in the hero room.
- Tutorial stage 2: lessons toss (+ leaving a match), partner, shop, tasks, season; tips hooked in `coinToss`, PartnerScene, ShopScene, DailyScene/WeeklyScene, SeasonEndScene. HOW TO PLAY has WATCH ALL LESSONS and SHOW EVERY TIP AGAIN IN PLAY (resets seen tips only; achievements untouched).

## v0.142: special shots need the ring, and the season has an end (recap + rewards)
- Specials (`sp_*`, smash-type) went in ~85-95% against defense <=5 by design, and the timing ring did almost nothing for them. `specialTimingError(q)` in `game/engine.ts` now adds an error: clean touch ~2-7%, no ring (AUTO/CPU) 8%, mistimed up to 45%. A strong defender (7) still answers more. Numbers are in `calendar`-independent engine code; tune the constants there.
- Season end: `career/seasonEnd.ts` (pure, tested): `seasonPay(place, events, titles)` from `calendar.json -> seasonRewards` (tiers by world place: 1 / 3 / 10 / 30 / complete, +150 coins per title, needs `minEvents` 8 tournaments, else nothing). `closeSeason` is called from `finish()` and `skipWeek()` when `advanceWeek` crosses into a new season: pays coins and packs (`inventory.packs`), stores `career.recap` and a line in `career.seasons` (last 10). `career.log` counts the season (events, titles, finals, rank points) and resets.
- `SeasonEndScene`: the recap (place, numbers, pay, carry-over of 50% points), shown by `CalendarScene` before anything else while `career.recap` is set; START SEASON N clears it.
- Not done / ideas: season 2 difficulty step, shuffled cities/hosts, a season-trophy in the hero's room, a seasons history screen (data is in `career.seasons`).

## v0.141: graphic tutorial, stage 1 (comic slides, tips in context, lesson list)
- Owner's brief: the tutorial is for the whole game, not only the minigames, and it must be comic slides with the cutscene characters (preparing, striking), not empty diagrams. The first attempt (flat schematics in `art/tutorialArt.ts`) was rejected and removed.
- `src/tutorial/lessons.ts` (pure, tested): 15 lessons in 5 groups (MATCH, SHOTS, HERO, CAREER, CAMP), each 1-3 pages {head, text, art}; `TipState` in `save.tips` ({seen, off}), `tipDue/markTip/setTipsOff`, `sanitizeTips` (a player of the old tutorial has the basics and serve as seen). `FIRST_RUN` = basics, serve (played in a row before the very first match from QUICK MATCH, via `TutorialScene {first:true}`).
- `src/scenes/tutorialSlides.ts`: the slides. A framed comic panel (court / sunburst / gold stage) with `StageActor`s (the hero as he looks in the game, a partner, an opponent) playing a looped script (`SCRIPTS`: `Kit.at/ball/bubble/shout/tap/ring/burst/flash/chip/icon/bar/glow/cross/head/walk`), local coordinates 312x232. To add a slide: add an `ArtId` in lessons.ts and a `Script` here.
- `src/scenes/TipScene.ts`: the overlay (like ConfirmScene: the scene under it is paused and resumed), pages with NEXT / GOT IT, queue of lessons, DON'T SHOW TIPS on contextual tips. `src/tutorial/tips.ts`: `showTip(scene, id, done?)` (once, only if tips are on, never over another tip) and `openLessons`.
- `TutorialScene` is now the HOW TO PLAY list (SETTINGS): lessons by group with SEEN/NEW, PLAY/AGAIN, TIPS DURING PLAY on/off.
- Tips are hooked at: the first timing ring (`timingRing`), the first RUN OUT (`runOutPhase`, human runner), the first rally/return menu (`shots`: what can I play, aiming) and the first menu with a special (`special`), Practice Court, Hero, Gear, Career (calendar), Camp and each camp minigame before its countdown.
- Scripts in tests/automation: set `tips.off = true` (or `tutorialSeen` plus filled `tips.seen`) or the tips will pause the scenes.
- Next stages: more lessons (shop and packs, partners, daily and weekly tasks, quitting and retiring from a match, coin toss), a short pass on the slides after the owner's look (pacing, wording), maybe voice-less "sound" effects with the rest of the sounds.

## v0.140: owner's test round (Gear tiers, serve pace and spin, Smash Show ring, camp counters, big-draw layout, skill points)
- Skill points (fixes the v0.138 misreading): the owner wanted the same pace as before (the cap rises every 5 levels, 2 points a level); the bug was an off-by-one: the new room opened on level 6, 11, ... while the hero screen promised level 5. `statCap(level) = capBase + floor(level / levelsPerCap)` now (opens ON 5, 10, 15, 20, 25), `levelsPerCap` is back to 5, `nextCapLevel` feeds the hint under the stat rows ("unlocks at level N"). Supersedes the v0.138 note about caps every 3 levels.
- Gear: every worn-item tile shows its grade (Basic / Pro / Technical / Elite, `tierOf` from the id suffix _1.._4) under the brand.
- Camp minigames: serves (hero's and the opponent's) fly at `SERVE_MS_PER_M` 48 (about 75 km/h; before 85, which the owner found slow in both); `AFTER_BOUNCE_MS_PER_M` 90. Side spin: `SERVE_SPIN` (swerve = bow in the air via `flyArc(..., swerve)`, kick = line bent off the bounce via `kickedFrom` + `rollOn`); the hero's serve kind follows the spot (`serveKindOfSpot`: wide slice, body kick, T flat), the opponent's follows the round's kind.
- Smash Show: the ring went green within +-60 ms of the due time while the real full-smash window was `0.4 x smashWindow` (as low as ~19 ms for a Por Cuatro off a deep lob), hence "green but missed". The ring is now green exactly inside `smashCore`, and `SMASH_MIN_WINDOW` 90 ms keeps even the hardest smash hittable.
- Camp header: the number beside the fragments was all stars ever earned in trials (they pay the fragments), unrelated to the best stars of the four games; now reads "N EARNED, +F FRAGMENTS AT M" (`nextMilestone`).
- Big draw (16): tree pitch 19 -> 17 so the side switch, boost buttons and PLAY MATCH no longer overlap; the boost block is positioned from the tree bottom.

## v0.139: camp goals (daily and weekly goals from the minigames)
- `src/career/campGoals.ts` (pure, tested in `campGoals.test.ts`; lists and coins in `src/data/campGoals.json`): two goals a day (30 coins each) and two a week (100 each), drawn from a pool (seeded by the day / the Monday, no two of the same kind). Kinds: `trials` (play n), `stars` (earn n in total), `best` (n stars in one trial, optionally in one named game), `perfect` (n three-star trials), `games` (n different games). State in `save.campGoals` (a log of the day's and the week's trials, ids already paid); real days and weeks like the daily tasks (`dayKey`, `weekKey`).
- Deliberately NOT part of the daily tasks / daily bonus: the camp is closed while a tournament is on, so a camp goal could be unreachable and must never hold back the daily bonus.
- A trial counts when its reward is collected (`CampResultScene.collect`). New scene `CampGoalsScene` (progress bars, CLAIM); the camp screen has a GOALS button next to the fragments card, orange when a goal is waiting.
- Not done (owner: later with all the sounds): camp sounds. The star thresholds were judged OK after the owner's play.

## v0.138: owner fixes (Por Cuatro ball, skill points at level 5, new-gear stars)
- **Ball off the screen:** a hard Por Cuatro that bounced and left over the back wall rose to 14 m outside (the coast kept its upward speed). `buildCoast` now also scales the vertical speed when the ball leaves over a fence (`OVER_FENCE_KEEP`) and caps it at 2 m/s up (`OVER_FENCE_MAX_UP`): the highest point outside is now about 4.7 m, in view.
- **Skill points stuck at level 5:** the cap rose every 5 levels but 2 points a level fill 7 attributes faster, so the hero at level 5 had 3 points and every attribute at the cap. `levelsPerCap` 5 -> 3 (cap 6 at level 4, 10 at level 16) and `pointsEarned` is clamped to what the attributes can hold at the top (42), so no point is ever stuck; test: at every level the room under the cap >= points earned. Balance note: heroes are a little stronger at levels 4 to 15 than before (the cap used to bind); `simBalance` / `simEconomy` use the same functions.
- **Gear stars:** a new model (owned, wearable, not yet tapped) now shows a star on its row, on its brand tab (of the six) and on its slot; the star goes when the model is tapped (`isNewItem`, `hasNewInBrand`, `markItemSeen`; opening a slot no longer marks everything seen).

## v0.137: 2D cutscenes, special shots as a portfolio, run-out reworked
- **Cutscenes** (`src/art/cutscenes.ts` pure + tested; `src/scenes/CutsceneScene.ts`, `src/scenes/stageActor.ts`): occasions `tourStart`, `preMatch`, `gameWon`, `gameLost`, `matchWon`, `matchLost`, `champion`, `runnerUp`, `earlyExit`, two variants each (never the same twice in a row), rig-driven big-head actors on a 2D stage (crowd, confetti, rain, spotlight, cup). Always skippable by touch (after 250 ms). `cutDecision(occ, history, mode, rng)`: game scenes always the first 2 times, then 1 in 3; pre-match the first 3 times, then 1 in 2; the rest always; short version (1.5 s instead of 2.6 s) from the 3rd viewing or with the setting SHORT; setting OFF plays nothing. History in `save.cuts` (`n`, `last` per occasion), mode in `settings.cutscenes` (Settings: CUTSCENES FULL / SHORT / OFF).
- **Triggers:** `tourStart` when you enter a tournament from the Calendar (`BracketScene` `{fresh: true}`); `preMatch` at the start of a career match (before the coin toss); `gameWon`/`gameLost` after each game (the pause after a game is kept); at the end of a match `matchWon`/`matchLost`, or when the tournament ends `champion`/`runnerUp`/`earlyExit` (`tournamentEnd(champion, lostFinal)`, `Finished.lostFinal` is new), before the result screen; none after a retirement. Quick matches get the game and match scenes too. `playCutscene(scene, occasion, cast, done)` pauses the calling scene and resumes it.
- **Special shots are a portfolio:** the hero plays EVERY special he has unlocked (nothing expires when a new one unlocks; levels 3, 6, 10, 15). `PlayerDef.specials: string[]` replaces `special` (a CPU player still has one, `cpuSpecial`); `specialsFor(player, state)` lists every one the ball allows (gold buttons at the top of the menu); the CPU picks one at random among those it can afford. `Profile.special` and the USE button are gone (an old save's value is ignored); the HERO > SPECIAL screen shows the portfolio (YOURS / LEVEL n).
- **Run-out reworked** (owner's test):
  - the ball now HANGS in the air at the side wall and the match waits while the RUN OUT! button is up (2.6 s bar, a pulsing ring round the ball); the CPU decides after a beat.
  - the runner runs at an ordinary match pace (about 3 m/s at speed 5, a little faster with speed; slower when tired), no longer 2x; the ball carries on in the same time and comes down by the spot where he meets it, and the timing ring takes it from there (the ball is in the air all the way, never lands and pops up).
  - the meeting spot follows the ball's own path (`buildCoast`: a ball off the glass drifts towards the net), so it is often near the door.
  - **two ways to play it back** (buttons LOB / DOOR while he runs; no touch = lob): the lob over the wall (safe), or flat and low through the opening by the net, only where `doorShot(runSide, contact)` says the angle allows it (the door must look wide enough from the contact point, the line must cross the net inside the posts and land in court); a narrow door is harder to make (`runOutReturn(..., mode, window)`: x (0.45 + 0.4 window) x (0.8 + 0.04 accuracy)).
  - a ball from outside is hard to keep in play: after a made lob the hitting pair gets pressure 0.3, after a door shot 0.4 to 0.7 (above `MAX_PRESSURE` 0.25, so the pair errs more); the door ball is low, fast (22 m/s) and goes to the one of the pair closer to where it lands.
  - Practice Court RUN OUT feeds only parallel/cross Por Tres (a ball down the middle never leaves over the side wall). Tests in `runout.test.ts` (pressure, door vs lob rates, door geometry on both sides).
- **Follow-up after the owner's second test (same v0.137):**
  - The ball outside no longer drops straight down: it carries on along the real physics path (`buildCoast`: the parabola it had off the glass, the fence's speed loss, bounces outside), and the timing ring rides the same path (`timingRing(..., pathAt)`). Because a real ball outside is dead in about 1.2 s, the ball may move up to 2.3x slower than life (it floats a little, like a high lob) and the runner sprints at about 3.8 m/s (`runOutPace`); the runner also sets off for the door while the Por Tres is still in the air (his target is moved towards the door for that flight), so he is by the door when it hangs.
  - `runOutPlan` decides before the hang whether the ball can be reached (hitting height 0.5 to 1.4 m outside the wall, in his half, ring closing as he arrives); if not, no RUN OUT! button and the point is simply lost. The ball is kept at most 6 m from the centre line (the screen ends there).
  - The meeting spot now comes from the ball's own path (near the door, z about 12 near side), so the DOOR shot is offered ("wide angle") in the browser checks; it was never open before.
  - A clean touch on the ring now nearly always gets the ball back: `runOutChance` with timing is `base x (0.6 + 0.8 q) + (1 - base) x 0.95 x clean` (clean = (q - 0.6) / 0.4 over 0.6), at most 97%; PERFECT is about 97% (before: at most 75% even on green). The DOOR shot is still scaled by the width of the door and accuracy.
- Checked in the browser: hang (ball position identical 0.8 s later), choice buttons, door open (wide angle) and made / missed, speed about 4 m/s peak; a full quick match with the cutscenes (game lost, game won, match won) to the result screen without errors; career pre-match and match-end scenes with history saved.
- Tuning to watch after the owner's play: how often the game scenes show up, run-out and door rates, the pressure after a run-out, special answer chance now that there can be several specials.

## v0.136: running out of the court (out-of-court play)
- **Rule** (FIP, see v0.95): a ball that bounced in the receivers' half and left over a side wall stays in play; the receiver may run out and play it back. In the game that is the **Por Tres** winner (it leaves over the side wall; a Por Cuatro leaves over the back wall and is lost whatever happens). `canRunOut(step)`: a Por Tres winner that is not a rebound.
- **Engine** (`point.ts`, tested in `runout.test.ts`): `RUN_OUT_COST` 3 guts (paid made or not); `runOutChance(p, guts, timing)` = (0.25 + 0.07 x (speed - 5), 0.08..0.6) x (0.7 + 0.3 x guts share) x timing (0.6..1.4; undefined 1), at most 75%, 0 without the guts; `runOutReturn(teams, done, step, rng, timing)`: made = the point goes on with a defensive lob (high, medium, out of the air, zone back) to the hitting pair, which drops to mid-court (vibora, bandeja, volley); the runner's pair at the back; not made = the point stays won.
- **Scene** (`MatchScene.runOutPhase`, from the end of the Por Tres flight, while the ball rolls outside): yours = a big orange **RUN OUT! [3 G]** button for 1.5 s (with a bar), then the run through the opening by the net (z 10.65 near / 9.35 far, x +-4.95) to just outside the wall (x 5.7 near / 6.2 far: as far as the screen shows), the timing ring for the shot outside, and the result: RUN OUT! (the lob flies back over the wall, the runner comes back in through the opening, everybody to their places, the rally goes on with `hitTurn`) or TOO FAR (a lunge; the point ends as before with WINNER!). The CPU and your partner go for it on their own (40% + 8% per speed point). No run-out without the guts.
- **Practice Court:** new situation **RUN OUT** (the opponents at the net smash a Por Tres past you: press RUN OUT!); scoreboard GOT IT BACK / TOO FAR. Your own Por Tres that the CPU gets back counts as IN PLAY, not as a winner.
- Checked in the browser: your run-out (made and not), the CPU's run-out after your Por Tres (Bruno out through the far opening; 1 of 4 made), the rally going on after a made one (the opponents then smashed again); an automated full match without errors.

## v0.135: special shots
- **Four special shots** (`shots.json`, kind `special`, so no ordinary menu, AI pool or test sees them; `SPECIALS`, `baseId` in catalog.ts). Each is a version of an ordinary shot (`base`: its stroke, sound, look, daily counts) with the same ball rules, much stronger and much dearer:
  - **Sky Rocket** (Por Cuatro, 6 G, level 3): like a Por Cuatro but off any high ball out of the air at the net or mid-court (no short lob needed); harder to answer (`answerMul` 0.5).
  - **Venom Vibora** (vibora, 6 G, level 6): dies on the side glass.
  - **Corner Lock** (bandeja, 5 G, level 10): into the back corner (`edgeX` 4.3, deep, dead).
  - **Freeze Drop** (dejada, 5 G, level 15): stops dead behind the net.
  Measured (scripts, level-1 hero vs the default CPU, own situations): winners 75-86% (their base shots 0-2%, the Por Cuatro off a short lob 86%), errors 4-10%. Against a 9/9 defence only the Sky Rocket still gets through.
- **They can be answered:** a special that would win can be got back by the defender (`specialAnswerChance`: 0.05 x (defence + speed - 8), at most 40%, times his guts share; none below `SPECIAL_ANSWER_COST` 3 guts, which he pays). The ball comes back under the heaviest pressure; never as a Por Cuatro rebound winner or an early-take fumble. The scene calls it SAVED!. About 13% of specials vs the default CPU.
- **Who has one:** the hero the one he chose (`Profile.special`, null = the first unlocked; `heroSpecial`, `unlockedSpecials`; **HERO > SPECIAL** screen, `SpecialScene`: locked / USE / IN USE, link to the Practice Court); a level-up that unlocks one shows a gold card on the result screen. CPU players and partners with attributes averaging 5+ (`cpuSpecial`: the special of their best of power / spin / technique / accuracy; `withSpecial` in MatchScene for the partner and the opponents). The CPU goes for it 45% of the time when the ball allows and it has the cost plus 3 guts in reserve (`SPECIAL_USE`).
- **In a match:** the special is the gold button at the top of the shot menu (RISKY when the guts are short); aim as usual, timing ring for the overhead ones, then the **cut-in** (`specialCutIn`: the court dims, a gold band for your pair / red for the opponents sweeps in with the player's live picture winding up and the shot's name; 1.25 s, a touch skips), then the shot. CPU specials get the cut-in too.
- **Practice Court:** every special the ball allows is offered (gold) whatever the level. EXIT left the court shot menu (GO TO MAIN MENU is at the top); a menu of 10-12 buttons is a little flatter to stay on the screen.
- Development builds expose `window.__shots` next to `window.__game` (automated checks). An automated quick match (bot taking every special, tapping rings on time) ran to the end without errors: 133 shots, 29 rings, 6 specials.

## v0.134: timing ring in matches, Practice Court
Owner (26.11): keep both halves of Serve & Return; do the cutscenes (lean: one system, ~2 variants per occasion), the special shots with run-out, and a training field to test them. Order: ring + Practice Court (this), special shots, run-out, cutscenes.
- **Timing ring on key shots** (`ShotDef.timed`: the four serves, vibora, bandeja, Por Tres, Por Cuatro). Your own shot only (the CPU and AUTO stay neutral): after the choice of shot and aim the ball comes to the racket (down from above for an overhead, dropped and up off its bounce for a serve), a ring closes on it, touch anywhere (`MatchScene.timingRing`; the hero loads the smash meanwhile; PERFECT! / GOOD / LATE / MISTIMED flashes). Engine: `ringWindow` (150 + 6 technique + 4 accuracy ms), `ringQuality` (1 in the inner 40%, 0.3 at the edge, 0 beyond or no touch), `timingEffect(q, serve)`: risk x(1.3 - 0.6q), attack x(0.94 + 0.12q), serves x(0.97 + 0.06q); q 0.5 = neutral. `HitOptions.timing`, `stepServe(..., timing)`, `resolveServe(..., timing)`. Measured (level-1 hero vs the default CPU): Por Tres winners 59% AUTO / 76% clean / 35% mistimed; hard serve aces 1.8% / 4.8%, faults 18% / 12%. A first version (x1.12 attack) was too strong (88% Por Tres winners, 23% aces) and was halved. **Settings > TIMING: RING / AUTO** (`settings.timing`, default ring). The ring makes matches a little easier for a good timer: watch the career difficulty.
- **Practice Court** (title: PRACTICE, bottom row with COLLECTION and SETTINGS; `MatchScene` with `practice: 'court'`): pick a situation, play the shot again and again; nothing counts. Situations (`src/game/practice.ts`, `SITUATIONS`, tested against the engine rules): SHORT LOB (smashes, vibora, bandeja), MID LOB, DEEP LOB (bajadas), OFF THE GLASS, AT THE NET (volley, block, dejada), SIDE WALL (contrapared), YOUR SERVE (sides alternate), RETURN (they serve at you). The shots are the match's own (aim setting, timing ring, flights); the situation's signature shots are green; CHANGE / EXIT. Scoreboard: WINNERS / IN PLAY / ERRORS since the situation was chosen. After each ball everybody goes back in place, guts full. `practicePoint` replaces the old `practiceState` body (the hidden developer Free Practice still works).
- `MatchScene.ringDueAt` is public for automated checks.

## v0.133: Serve & Return kept whole; harder aces; the opponent fights for every ball
- Owner: keep both halves. Sounds later with all the others.
- **Aces rarer:** pressure 0.2 + 0.35 gap / 0.2 body + 0.3 timing + noise +-0.1, ace from 0.9: into the gap on time about one in four is an ace (tested 15-35%), at the body never. Stars unchanged (200 / 320 / 430).
- **No freezing:** the opponent goes for every ball, as in a match. On an ace he runs at the ball's line and dives a step short (`CampHero.dive`: a late stroke with the lunge legs). On the hero's return he moves for it: back for a lob, in and low for a chiquita, across for a drive or a ball off the glass, and volleys it (or the lob overhead); against a winner he gets most of the way and dives. `flyArc` returns its duration (for timing the chase). The drive return now has its own line (down the side).

## v0.132: the walls are a hard limit for the camp players
- A receiver went into the side glass to play a wide serve with his forehand. `CampHero` keeps every player 0.45 m inside the glass (`WALL_ROOM`, `clampX`, in `runTo` and `teleport`), and `stanceFor(ball)` picks where to stand: forehand if there is room between the ball and the glass, else backhand (both the hero and the opponent; mirrored for the front view). Used for the receiver in serve rounds and the hero in return rounds.

## v0.131: no more balls through the net in the camp; serves at one pace
- **Bug:** a CHIQUITA return flew through the net and still scored GOOD +70 (its low arc was drawn below the net top; the score was right, the picture wrong). `flyArc` now lifts any arc that crosses the net so it clears it at 1.1 m (`netClearApex`); arcs meant to end in the net stop at it and are left alone. Covers every minigame.
- **Serve pace:** the opponent's serve flies at the same pace as the hero's (`SERVE_MS_PER_M` 85, was a slow 220). After the choice of return, the ball waits at its bounce for a short beat (450 ms, the ring already closing), then comes on at the after-bounce pace (`AFTER_BOUNCE_MS_PER_M` 115), so the ring's close is still readable. `ReturnRound.closeMs` is gone (the timing comes from the distance).

## v0.130: Serve & Return ball physics after the bounce
- After the bounce a serve **keeps its line** (`rollOn(from, land, toZ)` in camp.ts, tested): straight on in the direction it came, off a side glass like a mirror only if it gets there first (`wall`). Before, it turned towards the receiver after the bounce, which looked like a glass contact. The receiver now moves to where the ball comes (`flyVia`: through the glass point when there is one); an ace runs on to the back glass on its line.
- Return rounds: **OFF GLASS is offered only when the serve is going into the side glass** before it reaches the hero (`returnShotsFor(toGlass)`); a serve at you offers LOB / CHIQUITA / DRIVE (drive fit: flat 0.9, kick 0.6, slice 0.5). The big word says it: "FAST & FLAT · TO THE GLASS" / "HIGH KICK · AT YOU". The ball follows the same straight line (met before the glass, or after it when OFF GLASS is chosen).

## v0.129: Serve & Return made easier and simpler (owner: never hit a ball, too much to read)
- Timing windows about doubled: serve `tossWindow` 170 + 6 technique + 4 accuracy, return `returnWindow` 160 + 6 technique + 4 speed (were ~90/80 base); full quality in the inner 40% (was 30%), 0.3 at the edge. The serve is slower (ball dropped, bounce, hit at 1.15 s, was 0.76 s), the return ball takes 1.3-1.5 s from the bounce.
- **The ring now closes on the ball itself** (follows it, `ringOn`), green in the sweet part, like Timing; before it sat at a fixed point the ball was still flying to.
- The whole screen takes the tap while the ring runs (it was only the court).
- Less to read: **serve** = the receiver stands off-centre and leaves a gap (middle or wide, `openSpotOf` / `receiverX`); "SERVE INTO THE GAP", touch one of three spots, then the timing. No serve kinds, no weakness text. Pressure = 0.25 + 0.4 gap / 0.2 body + 0.3 timing (+-0.08). **Return** = one big word for the serve (HIGH KICK / LOW SLICE / FAST & FLAT) and three answers: LOB / CHIQUITA / OFF GLASS (drive and the spot effects dropped).

## v0.128: Serve & Return (replaces Serve Zones), trophy tooltips
- **Serve & Return** (camp game id still `serve`, so best scores carry over; 6 rounds, stars 200 / 320 / 430). Rounds alternate, sides change every two rounds (`lane()`); the opponent is a second `CampHero` seen from the front (`CampHero` takes `{ key, front }` now; `makeAppearance` exported from tournament.ts).
  - **Serve rounds:** the receiver's weak spot and the serve he dislikes are told (`receiverOf`); the player picks FLAT / KICK / SLICE and one of three spots in his box (MIDDLE / BODY / WIDE, `serveSpotAt`), then hits the padel serve as the ball comes up off its bounce (ring; `tossWindow` 90 + 6 technique + 5 accuracy ms, `tossQuality`). `serveOutcome`: fault risk by serve (flat riskiest, wide adds) and timing; pressure = 0.2 + 0.22 weak ball + 0.22 weak spot + pair bonus (kick wide, flat body, slice middle) + 0.2 timing + noise: ACE 100 / WEAK RETURN 70 / RETURNED 30 / STRONG RETURN 0 / FAULT 0. The receiver reacts (misses an ace, pops up a weak return, drives a strong one back).
  - **Return rounds:** he serves (`returnRound`: kind and spot); the ball comes in slow motion to its bounce, the serve is named (FLAT & FAST / KICK: JUMPS HIGH / SLICE: LOW, SKIDDING · DOWN THE MIDDLE / AT THE BODY / OUT WIDE), the player picks LOB / CHIQUITA / DRIVE / OFF GLASS, then hits on time. `returnResult` = 100 x `returnFit` (kick -> lob, slice -> chiquita, flat -> off the glass; wide helps the drive, body hurts all but the glass) x timing quality (`returnWindow` 80 + 6 technique + 4 speed).
  - The owner will compare the two halves and pick one (or keep both).
- **Career, LAST TROPHIES:** a touch on a cup shows a bubble with the tournament and the season ("REGIONAL OPEN WARSAW / CHAMPION · SEASON 1"), gone after 2.6 s. `lastTrophies` returns the season too.

## v0.127: Target Practice easier
- Stars 220 / 340 / 440 -> 160 / 260 / 350 (owner: too hard at level 5-6). Serve Zones redesign proposed to the owner (receive the opponent's serve and pick the return, or score the serve by the pressure it puts on the receiver); waiting for the choice.

## v0.126: UI fixes after the owner's review
- **Title:** the "x played x won" line is gone (the spot is used for the locked-button flash message only); COLLECTION and SETTINGS are centred as a pair.
- **Shop, BOOSTS:** each button shows a drawn icon of the item (`src/art/boostArt.ts`: isotonic bottle, gel sachet, grip tape roll, balls) on a disc, what it gives (`short`: "+2 MAX G") and the price with a coin; the names are gone (the bag line below still names what you hold).
- **Career:** the map takes the room the events leave (112-176 px, a 6-event week gets the shortest); event rows 45 px. LAST RESULTS removed; **LAST TROPHIES** instead: the cups of the last titles (champion entries of the history matched to cups by name, `lastTrophies` in cups.ts, tested), newest first, up to six, 32 px, one row (hidden when there is none). Note: history keeps only the last 12 tournaments (`HISTORY_LIMIT`).
- **SKIP THIS WEEK** asks first (ConfirmScene, event `skip-confirmed`): "You sit this week out: no tournament, no entry fee. The calendar moves on and this week's events are gone for good."

## v0.125: week map on the Career screen, minigame countdown, tap-the-spot aim by default
- **Career screen (CalendarScene):** the week's tournaments on a compact map card (touch: the full Map screen with the other weeks); the map is shared code now (`src/scenes/weekMap.ts`: `drawWeekMap(scene, events, card, compact)`, `courtColour`), MapScene uses it too. Event rows are slimmer (44 px) with a dot in the court colour, matching the map; RANKS and the partner (`WITH <NAME>`) moved into the season card; LAST RESULTS shows as many as fit (a 6-event week fits on 640 px).
- **Minigames:** a 3, 2, 1, GO! countdown (with the game's description) before the first round.
- **Aim:** tap-the-spot (`settings.aim = 'point'`) is the default now. Saves from before v0.125 move to it, unless the player chose in Settings (`settings.aimPicked`, set by the AIM toggle). The directions mode stays in Settings.

## v0.124: camp after the owner's second test: Smash Show, moving targets, animated hero
- **Read the Glass is gone** (owner: "na razie" - maybe later in another form; the v0.123 logic is in git history).
- **Target Practice:** the zone moves across, in depth or on a slant at a **steady speed** of its own each round (`Zone.move = { dir, amp, speed, phase }`, `zoneAt` is a triangle wave: constant speed, turning at the ends), faster and smaller as the rounds go; judged where it is when the ball lands. Stars 220 / 340 / 440.
- **Serve Zones easier:** zone r 1.25 -> 1.0, steady 0.7-2.4 m/s (was a fast sine). Stars 200 / 320 / 420.
- **The hero is animated in every minigame** (`src/scenes/campHero.ts`, `CampHero`): the match rig (glides, strokes, the jumping smash), run cycle (profile for a long run sideways) and side-step shuffle, split step, breathing / lean / squash from bodyDynamics, the head follows the ball, a fist pump after a great shot. Timing: he moves to a new spot each round, split-steps as the ball comes, loads forehand or backhand, hits on the tap.
- **New minigame Smash Show** (`smash`, 6 rounds, stars 300 / 520 / 720): the lob's meeting point is marked (short / mid / deep), the player picks POR TRES / POR CUATRO / VIBORA (tags GOOD / RISKY / SAFE ...), the hero runs under the lob and loads the smash, taps as the ring closes. Logic `smashRound`, `smashWindow` (110 + 8 power + 6 technique ms, times the fit of smash to lob: x4 off a deep lob 0.25), `smashResult`: inner 40% of the window = out of the court (x3 140, x4 165) or a Vibora winner (110), with the real flights (buildFlight winner: the ball leaves over the fence / glass), a big "POR TRES!" / "POR CUATRO!" call, flash and shake; rest of the window = back in play off the glass (60..30); beyond = net. `MinigameScene.hitDueAt` is public for automated checks.

## v0.123: camp minigames reworked after the owner's test
- **Read the Glass** is now a call: the ball flies in slow motion (x2.2) to its bounce in the hero's half, the shot and its spin are shown (FLAT SHOT / VIBORA ... · TOPSPIN LIGHT / HEAVY, SLICE, FLAT; the ball turns with the spin), the player picks LOW / MEDIUM / HIGH for the rebound off the back glass, the flight goes on and shows it. The class follows visible cues (`glassCue`: pace and steepness at the bounce plus spin; limits 0.95 / 1.73 give about a third each), the flight is built with that rebound class (`glassFlight`). 100 right, 40 the neighbouring class, 0 low vs high; 6 rounds, stars 330 / 450 / 560. Shots: flat shot, bajada fast, vibora, bandeja, lob, bouncing deep (6.8-8.8 m) so they reach the glass; spin x0.4-1.7.
- **Serve Zones:** the zone moves across the box (or in depth), faster each round (`Zone.move`, `zoneAt`); the serve goes at the touch and is judged where the zone is when the ball lands. Stars 150 / 260 / 360. Bug fixed: the ball of the last round stayed on the court (hidden at every new round now).
- **Timing:** every ball differs (`timingRound(hero, round, rng)`): flat and fast, a lob, or a curling ball with spin, from another place, the hero somewhere else; the window scales with the ball's time. Finer scale (`timingPoints`): 100 within a fifth of the window, then 90 down to 10 at its edge (GREAT / GOOD / OK), 0 beyond. Stars 380 / 540 / 680.
- **Target Practice:** the shot choice is gone (it changed nothing); a redesign is proposed to the owner (see the reply of 25.11 and the plan).

## v0.122: training camp screens
- Career (Calendar) in a week without a tournament: TRAINING CAMP (tries left) next to SKIP THIS WEEK.
- `CampScene`: week and tries, Gear Pack fragments bar, total stars, the four minigames (description, rounds, star thresholds, best stars, PLAY; PLAY uses a try via `startTry`); with no tries left: "+1 TRY: WATCH AN AD" (once a week) or "come back next week".
- `MinigameScene` (`{ game }`), on the match's court art and camera (`applyHd`, arena texture, net strip, toon hero from the back): target practice (shot buttons: flat shot, lob, dejada; drag a ring on the far half, release to hit; the ball lands with the hero's real spread `landShot`; a miss goes into the glass, side wall or net), serve zones (lanes alternate, the service box outlined, outside it a FAULT), read the glass (a far hitter's real flight into the near back glass stops at the glass, the player taps on the near half, the flight goes on, the real spot and the distance are shown), timing (the ball comes in, the ring closes, green inside the perfect window, a tap anywhere). Popups with points, QUIT ends the try with the score so far. Pointer positions use world coordinates.
- `CampResultScene`: stars, score, thresholds; COLLECT or "x2 COINS: WATCH AN AD" (`finishTry`), then the reward (coins, boost, fragments, a completed pack with OPEN PACKS) and BACK TO CAMP.
- `src/ads.ts`: `RewardedAd` interface, `stubRewardedAd` (grants after 350 ms), `setRewardedAd` for the release SDK.
- Not yet: daily / weekly facts for the camp, star thresholds of glass and timing tuned on the owner's play, sounds of their own.

## v0.121: training camp logic (no screens yet)
- Owner (25.11): the 3D look of `/proto/three.html` is dropped (a later realistic version would be Unreal or Unity, a separate stage after the 2D release); the 2D game is finished and released first. Minigame logic now, the screens later.
- `src/career/camp.ts` + `src/data/camp.json` (pure, `camp.test.ts`): `Profile.camp` (`CampState`: tries of the career week "season:week", extra tries from a rewarded ad, best stars per game, total stars, fragments, paid milestones; `sanitizeCamp`).
  - Tries: 3 per week (`campNow` refills on a new week), +1 per week for an ad (`grantExtraTry`); open only with no tournament in progress (`campOpen`, `canTry`, `startTry` uses a try at the start).
  - Rewards (`finishTry`, free pool only): coins = 70 x share by stars (0 / 15 / 20 / 25%, x2 with the ad), on 3 stars a 50% chance of a basic boost (isotonic or gel) if the bag has room, fragments from star milestones (3, 8, 15, 25 stars, then 5 every 10 stars), 10 fragments = a Gear Pack (added to `inventory.packs`).
  - Games: `targets` (zones shrinking towards the lines, `targetZone`, `zonePoints`, the ball lands through the match's spot-aim spread `landShot`), `serve` (zones in the service box, `serveZone`, a ball outside the box is a fault, `serveLanding`), `glass` (a hard ball into the near back glass, the player taps where it will be played, `glassRound` / `glassAnswer` via `buildFlight`, `glassPoints`), `timing` (a closing ring, window from technique and accuracy, faster each round, `timingRound`, `timingPoints`). Star thresholds in `camp.json`; targets and serve checked with perfect centre aim: accuracy 5 gives 3 stars in about 20-25%, accuracy 9 in nearly all. Glass and timing to be tuned when the screens exist.
- Next: `CampScene` (week view, tries, best stars, fragments), the four minigame screens, `MinigameResult` (stars, reward, ad buttons through a `RewardedAd` stub), the career entry (a week without a tournament: CAMP next to SKIP WEEK), daily / weekly facts.

## 3D prototype page (proto/three.html), not part of the game yet
- Owner (25.11) is considering 3D characters and match, plus short 3D cut-ins between events. Decision gate: this prototype, published at `/proto/three.html` (third Vite input; `three` 0.170 added as a dependency, only this page imports it).
- `src/proto/three/arena.ts`: court and arena from the game's own measurements (`walls.ts`: back walls glass 3 + mesh 1, side wall segments, the two openings, net), court colours from the city theme, stands with an instanced crowd that can cheer, ad boards, light towers. Court metres map to three.js as `P(x, z, h) = (x, h, z - 10)`.
- `player3d.ts`: toon characters from simple solids (big comic head, outline by inverted hull, 3-step toon gradient), the same `Appearance` as the 2D game; a small skeleton of groups posed from `Pose3D` (joint angles); poses for strokes, smash in the air (take-off left leg), landing, split step, reactions, celebration, trophy; run cycle. Hip height comes from the leg geometry.
- `rally.ts`: CPU vs CPU points with the real engine (`pickServe`, `stepServe`, `pickHit`, `stepHit`, scoring) and the real flights (`buildFlight`, `ballPoint`), actors run to the hit point, swing (track of poses with snap, hit-stop, follow-through), jump for high balls, split step, never turn their back on the net when running back.
- `main.ts`: broadcast camera, a live slow-motion close-up on a winning smash, reactions after each point, and cut-ins with 2-3 random variants each: tournament intro, before the match (pairs / face-off), game won, game lost, match won, tournament won (cup), second place (silver cup), early exit; letterbox bars, titles, tap to skip. FPS counter.
- Headless (software GL) runs at ~10-12 FPS, which says nothing: measure on the owner's phone.

## v0.120: no "OUT n%" label
- The owner tested the spot aim (v0.119): fine; the out-chance label over the ellipse is not wanted (the ellipse colours stay).

## v0.119: aiming at a spot, real spread and real misses
- Owner (25.11): with the spot aim every ball went in, even tired, a lob right at the glass. Causes: the rolled landing point was clamped to the court; the error was a separate roll that did not depend on where the ball fell; tiredness hardly changed anything; the ellipse was 0.6 x 0.9 m.
- `targetSpread` (court.ts): base 0.9 m across, 1.3 m in depth (triangular, either way) times accuracy (1.6 - 0.12 x accuracy, 0.5..1.45), tiredness (from half the guts bar down, up to x2 on an empty one), the incoming ball's pressure (1 + 1.5 x pressure), the shot (0.8 + speed/50; a lob x1.3 in depth; dejada 0.7). `targetSpreadFor(hitter, state, shot)` in point.ts, the scene draws the same.
- `targetLanding` no longer clamps a miss: past the back line (10 m) = straight into the back glass, past a side line = side wall, under 0.35 m = net; `stepHit` turns such a hit into an `error` with that `errorKind`. In spot mode the side-wall `edgeRisk` and the old `targetRisk` are not added (the geometry decides); the skill error roll stays.
- Ellipse = the real spread; it turns orange from 5% and red from 15% out chance (`targetMissChance`, analytic) and shows "OUT n%".
- Measured (4000 hits each, Dani vs Bruno/Ines, back formation): lob fresh: middle 6%, (3.5, 8.5) 7%, corner (4.3, 9.2) 22%, corner on 10% guts 48% errors; bounce shot corner tired 51%; bajada fast corner tired 80%. Winners like-for-like (same defender): spot vs directions within a few points (cross 24% vs 25-28%, parallel 16% vs 18%); an earlier "62% winners" was a measuring mistake (target on the weaker defender's side with the parallel direction's attack).

## v0.118: no jump when a ball comes off the glass towards the net
- A hard ball (bajada fast and others, after the back glass with a high/mid rebound) could fly back past the receivers towards and even over the net before the point where it was played; `clampHit` then moved the hit point back to 0.5 m from the net, so the last step of the path jumped 1 to 2.7 m (it looked like a drop of half a metre or a metre in the TV view). `SimOpts.playZ` (from `buildFlight`): the hit window of `simulateAfterBounce` ends before the ball leaves the receivers' half on the net side, so the player (at the net) takes it out of the air there. Checked over 16,200 rally flights (both sides, all rally shots, positions, glass on/off, rebound classes): 77 jumps before, 0 after; no hit point above 2.7 m.

## v0.117: aiming at a spot hits the spot
- Bug in v0.116: the tap used `pointer.x/y`, which are in the canvas's resolution (`HD_SCALE` 2, the camera zooms it), so every point was read twice as far from the top-left corner (a tap left of the middle could land on the right, a tap deep in the court near the net). Now `pointer.worldX/worldY`. Checked in the browser: a tap deep on the left gives target (-4.6, 8.2 m) and the ball lands there (with the accuracy spread). Note for other scenes: use world coordinates for pointer positions.
- Kept as before: a weak lob (forced by pressure, `nextBall` sets `landDepth`) still falls short of the chosen depth; the x is kept.

## v0.116: aiming at a spot (test mode, switchable)
- **Settings > AIM:** `settings.aim` 'directions' (default, as before) or 'point' (testing). Switch any time; the owner tests 'point' and decides later which one stays.
- **Point mode** (`MatchScene.showTargetMenu`): after choosing the shot the heat map of the opponents' reach is shown (without the three direction markers); touching the opponents' half shows a ring and an ellipse of the likely spread (colour = reach there), dragging moves it, letting go hits. Shots with a fixed target (smash x3/x4, rulo) keep the old menu. The direction passed to the engine (attack, risk, hesitation) is the one whose usual landing point is nearest to the spot.
- **Engine:** `HitOptions.target` {x, depth}: `targetLanding` (court.ts) rolls the real landing point around it (triangular, `TARGET_SPREAD_X` 0.6 m, `TARGET_SPREAD_DEPTH` 0.9 m at accuracy 5, scaled by `aimSpreadMul`, tiredness included); `targetRisk` adds error risk for a spot right behind the net or at the back glass (side walls already have `edgeRisk`); reach is measured at the rolled point; the defender nearer to it plays the ball. Without `target` nothing changes (CPU, directions mode, tests).
- `unproject` in `camera.ts` (screen -> floor), tested.

## v0.115: Por Cuatro always leaves over the back glass
- A winning Por Cuatro (`exitVia: 'back'`, not `reboundBack`) went out sideways in ~7% of cases (low, through a side opening, after a sharp diagonal from a corner) and over the hitter's own half in ~4% (the fallback "any exit" in `buildFlight`). Its aim is now straightened so that the ball's line meets the back wall within `X4_BACK_X` 3 m of the middle (`buildFlight`, after the ±2.6 m clamp). Checked over 1404 flights (both sides, hitter x -4..4, 3 depths, landX -4.5..4.5): 100% over the back glass, `reboundBack` unchanged. Visual only (the engine's result does not depend on the path).

## v0.114: characters stage D, emotions
- **Reactions after a point** (`reactToPoint`, ~0.4 s after it ends or when the ball has stopped): the winner of the point pumps a fist (`fistSteps`), his partner a smaller one; a pair standing within 3.4 m slaps hands instead (`highFiveSteps`, the hand on the partner's side, a star at the hands, `slapFx`). The player who made the error or double fault holds his head, then drops his shoulders (`frustrationSteps`); the other losers drop their shoulders (`disappointSteps`), an exhausted one puts his hands on his knees (`tiredSteps`). `MatchScene.react` (not over a stroke; sets `reactUntil` so a plain return to ready does not cut it).
- **Celebrations:** a game won: rackets up and a hop (`celebrateSteps(false)`); the match: both arms up, two jumps, the losers hang their heads.
- **Fatigue:** `tiredness` (below a third of the guts bar, 0..1): the ready pose is lower with the head down (`tiredReady`), breathing deeper and faster (`stepBody(..., tired)`).
- **Eyes on the ball:** `Rig.setLook` turns the head towards the ball (eased, in steps of 0.5) while a player waits; not in a stroke, run or reaction.
- **Face:** `PoseSpec.mood: 'sad'` (front view: frown, brows up in the middle) in the losing reactions.
- Note: in the front and back views `lean` tilts the body SIDEWAYS; a forward bend is shown by the hips (`crouch`) and a lowered head (`head`).
- `Rig` keeps the raw pose apart from the look and head lag it adds (`raw`), so a look does not stick.

## v0.113: characters stage C, footwork and contact
- **Lunge** (`lungePose` in rig.ts): a run longer than `LUNGE_FROM_M` 2.4 m ends in a lunge (full 2.4 m further): front foot planted out on the run's side, knee over it, back leg stretched from its hip (worked out from the leg length), hips low, body leaning in. A ball the defender cannot reach (winner, ace) always ends in a full lunge. `MatchScene.planLunge` / `lungeOf` (direction in the picture's own x, mirrored for the front view); the stroke keeps the lunge's legs until the recovery (`withLegs`, `strokeSteps(..., legs)`).
- **Ball height:** `forHeight` bends the knees and lowers the racket for a low ball (below 0.75 m), stretches up for a high one (above 1.2 m); used for the prep (`loadPose(name, height)`), the arrival pose and the stroke; `MatchScene.hitHeight` from `flight.hitH` (1 m for a ball off the back glass). Serve: low.
- **Split step** as a pose sequence (`splitSteps`: feet together in a small hop, landing wide and low, ready) with a 7 px jump, for the receiving pair when the opponent hits (not while they are running). The old `hop` is gone.
- **Contact:** the ball stays on the racket for `HIT_STOP` + 60 ms before it flies (not on a serve; the flight and its impact effects start that much later); `hitFlash` at the racket: a flash for every hit, plus a ring and sparks for hard shots (speed / smash).

## v0.112: characters stage B, the rig in the match
- **Live rig** (`src/art/rig.ts`, tested): `Rig` per player builds the pose every frame: `to` (glide with easing), `play` (a sequence of steps), `drive` (follows a changing pose: run and shuffle cycles, smoothed with a 45 ms time constant); the head trails the racket hand (`PoseSpec.head`). `loadPose` (wind-up beyond the prep pose; the smash is loaded on the left leg), `strokeSteps` (60 ms ease-in snap to the hit pose, 50 ms hit-stop, overshooting follow-through, settle, ready), `smashSteps` (in the air after a take-off from the LEFT leg with the right knee up, landing on the left foot first). `poseSignature` decides when a picture must be drawn again; `racketEnds` feeds the smear.
- **MatchScene** draws each player into his own `CanvasTexture` (`rig:<id>`, 0.55 px/unit near pair, 0.42 far pair) in `drawRig` when the pose signature or the view changes; `stepRigs` (from `update`) has a budget of `RIG_BUDGET_MS` 6 ms per frame, players take turns. The pose textures, `prewarmPoses`, `warmQueue` and `blendTo` are gone. Run / shuffle phase follows the distance run (`RUN_CYCLE_M` 1.7, `SHUFFLE_CYCLE_M` 0.9) instead of a clock. A smash is a real jump (`jump`: 24 px, 330 ms, quick take-off, slower fall) with a small camera shake; the serve is a forehand stroke without a jump. Measured in headless Chrome: ~1.4 ms per picture, ~1.3 pictures per frame in rallies.
- **Pose fixes (owner's review):** seen from behind, an arm whose hand crosses to the left half of the body is in front of it (hidden by the torso), override `PoseSpec.front`; front view: `racketBehind` puts the racket of an over-the-shoulder follow-through behind the head. `bhFollow` now ends over the RIGHT shoulder (it ended over the left one and looked like hands on the back). `smashHit`: left leg straight down, right knee up. `ovFollow` (bandeja/vibora) cuts across to the left side. Run cycle: `runFrame(frame, profile)`: profile with a long stride, foot in the air only on its way forward (it moved backwards in the air before), heel kick, knee drive, arm pump; front/back view with knees driven up in turn and arms pumping up and down. Shuffle: the lifted foot now moves the way the player goes.
- `proto/rig.html` shows "before (v0.111)" against the game's rig (it uses the same `rig.ts` sequences).

## v0.111: characters stage A, weight and momentum
- `src/art/bodyDynamics.ts` (pure, tested): per player springs for lean (into the run, back when braking: `LEAN_PER_SPEED`, `LEAN_PER_ACCEL`, max 0.24 rad), squash and stretch (volume kept), step bob, breathing when idle; `runEase` is the run's position curve (trapezium speed: 18% accelerating, 30% braking) replacing `Sine.easeInOut` in `movePlayers` (same durations, so the engine timing is unchanged).
- MatchScene `update` -> `stepBodies` measures each player's feet on the screen (metres via `p.scale`), steps the body and re-places the sprite (`placeView` applies rotation about the feet, scale and bob). Kicks: crouch before a chaser starts, stretch on a hit, take-off/landing on the smash hop. `brakeDust`: two sand puffs when a fast run stops.
- Measured in a rally: lean up to 0.25 rad, scaleY 0.95..1.07, ~14 hard stops.
- **Stage B prototype: `proto/rig.html`** (`src/proto/rig.ts`, second Vite input, published at `/proto/rig.html`). Top panel = today's animation (pose pictures, 3-step `blendTo`, run frames every 62 ms, sine glide); bottom = the same toon rebuilt every frame from keyframes: anticipation (wind-up beyond the prep pose), ease-in snap, 50 ms hit-stop, overshooting follow-through, racket smear, body springs, continuous run cycle with a braking pose and dust, smash with a load, a real jump arc and a knee-bending landing, waiting with toe bounce and head following the ball. Clips: run + brake, forehand, backhand, smash, waiting; slow motion; hero (back) / rival (front) view.
- `PoseSpec.head` (optional shift of the head, lerped by `mixPose`) for head lag.
- Cost measured on desktop Chrome: 0.38 ms to build + draw one figure. In the game a live rig would mean a canvas texture per player re-uploaded each frame (or a cache of quantised poses); to be measured on a phone before deciding.

## v0.110: the hero's side of the court
- `Profile.heroSide` ('left' | 'right', default left), `heroLane`, tested. Default is set on the HERO screen (row "I PLAY ON THE", the stat rows are 4 px tighter to make room); `makeSideSwitch` in `theme.ts` is the shared switch.
- Before every match: the tournament pre-match screen (BracketScene) has the switch; a quick match has it on the coin-toss panel (it restarts the scene; not offered in tournament matches because the match's boost is consumed when the scene is created).
- MatchScene: `HUMAN_IDX` is now a variable set from the profile; `TEAMS[0]` is `[partner, hero]` when the hero plays on the right; the team label, the first server (`serverIdx`) and the guts boost use it. The hero still walks to the serving lane for his serve (first serve from the left lane) and back.
- Free practice (hidden) uses the same side.

## v0.109: lobs never win by themselves, TROPHIES on HERO (on top of v0.107 trophy cabinet)
- One cup per city + division of the calendar (35, `CUPS` in `career/cups.ts`): gold for a title, silver for losing the final (not for a withdrawal before it). Stored in `Profile.cups` (`CupShelf`: gold/silver counts, last season) and `Profile.cupClaims`; filled in `careerFlow.finish`, which returns `cup` and `cupBonuses` (also in the ResultScene payload).
- Challenges (`src/data/cups.json`): golds of a whole division, of a region (cities) or a number of different golden cups (10 / 25 / 35); **only gold counts** (owner's choice). Each pays coins + gear/premium packs once.
- Art: `src/art/cupArt.ts` draws a cup procedurally (shape by division tier, gold/silver/locked metal, ribbon in the city's court colour, emblem per city from `cups.json` `symbols`); paint it inside `bakedShape`.
- `CupsScene` (title menu TROPHIES): 3x4 grid per page, grey until won, tap for details, SETS view with progress, button to ACHIEVEMENTS (the old trophies screen, now titled Achievements). ResultScene shows the cup and the first set bonus.
- HERO screen has a TROPHIES button (the cabinet and achievements go back to HERO when opened from there).
- Lobs (v0.108 first tried "never a winner when in reach", `LOB_OUT_OF_REACH`; replaced in v0.109): **a lob is never a winner by itself** (`resolveHit`, `LOB_APEX` 3). The reach is measured from where the defenders stood when the ball was hit, but a lob (plus bounce and glass) takes 2-4 s and they are running meanwhile, so the owner saw lobs into a corner score while the opponent was already there. A good lob still builds pressure (`pressure` of the next hit); points come from the answering mistakes. Lob flight time adds up to `REACH_LOB_TIME_MAX` 1.6 to the reach (heat map). CPU sim: rally_lob winners 4.7% -> 0%, average rally 6.3 -> 6.7 hits, 13% -> 16% rallies of 12+.
- Cups of tournaments won before this version are not recorded.
- Ball leaves a side wall inwards (por tres fix from v0.106.1).

## v0.106: lag at the coin toss, CPU pause, hero gender, letterbox colour
- Coin toss: the coin is two pre-rendered textures (`ensureCoinTexture`), not shapes tessellated every frame.
- Pose warm-up is a queue (`warmQueue`, `runWarmQueue` from `update`): about 4 ms of drawing per frame, essential poses first. `blendTo` no longer draws in-between pictures during a rally (it queues them and skips the step). `toonPoseKey` tells whether a pose texture exists.
- `CPU_DELAY` 56 -> 28 ms, partner/opponent next-hit delay halved (it was ~0.12 s in total already; ball flight speed is unchanged, ask the owner if they meant that).
- Hero gender: `Profile.gender`, `heroLook`, `withGender`, `HERO_DEFAULTS` (players.json `heroDefaults`: Dani/Thunder male, Lena/Blaze female). MALE/FEMALE buttons on the HERO screen; a default name follows the gender, a custom name stays.
- The dark band above the scoreboard is the letterbox of phones taller than 9:16 (FIT scaling). The page background now takes the colour of the arena's top edge and of the command panel during a match (`paintLetterbox`). A real taller logical height would need a layout pass (not done).
- Por tres fix: a ball that meets a side wall almost along it (after the back glass) now leaves it with at least `SIDE_MIN_INWARD` 1.4 m/s inwards (`ballPath.ts`), so it no longer drops straight down along the glass and looks outside the court. Shot sim unchanged.
- 385 tests.

## v0.105: reach step 2 (time of flight) and the real positions of the players
- **Real positions**: `HitOptions.positions` (`ReachPositions`: both defenders and the hitter). `reachAgainst(..., at)` measures the reach from where the players really stand; without `at` (CPU simulation, tests) it still uses the places of the formation (`restPos`). `MatchScene.reachPositions()` passes `this.pos` into every `stepHit` and into the reach hints, so the engine and the screen no longer disagree about who is "in reach" (the suspected cause of "the opponent seemed to have it and did not play it").
- **Time of flight** (`court.ts`): `flightTime(speed, apex, dist)` (an arc counts at least its free-fall time) and `reachTimeFactor` = (t / 0.8)^0.35 kept in 0.8..1.3 scale the defender's radius: a slow or high ball can be run down, a hard flat one cannot. Without a hitter position the run is assumed `REACH_DEFAULT_RUN` 16 m. First tries (exponent 0.6, 0.7..1.5) shifted shots too much (volley winners 8% to 15%, bajada_slow 19% to 9%, dejada 7% to 2%).
- **Retuned `winnerMargin`** so the winner rates are back near the old ones (CPU sim, default teams): volley 28 (8.3%), bounce_shot 26 (12.3%), bandeja 22 (20%), bajada_slow 26 (20.7%), dejada 24 (6.9%), bajada_fast 62 (11% winners, 25% errors, cross vs net still below 40%). Vibora 47% winners (was 41%). Average rally after the serve 6.3 (default teams), 8.0 (even 4v4).
- Tests: time factor, a defender away from his formation spot, a far hitter gives more time.

## v0.104: Hard Glass serve, weekly dot on the Daily screen, reach heat map
- **Hard Glass**: new `ShotDef.aceMargin` (default `ACE_MARGIN` 48), `aceMargin 56` and `pressureMult 0.8` for hard_glass. Aces when the receiver bounces: 20% to 3% (with the CPU's receive choice 5% to 1%); the hero wins 67% to 65% of in-serves and 28% to 23% of those points end within 2 hits (the other serves are 22-25%).
- **Daily screen**: the WEEKLY CHALLENGES button gets the same pulsing red dot as the main menu when `weeklyWaiting`.
- **Reach hints** (`drawReach(shot, aim)`): the red circles around the opponents are replaced by a heat map of their half, baked once into a texture (`bakedShape`, 0.34 m cells, alpha 0.42): green = a gap, yellow = stretched, red = within reach (`reachAgainst` per cell). The landing markers stay.

## v0.103: harder opponents each round, vibora, CPU shot choice, one tournament summary, less CPU work per frame
- **Tournament difficulty** (`toughen` in `tournament.ts`, `roundBonus 0.45` in `divisions.json`): the hero's opponent in round r gets +0.45 x r attribute levels (whole part to every stat, the rest to a fixed share of them); the field's own ratings spread +-0.8 (was +-0.5). Average opponent rating by round, regional: 4.4, 4.9, 5.5, 6.0 (it was flat); the top divisions saturate near 10.
- **Vibora**: flight speed 27 to 22, side spin 1.3 to 1.9.
- **Lob cross check**: a lob is never a winner by itself (0% in all formations); points after it come from the CPU's reply. The CPU used to pick the fast bajada (30% error) as often as safe shots, so replies to lobs ended in errors ~9%. `pickHit` now scales shot weights by `max(0.35, 1 - risk x 2)` (`RISK_AVERSION`), ~6-7% now. The case "the defender seemed in reach but did not play it" could not be reproduced in the logic; the engine takes the defender's position from the formation spots (`restPos`), not from the real positions on screen, which can differ (see reach step 2).
- **Result screen** after a tournament: one card with PRIZE (placing), MATCHES (n) and TOTAL (coins, XP), then the level bar. `rewardRow` got `left` and `gap` options.
- **Lag** (coin toss, shots): Phaser triangulates every Graphics again on every frame (earcut was ~4 ms/frame on desktop). `bakedShape` in `theme.ts` paints a shape once into a RenderTexture (HD_SCALE x pixels, `repaint` for changes). Used for themed buttons, the match control sheet, scoreboard, games boxes, guts bars and the match menu buttons. Headless software-GL run: frames in 9 s 95 to 155, earcut and Graphics renderer time ~240 ms to ~16 ms. Other scenes still use plain Graphics cards (not time critical); texture uploads (texImage2D, ~2 ms/frame) remain.

## v0.102: bajada fixes, tournament bracket as a tree
- **Bajada winners** (`noReboundBack` on bajada_fast and bajada_slow): the ball no longer comes off the back glass and returns over the net. `buildFlight` damps the back-wall rebound (`backDamp` in `simulateAfterBounce`, tried 0.7 down to 0.08) until the ball stays at least 1.5 m beyond the net on the receiving side. A rare exit through a side opening near the net remains (still on the opponent's side).
- **Bajada balance**: high speed `winnerMargin` 32 to 56, low speed 24 to 30. Vs players at the net (hero at the back, `ignoreRequires`): fast was 67/75/80% winners (parallel/cross/middle), now 65/20/39%; vs mid-court players 64/16/55 now 12/0/1; errors unchanged (33/25/20%). Slow vs net 68/8/38 now 43/0/19. Parallel stays high against net players (reach floor). Test: cross vs net below 40%.
- **Bracket view** (`BracketScene.drawTree`): the list of pairs is replaced by a tree, one column per round, winners move right, the hero's path and slots are orange, unplayed rounds are empty boxes; names are shortened (`Orte/Duar`) so 16 pairs fit 360 px.

## v0.101: por tres / contrapared fixes, dejada balance, GEAR stats, coins open the shop
- **Contrapared** is only played off the glass: `requires.formations` is `["back"]` and `buildContrapared` clamps the wall hit to `CONTRAPARED_GLASS_END` (16.4 m), so never off the mesh.
- **Por tres** (smash_x3): `winnerMargin 8`, `noReboundBack`. Every winning por tres uses `scriptedSideExit` (bounce, back glass with spin, out over the side glass). Strongly level dependent (5v5 ~69% winners, 5 vs 7 ~0%).
- **Nothing lands on the crowd**: `OUTSIDE_LIMIT` in `ballPath.ts`; `buildCoast` keeps the ball within ~3 m outside the court (`OVER_FENCE_KEEP`). Leftover fixed in v0.115 (smash_x4 exits).
- **Dejada**: the reach model had pushed it to 83-91% winners vs back defenders; `winnerMargin 30` now gives ~49% vs back and 6-14% vs mid.
- **GEAR**: stats table (real totals incl. gear) next to the hero; tapping a model previews the change (green/orange deltas), WEAR/REMOVE button on the row wears it. The set text moved above the sheet (no longer hidden).
- **Coins**: tapping the coin pill on any screen opens the shop (`coinPill` in `theme.ts`; not in the shop, not during a tournament). The shop's back button returns to the screen it was opened from.

## v0.100: reach of the defenders and shots hit from above
- **Reach (engine, `court.ts`, `point.ts`, `engine.ts`):** the defenders now have a reach. `reachRadius(speed)` = 2.2 + 0.14 x speed (about 2.9 m at speed 5). The ball comes down at (landX, nominal depth); `reachGap` is the distance to a defender at his rest place (`restPos`, depth counts 0.6), `reachFactor` keeps his whole defence within 0.5 radius and takes it down evenly to 0.55 at 1.5 radii (`REACH_*` constants). `reachAgainst` (in `point.ts`) takes the nearer defender; a lob never goes below 0.75; fixed-aim shots (smash x3/x4 over the fence, rulo) are 1. `resolveHit` multiplies the defence by `reach` (new optional `HitInput.reach`). Serves are not affected.
- **Balance** (`scripts/simShots.ts`, CPU against CPU, 20k points): average rally after the serve 7.6 to 5.2 hits (default teams), 8.3 to 7.3 (even teams); the CPU aims at gaps, so it uses the reach too. Constants were tuned with a grid over base, per speed, full, far, min and depth weight; the rally got shorter by about a third. Step 2 (reach from the time of flight: speed x time) is still to do.
- **Aiming UI** (`showDirectionMenu` in `MatchScene.ts`): `reachMap` / `drawReach`: the opponents' comfortable reach is shown as soft red areas on the court and each direction has a marker where it lands: green = a gap (the opponents keep under 75% of their defence), yellow, orange = right at them (97% or more); the direction buttons are tinted the same way (green / white / orange). Not drawn for fixed-aim shots.
- **Shots from above:** `ShotDef.downward` (volley, dejada, bajada fast and slow, bandeja, vibora, smash x3 and x4). New poses `fhv*`, `bhv*` (racket raised before the shoulder, the stroke ends below the hand: volley, dejada, bajada) and `ov*` (overhead on the ground, no jump: bandeja, vibora); the smash jumps as before; the hop now only for smashes and serves. Players at the net wait in the volley poses. Bajada is now hit from above too (still from the side of the ball).
- **Flight:** a downward ball that the opponent takes out of the air (net block or air take) lands `DOWNWARD_CARRY` = 1.1 m behind his place (`ballPath.ts`), so it comes down steeply at his feet: a volley from 1.6 m used to be taken at 0.86 m (belly height), now below 0.65 m; the ball's arrival height for such a block is 'low' (`point.ts`), a flat fast ball is still 'mid'.
- Tests: reach (factor, speed, middle and short balls, lob floor), downward flights, block heights; the pair balance test is looser (0.38 to 0.62; the left player has always hit about 43%).

## v0.99.1: rest after a game
- `GAME_BREAK_RECOVERY_MUL` = 2 (`engine.ts`): the recovery after the last point of a game (the "set" of the owner's talk; a match is first to 2 games) is doubled: 4 guts at stamina 5 instead of 2 (still scaled by stamina and by the hero's recovery bonus). Used in `endPoint` of `MatchScene.ts` when `awardPoint` reports `gameWon`.
- **Finding for the reach discussion (not changed):** the engine has no spatial reach. `resolveHit` compares the attack score with the defender's stat-based defence; the aimed landing point (`landX`, depth) only adds edge risk; the "gap in the set-up" is used by the CPU to choose an aim point but does not change the defence. So a ball aimed into an empty corner is defended exactly like one aimed at the defender. See the proposal in the chat of 2026-11-24 (reach by distance of the aim point from the defender).

## v0.99: side-step shuffle and a head that follows the ball
- `PoseSpec.look` (-1..1, in the picture's own sideways direction): the head (and the hair behind it) turns up to 7 degrees and shifts 5 units (`headGroup` in `character.ts`; front and back views; `mixPose` blends it). Not in the profile view.
- `shuffleFrame(frame, dir, look)` (`SHUFFLE_FRAMES` = 4): a low, wide stance, feet alternately lifting and moving in the direction, a small lean, racket in front. Used by `movePlayers` for every non-chaser who moves more sideways than forwards (`setShuffleFrame`, `shufflePose`: the front view is mirrored, so directions and look flip there); `lookToward(id)` turns the head towards the ball when it is more than 1.3 m to the side. Everybody else (and forward or backward moves of non-chasers) still uses the run cycle in the team view.
- `prewarmPoses` also draws the shuffle pictures (4 frames x 2 directions x 3 looks per player).
- Tests: shuffle frames differ by frame, direction and look; `mixPose` blends look.
- **Still to do for 3b:** braking and lunge when a chaser stops, squash and stretch, crossing hands in the run cycle, a 3/4 view for diagonal runs, the head follows the ball also in a standing ready pose and in profile.

## v0.98: players keep their eyes on the ball; split step
- **Facing while moving** (`movePlayers` in `MatchScene.ts`): only a *chaser* (a player with an end pose, i.e. the one who is going to hit, or the defender in `chaseBall`) turns to run (profile for sideways, front or back otherwise). Everyone else (partner covering, pair returning to its places, hitters following their shot, formation changes) shuffles in his team's view (face to the court and the ball) and never turns his back on it. New optional parameter `chasers: string[]` (default: the ids in `endPose`).
- **Split step:** when a rally ball is hit, both opponents hop 5 units (`hop`) 40 ms later if they are idle.
- Known limits: the head does not turn towards the ball (front and back views have a fixed head); a near-team player facing the net while the ball is behind him (a lob that bounces over him) still faces the net.
- **Still to do for 3b:** braking and lunge when a chaser stops, squash and stretch, crossing hands in the run cycle, a 3/4 view for diagonal runs, a head that follows the ball.

## v0.97: less work per frame (lag on a phone, Motorola Edge 60 Pro)
- **Measured** (headless Chrome, CPU profile and per-frame timers; the GPU of a phone cannot be measured here): per frame the match re-drew Phaser `Graphics` that are triangulated on the CPU (earcut): 4 player shadows, the ball shadow and ring, 14 trail circles, 4 rounded guts bars (3 to 4 shapes each); it redrew and re-uploaded the 96 px ball texture every frame; and pose textures were drawn lazily in the middle of a rally (about 2.5 ms each on a desktop, 3 views now).
- **Fixed:** shadows, ring and trail are pooled images of tiny flat textures (`ensureFlatTextures`, `SHADOW_KEY`, `RING_KEY`, `DOT_KEY` in `hdTextures.ts`); the guts bar is drawn around its own origin and only redrawn when the width changes (`barShown`); the ball picture is redrawn at most every 50 ms; `prewarmPoses` draws all poses of the team view and the run cycle (team view and profile) two per 16 ms tick during the coin toss; `powerPreference: 'high-performance'`.
- **Result:** logic time per frame in a match about 3.2 ms down to 0.9 ms (after the prewarm), no vector shapes triangulated per frame. Render submit time (about 5 ms headless) is unchanged.
- **If it still lags:** next suspects are GPU fill rate (the 720x1280 canvas, full-screen alpha layers, the additive ball glow), text objects, and the number of textures (about 180 in a match); try `HD_SCALE` 1.5 for a test, and look at `chrome://inspect` remote profiling on the phone.

## v0.96: profile view for sideways running
- `ToonView` now has `'side'` (profile, facing right): `buildSide` in `src/art/toon/character.ts`, built from the same `PoseSpec`s as front/back (stride from the ankle offsets x2, knees bend forward, near arm with the racket, far arm and leg shaded, racket narrowed and tilted up when held in front so it does not cover the face, all hair styles, band, cap, wristband, skirt).
- `toonViewOf` in `MatchScene.ts` returns `'side'` for facing left/right; `showSprite` mirrors the front view and the profile when facing left. `movePlayers` already sets left/right facing for mostly sideways moves, so runners are shown in profile; they return to the team view when they stop. The rulo already turned the player sideways and now shows the profile too.
- Tests: all hair styles in all three views, profile differs from front/back. Pose sheet: `npx vite-node scripts/poseSheet.ts you:0 side /tmp/side.html`.
- Not done (next for characters): split step, braking, lunge, squash and stretch, racket follow-through variants, crossing hands in the run cycle, a 3/4 view for diagonal runs, prewarming the profile textures.

## v0.95: real openings in the side walls (replace the v0.94 "door")
- **What a real court has** (FIP Rules of Padel, 2026 edition, and the LTA court guidance; summarised on padel-rules.pages.dev): access is in the **side** walls, never the back walls, symmetric about the centre, one or two per side, with or without a door. Single: 1.05 to 2.20 m wide, 2.00 to 2.20 m high. Double (each): 0.72 to 1.10 m wide, same height. Without a door a beam or duct lies on the floor in the opening; handles are outside; posts and the net post are padded (at least 2 cm). Out-of-court play (tournament courts, two openings per side, free space outside at least 3 m deep and 4 m either side of the net, 3 m high): a ball that **bounced in the receiver's half** and leaves through an opening or over a side wall ("por 3") stays in play: the receiver may chase it until it bounces a second time or touches something outside, and must return it so that it bounces in the opponents' court (over the net, round the net post, touching the net or posts is allowed). Over the back wall ("por 4") the point is lost even then; a ball that leaves without bouncing in the receiver's half loses the point for the hitter. Only one of a pair plays the ball. A served ball that bounces in the box and leaves through a door is a fault on a court without out-of-court play, otherwise the receiver may chase it. Above 0.92 m a player may touch the door post (not the net).
- **Now in the game:** `SIDE_OPENINGS` in `src/art/walls.ts`: two openings per side, z 8.85 to 9.85 and 10.15 to 11.15 (symmetric about the net, net post between), 1.0 m wide, `OPENING_HEIGHT` 2.05 m, in the mesh-only part of the wall; `isSideOpening(z, h)`, `openingsIn`. Drawn in `arenaHd.ts`: no mesh in the opening, mesh above it, a beam on the floor, padded dark-blue posts, the net post stands between the two openings.
- **Ball physics:** `sideWallMaterial` in `ballPath.ts` returns 'out' inside an opening, so a ball that reaches the wall there flies out ('out' event) and the existing code for balls leaving over the fence takes over. In 6048 simulated rally flights none left through an opening (the rally shots do not hit the wall near the net); only a faulted serve can now roll out through one (test `serve faults stay in the court` allows exactly that).
- **Not done (needs an engine design, belongs with the special shots):** the rules above as play: a ball that bounced in the receiver's half and leaves through an opening stays in play; the receiver runs out through the opening, returns it over the net or round the post, and runs back (players, formation, the choice of a shot, CPU behaviour, camera, animation). Today the engine decides every point before the flight is drawn; a ball that leaves through an opening is only a picture. Players still stay inside the court.
- Tests: `walls.test.ts` (openings symmetric, 0.72 to 1.10 m wide, 2.0 to 2.2 m high, in the mesh part; `isSideOpening`).

## v0.94: entrance doors on the court and item pictures in pack opening
- **(Replaced by v0.95: a padel court has open gaps, not doors.)** Doors (visual only): `SIDE_DOOR` in `src/art/walls.ts` (z 11.5 to 12.5, 2.05 m high, in the mesh-only part of each side wall, on the near side of the net); `door()` in `arenaHd.ts` draws a dark gap, bars, steel frame, hinges and a gold latch on both side walls. Physics, ball paths and shots are untouched: the ball treats the door like the rest of the fence. Running out through the door comes with the special shots, after the shot physics, characters and movement are settled (owner's order: physics first, then characters and movement, then special shots).
- **PackScene** shows the item with `drawGear` (rarity colour frame as before). The shop itself only lists packs, so it has no item pictures to change.
- Tests: `walls.test.ts` checks the door lies in the mesh-only segment (358 in total).

## v0.93: real item pictures in the collection
- `src/art/gearArt.ts`: `drawGear(g, item, cx, cy, size)` draws a shirt, shorts, shoes, racket (head shape of the item, strings) or bag in the colour of the item with the accent of its brand (`brands.json` colour 4); `shade` mixes a colour with white or black.
- **CollectionScene**: every tile shows the item. Owned: full colour, tile tinted by rarity with a rarity bar and the bonus under the picture, a WORN tag on the one in use. Not owned: the picture at 36% opacity on a pale tile with its LVL. Tiles are 76 px high now.
- **GearScene** rows use the same pictures (faded when not owned or the level is too low). Slot buttons and the other icons are unchanged.
- Not done: the shop and pack screens still use flat icons; there is no test for the drawing (visual only).

## v0.92: nicknames, editable hero name, retirement wording, XP icon and animated XP bar
- **Nicknames**: `PlayerDef.nick`; data in `players.json`, `partners.json` and `opponents.json` (`nicks`, keyed by first name; `makePlayer` looks it up). `src/game/names.ts`: `cleanName` (safe Title Case, max `MAX_NAME` 10 / `MAX_NICK` 14), `withNick` (`Adam "Anvil"`). Shown in the face-off (two lines, one per opponent), the rival bubble (`rivalTalk` option `nick`), the title plate, the HERO screen and the partner cards. In-court labels and the scoreboard still use first names only (no room).
- **Hero name**: `Profile.name` / `Profile.nick` (defaults Dani / Thunder, sanitized), `heroFrom` applies them. `NameEditScene` (EDIT button on the HERO card): on-screen keyboard plus physical keyboard, first key replaces the old text, Tab/Enter switch fields. The world ranking row uses the hero's name.
- **Retirement**: the walkover wording is gone; giving up a match is "RETIRE" (dialog RETIRE FROM THE MATCH?, result RETIRED, THE OPPONENTS WIN BY RETIREMENT, `retired` flag in `ResultData`, `endMatch(winner, retired)`). The old "games when you stopped" line is removed. The match menu button text is centred.
- **XP icon**: `drawXp` (white star on a blue disc) and `rewardRow` (icon plus amount, centred) in `theme.ts`; used for the tournament prize, the matches row and the HERO and title XP bars.
- **XP bar on the result screen** (`ResultScene.xpBar`): starts at the XP before the tournament and fills (1.5 s) to now; over a level-up it fills, the label flashes LEVEL UP! and it goes on in the new level.
- Tests: `names.test.ts` (357 in total).
- Not done: nicknames in the match HUD; nicknames of the world ranking pairs; renaming the partner.

## v0.91: sounds and the way out of a match
- **Sounds** (`audio.ts`): `coinFlip` (rising glitter at the throw) and `coinLand` (two bright tings) in the coin toss; `type` (a very quiet 18 ms tick) in `speech.ts`, every second letter, not for spaces, pitch varied. `sfx(name, pitch = 1)`; `STYLE` table sets wave and gain per effect.
- **Quick match / practice**: the button says GO TO MAIN MENU, tap twice (SURE?), then `leaveTo` fades the camera to the light menu colour (380 ms) before `TitleScene`.
- **Career match**: before the coin is called the button is TOURNAMENT MENU (back to `BracketScene`, the boost of the match is given back from `inventoryBefore`). After the call it is END THE GAME, which opens `ConfirmScene` (a generic yes/no scene over a paused scene; the answer comes back as an event on the scene underneath) and on YES calls `endMatch(1, true)`.
- **Walkover**: runs through the normal career pipeline (loss recorded, tournament result, daily/weekly facts) but pays no XP and coins; `ResultScene` gets `walkover` and shows FORFEIT and THE OPPONENTS WIN BY WALKOVER; the rival bubble is not shown.
- `over` flag in `MatchScene` stops a second `endMatch`/exit.
- Not done: a forfeit still counts the games played so far only as a display; no penalty beyond the loss and the lost fee.

## v0.90: local rankings and records (world and gamification), ready for online later
- **RankingScene** (button RANKS on the Career screen, next to MAP): tabs WORLD, RECORDS, ONLINE.
  - **WORLD** (`src/career/ranking.ts`): a field of 60 CPU pairs (surname pairs from `opponents.json`, deterministic) whose points follow the season: `SEASON_POINTS` 2200 for the best pair, weaker pairs less (strength 1 down to 0.06), a luck factor 0.85 to 1.15 per pair and season, half carried to the next season (`rankCarry`), earned linearly over the 24 weeks. The hero is inserted by his ranking points; on a tie he is after the CPU pairs (a new hero starts last, #61). The list shows the top 8, or the top 6, a gap and the hero with the pair above and below (`visibleRows`). Retune `SEASON_POINTS` after play (compare the hero's points at the end of season 1 and 2 with the CPU leaders).
  - **RECORDS** (`src/career/recordsView.ts`): 13 rows (matches, win rate, streaks, shutouts, longest rally, most aces and smash winners in a match, titles, ranking points now/best, world position now/best, level). Every row has an `id`; an online board can use the same ids.
  - **ONLINE**: a locked tab with a COMING SOON card. `RankingSource` in `ranking.ts` is the seam: `WORLD_SOURCE` (computed here, `available: true`) and `ONLINE_SOURCE` (`available: false`, `load` rejects). A server version only has to return `RankRow[]` (`pos`, `name`, `points`, `you`) and set `available`; the scene will then need to await `load` (today the world tab reads `worldRanking` directly).
- **Records** (`achievements.ts`) got `bestRank`, `bestPosition`, `maxAces`, `maxSmashes`; `recordMatch` takes them from `MatchScene` (aces and smash winners of the match, ranking points, and the world position when a tournament has just ended).
- Tests: `ranking.test.ts`, `recordsView.test.ts`, records tests updated.
- Not done yet: the data for a server (accounts, anti-cheat, name entry), per-division boards, monthly resets. Needs a decision before the online step: what is uploaded (only records and ranking points, no raw save), and how a player gets a name.

## v0.89: entry fee with a coin icon on the Career screen
- `CalendarScene`: the event buttons show the name on the first line and a centred row on the second: pairs, ENTRY FEE, a gold coin with the amount, and the status (TAP TO ENTER or why you cannot enter). `feeRow` in the scene, `drawCoin` in `theme.ts`.

## v0.88: owner fixes after v0.87 (navy court, talking rivals, coin-toss ball, better map)
- **Court colour:** the brick/orange theme `clay` is now `navy` (a dark navy court, `courtThemes.ts`; `cities.json` updated). Rome, Doha, Riyadh, Paris and Sevilla use it.
- **Rivals talk** (`src/speech.ts`, `rivalTalk`): the rival's head (portrait cropped at the chin, `addToonHead`) with a speech bubble; the line is typed letter by letter (clock-based, 34 ms a letter, so slow phones type at the same speed), the head bobs while he talks. PLAY MATCH in `BracketScene` opens a face-off overlay (`faceOff`: your next opponent, names, head and bubble; the first tap skips the typing, the next starts the match). `ResultScene` shows the after-match line the same way (small head on the left, bubble on the right) between rounds of a tournament.
- **Ball at the coin toss:** the ball sprite and its glow are hidden until `setBall` places them (they showed at full texture size in the top left corner before the first serve).
- **Map:** real coastlines (Natural Earth 1:50m through the npm package `world-atlas`, simplified with Douglas-Peucker 0.1 degrees and clipped to -110..70 E, -45..72 N, `src/data/land.json`, 47 KB; lakes and inland seas are drawn as holes). `worldMap.ts` now has two views: the world, and Europe when every tournament of the week is in Europe (zoom, so neighbouring cities are apart). `placeLabels` puts every city name beside its dot (above, below, right, left, then further away with a leader line) so that no name covers any dot or another name and all stay inside the card (tests for Paris/Brussels/Amsterdam and others). Dots are smaller in the world view (r 5) than in the Europe view (r 7).
- **Entry fee** in the map's tournament list: "ENTRY FEE" with the number and a gold coin icon (`drawCoin` in `theme.ts`). The Career screen buttons still show "FEE 40" as text.
- To regenerate the land data: in a temp folder `npm i world-atlas topojson-client`, take `land-50m.json`, convert with `feature()`, clip, simplify (the script was a 60-line Node file; the output format is `[{outer: [[lon,lat]...], holes: [[...]]}]`).
- Not checked on a device.

## v0.87: weekly challenges, rivals, city arenas, calendar map (world and gamification, steps 4 to 7)
- **Weekly challenges** (`src/career/weekly.ts`, `src/data/weekly.json`, `WeeklyScene`, save field `weekly`): three bigger tasks a week (Monday to Sunday, picked from 10 by the week, distinct stats), 150 coins each, bonus for all three: 250 coins + a gear pack. Same match facts as the daily tasks (`mergeFacts` in `daily.ts` is shared), career matches only. Reached from a WEEKLY CHALLENGES button in `DailyScene`; the DAILY badge on the title screen also waits for weekly rewards.
- **Rivals** (`src/career/rivals.ts`, `src/data/rivals.json`): the first opponent says a short line before the match (`BracketScene`, under the strength comparison) and after it (`ResultScene`, between rounds of a tournament only, where the progress block is empty). The line is picked from the rival's name (stable), so it does not flicker.
- **Arena per city** (`courtThemes.ts`, `arenaHd.ts`): besides the court, each theme tints the sky above the stands, the ground, the LED board, the spotlights and the crowd (fullness and strength). Still dark and calm, as the owner wanted in v0.78. Preview: a throwaway page that calls `renderArena(1, theme)` for every theme (see the git history of this note for the snippet idea: vite dev server plus headless Chrome).
- **Calendar map** (`MapScene`, `src/art/worldMap.ts`, `src/data/cityMap.json`): a stylised 2D world map, arrows move through the 24 weeks, the cities of the week's tournaments are big dots in the colour of their court, with a list below. Button MAP in `CalendarScene`. Rough hand-made continents; replace with better shapes if wanted. A real 3D globe is still a separate decision.
- Tests: `weekly.test.ts`, `rivals.test.ts`, `worldMap.test.ts` (every calendar city has a map position, a theme and a rival line pool).
- Scene screenshots: with `npx vite --port 5199` running and the dev-only `window.__game`, a Playwright script can open a scene (`getScenes(true).forEach(s => s.scene.start('MapScene'))`) and save a PNG.
- Not checked on a device. Retune after play: weekly numbers and rewards, rival lines (English, max 60 characters each).
- Not done yet: minigames between tournaments, local rankings, other audience per city (people, flags), real globe.

## v0.86: the serve ball in the server's hand, in front of the body
- Owner report: at the serve the ball is behind the player. It was put at the server's own court position (inside his body, 0.9 m up).
- `MatchScene.putServeBall`: before a serve (match and practice) the ball is held in the server's free hand: 0.5 m in front of him (towards the net) and 0.4 m to the side of that hand (opposite sides for the hero seen from behind and for opponents seen from the front), at waist height (padel serves are hit low, after a bounce). The pose of the serve preparation is `fhPrep` (racket back, free arm out) instead of the tennis-style `smashPrep` toss pose with the arm up.
- Not checked in a match on a device. The flight of the serve still starts at the server's court position, so the ball jumps about half a metre at the hit; if it looks bad, start `Flight` from the same spot (`ballPath.ts`).

## v0.85: more natural arms and legs (characters and animation, step 2)
- Owner report (after v0.84): arm layout still unnatural, the backhand looked as if the right arm was pulled behind the back, legs bowed out and looked comical; they should run on straighter legs and go a little lower at the hit.
- Reference (tennis, not padel): ready stance = feet a bit wider than the shoulders, knees only slightly bent, racket in front with both hands; running = upright legs; groundstrokes = bend the knees a little more at the hit; two-handed backhand = both hands on the racket, shoulders and hips turn toward the ball and both hands stay on the racket in the follow-through.
- Legs (`POSES`, `runFrame` in `src/art/toon/character.ts`): ankles are about 70 units apart instead of 90 to 100 (no more diamond-shaped knees); crouch: ready 10 (was 22), run 5 (was 16, cycle 2..8), strokes 14 to 20 (was 24 to 28) so the hit is the lowest point of the stroke; leg lift in the run cycle 18 (was 30), swing 13 (was 15).
- Back view layering: an arm that reaches in front of the body (hand lower than the shoulders and not out at the side: ready, run, backhand, across-the-chest arms) is drawn BEHIND the torso and head, so only the part that sticks out at the side shows (`inFrontR`, `inFrontO`). The racket held upright in front is also moved 22 units to the side (`BACK_VIEW_SIDE_SHIFT`).
- Backhand: hand moved out to the left of the body (bhPrep x 54, bhHit x 32); bhFollow keeps both hands on the racket (the free off arm that crossed the chest is gone).
- Check: `npx vite-node scripts/poseSheet.ts you:0 back,front`, then a Chrome screenshot of `/tmp/poses.html`. Not checked in the match on a device. Open: the front view (opponents) was not retuned for arms, only legs; run-cycle arms still cross the chest slightly.

## v0.84: racket in front of the body, seen from behind (characters and animation, step 1)
- Owner report: the hero and the partner (back view) looked like they held the racket behind their back. Cause: in the back view the hands and racket were drawn on top of the torso, i.e. on the back, although the racket is in front of the body.
- Fix in `buildToonLook` (`src/art/toon/character.ts`): when the racket is held in front (`frontHeld`: back view, hand in front of the torso, racket upright: ready stance, run, run frames) the racket arm, racket, hands and the off arm are drawn BEFORE the torso and head (hidden where the body covers them), and the hand is moved 22 units to the side (`BACK_VIEW_SIDE_SHIFT`) so the racket shows beside the body. Swing poses and the front view are unchanged.
- Check: `npx vite-node scripts/poseSheet.ts you:0 back`, then open `/tmp/poses.html`. Not checked on a device: whether the racket is easy enough to see in the ready stance (it is partly behind the head and torso, as in a real view from behind); raise `BACK_VIEW_SIDE_SHIFT` if it hides too much.
- Next: side views for running sideways, squash/stretch, new clips (split step, braking), pre-warming; figure size vs court (question only).

## v0.83: court colours by tournament city (world and gamification, step 3)
- `src/art/hd/courtThemes.ts`: 6 muted court themes (blue = default, teal, green, clay, plum, steel): court surface, slab faces and crowd tones. `src/data/cities.json` maps each of the 24 calendar cities to a theme (balance-like data, change it there); `themeIdOfCity` falls back to blue for sparring, practice and unknown cities. Test: every calendar city is mapped, at least 5 themes in use.
- `renderArena(scale, theme)`; `ensureArenaTextures(scene, themeId)` renders the back picture once per theme (key `hd:arena-back:<id>`, older themes are removed) and keeps one shared net strip. `CareerMatch.city` is set in `BracketScene` from the active event; `MatchScene` picks the theme from it.
- Surroundings (stands, floor, ad strip) stay navy as the owner wanted in v0.78; only the court and the crowd tones change.
- Not checked on a device yet: how the colours look with the ball and the toon characters (clay and steel are the ones to look at first). Not done yet: other audience/surroundings per city, globe calendar, weekly challenges, minigames.

## v0.82: collection screen, brand set bonus, brand packs (world and gamification, step 2)
- **Set bonus** (`setBonusOf` in `career/gear.ts`, `set` stats per brand in `brands.json`): the brand with most equipped pieces gives +1 to its first stat with 3 pieces, +1 to both with 5; it is included in `gearBonus`, so Hero and Gear show it in the totals (Gear also names the set).
- **`CollectionScene`** (button COLLECTION on the title screen): per brand, a grid of 5 slots x 4 models (owned with bonus, worn, or ? with the needed level), set bonus lines, total x/120.
- **Brand packs in the shop:** a brand selector above the packs; a pack of one brand only drops that brand's items and costs +50% (`brandSurcharge` in `packs.json`, `priceOf`). Free level-up packs are never limited. Pity works as before.
- Title screen: stats line shortened, COLLECTION and SETTINGS buttons moved up 2 px. Tests added for set bonus and brand packs (retune the numbers after play-testing).

## v0.81: daily rewards and tasks (world and gamification, step 1)
- `src/career/daily.ts` (pure, tested) + `src/data/daily.json`: login reward on a 7-day streak (coins 30..80, day 7 = 100 coins + a gear pack; a missed day restarts the streak), three tasks a day picked from a pool of 10 by the date (same for everybody, distinct stats), 30 coins per task, 100 coins bonus for all three. Only career matches count (quick match = sparring).
- Save: `daily` field (sanitized). `MatchScene` counts the hero side's winners/aces by shot kind (`countDailyWin`) and `endMatch` calls `addFacts`. New `DailyScene` (claim buttons) and a DAILY badge with a red dot on the title screen while something waits.
- Dates use the device's local day (`dayKey`); changing the clock can cheat it (accepted for an offline game).
- Not done yet: collection screen + set bonus, per-city courts, globe calendar, minigames, weekly challenges.

## Next session (agreed 2026-11-22)
1. World and gamification (plan point 4): start by discussing which item first (daily login reward and daily tasks, collection screen with set bonus, per-city court colours; globe and minigames need decisions).
2. Then characters and animation (plan point 3b): owner reports that the hero and the partner (seen from behind) look like they hold the racket behind their back; they should hold it in front of the body. Probably the back view draws racket and hands behind the torso: draw them in front of it (check with `scripts/poseSheet.ts you:0 back`). Also side views for running, squash/stretch, texture pre-warming, figure size vs court (question only).
3. Graphic tutorial only after the characters are settled (track drawings can come earlier).

## v0.80: three fixes from the owner
- **Ball into the stands:** a ball that left the court over the fence (e.g. `side` error of a bajada) kept flying up to 29 m. Now `buildCoast` keeps 45% of its speed when it clears the fence (`OVER_FENCE_KEEP`) and the air outside is draggier (`OUTSIDE_AIR_DRAG`): it drops within about 4 m. Regression test in `ballPath.test.ts`.
- **Ball glitch after a point:** the ball kept spinning at its launch spin while lying still, and it was always drawn above the players, so it looked stuck on a leg. Now spin on the ground scales with the roll speed, and a ball lower than 0.4 m is depth-sorted with the players.
- **White sheet under the court** is navy now (status text white), matching the arena.

## v0.79: smoother character animation
- `mixPose(a, b, t)` blends two `PoseSpec`s; `buildToon` now accepts a `PoseSpec` as well as a pose name. `runFrame(n)` is an 8-frame run cycle (legs swing and lift, body bobs and leans, arms swing against the legs); `RUN_FRAMES = 8`.
- `MatchScene`: running steps the cycle every 62 ms (`setRunFrame`); strokes glide prep -> hit -> follow -> ready through 3 in-betweens (`blendTo`); end of a run blends to ready. In-between pictures are cached textures (key from the blend), made on first use.
- `scripts/poseSheet.ts` also prints the run frames. Not done yet: side views, squash/stretch, texture pre-warming (watch for hitches on a phone).

## v0.78: calmer surroundings
- Owner: the light court is good, but the light surroundings distract. Stands, ground and vignette in `arenaHd.ts` are now mid-dark navy again (court stays light blue), spotlights and crowd softer.
- Open questions from the owner: toon animation looks stiff (see plan doc), figure size vs. court (is it too small?), and whether to build the graphic tutorial before the final character look.

## v0.77: phase 5a, lighter arena
- `src/art/hd/arenaHd.ts`: daylight stands (light sky, softer crowd bokeh and spotlights), light studio ground, lighter court blue, much weaker vignette, navy menu strip under the court. Court geometry unchanged.
- Next (5b): graphic tutorial (plan point 9); optional per-city court colours (plan point 4).

## v0.76: phase 4b, toon characters in the match
- `MatchScene` now draws the toon characters (`ensureToonPoseTexture`, `placeToonSprite` in `src/art/toonTexture.ts`); textures have no baked shadow (`buildToon(..., shadow=false)`), the scene draws it.
- New `src/art/pose.ts` holds `Facing`, `PoseName`, `Stance`, `poseOf` (was in the old pixel code).
- Retired the old pixel character code: `art/character.ts`, `characterTexture.ts`, `hd/characterHd.ts`, `character.test.ts`.
- No profile views: runners keep their team's front/back view. Front view is mirrored in the match so everybody is right-handed.
- Next: phase 5 (lighter court/arena, graphic tutorial); possibly real side views.

## v0.75: toon poses redone from photos of pro players
- The owner sent reference photos (forehand, backhand, smash). Lessons used: wide base and deep knee bend in every stroke, the racket held in front of the body (both hands in the ready stance), the free arm out or up for balance, smash side-on with the free arm pointing up at the ball and the racket behind the head.
- New pose `idle` = the old relaxed arms-down pose (default of `buildToon`, so the title, Hero, Gear and Partners screens are unchanged); `ready` is now the athletic match stance. All other poses retuned in `POSES` (`src/art/toon/character.ts`).
- Check with `npx vite-node scripts/poseSheet.ts you:0 front,back` then open `/tmp/poses.html`.

## v0.74: scoreboard centring, guts bar under the hero's name
- Scoreboard rows (names, games boxes, points, serve dot) were 5 px too low in the navy bar; now centred (rows at y 18 and 38 of a bar that spans 5 to 51).
- The hero side's guts bar sat on its name label; it is now 18 px below the label's top (was 13).

## v0.73: serving order and scoreboard names
- **Serving order fixed.** After a game the code flipped the serving player of the team that was about to serve, so the hero's second-game turn came before his first (Lucy served first in the hero's pair when the CPU won the toss). Now the team that has just served hands its next service game to its partner, and each team starts with its first player: the hero serves first in his pair.
- **Scoreboard** shows the pair names instead of YOU / CPU: opponents on the top row (`Bruno/Ines`), your pair below (`YOU/Lucy`), the same order as on the court; the serve dot follows the server. Long names are shrunk to fit.

## v0.72: toon poses (phase 4a, not yet used in the match)
- `buildToon(appearance, view, pose)` now takes a pose with the same names as the old pixel characters (`ready, runA, runB, fhPrep/fhHit/fhFollow, bhPrep/..., smashPrep/...`; `TOON_POSES`). A pose is a `PoseSpec` in `POSES` (`src/art/toon/character.ts`): racket hand + racket tilt, off hand (or `'grip'` = on the racket handle for the two-handed backhand), lean of the upper body about the waist, crouch (negative = jump) and the two ankles. Arms and legs are two-bone limbs solved from those targets; sock and shoe follow the ankle. Default pose = ready (unchanged look).
- `VIEW` (the picture frame) is bigger now (x -80..280, y -130..346) so a racket held high or swung wide fits; `addToon` and `addToonHead` use it, nothing changes on screen.
- Only front and back views exist. The racket is always on the viewer's right (so a far-team player in front view holds it in his left hand: a known quirk, same as the title screen).
- `npx vite-node scripts/poseSheet.ts you:0 back` writes `/tmp/poses.html` (all poses of one character) for a visual check.
- Tests: all poses in both views and all hair styles, every pose differs from ready, hand and feet stay in the frame.
- Still to do in phase 4: left/right (side) views for running sideways, per-pose texture size (use a smaller TEXTURE_UNIT for the match: 4 players x ~10 poses x 2 views), swapping the toon characters into `MatchScene` (names, guts bars, shadows, scale and camera for the bigger figures), then removing `character.ts` and `hd/characterHd.ts`.

## v0.71: new look, step 3 (match interface)
- **MatchScene HUD** now uses the broadcast theme (`src/theme.ts`): TV scoreboard (navy bar, a row per side with games in a white box and points in gold, orange dot by the server, DEUCE note; in Free Practice it shows the mode instead), a light control sheet under the court (y 392 and down) holding the status line and the buttons, themed MENU button (tap twice to leave), button cards coloured by tone (white normal, green good fit, orange poor, red RISKY, grey off), navy-outlined guts bars and name labels, Baloo/Nunito for the announcements (WINNER!, FAULT, POWERFUL SMASH banner), coin toss texts, big HIGH/MID/LOW BALL text and the receive screen (km/h, SPEED and SPIN pills, countdown bar).
- Logic untouched (state, shots, serve receive). Court, arena and the old pixel characters are unchanged until phases 4 and 5.
- Depths: sheet 8000, buttons 9100-9102, announcements 9995, scoreboard 9990-10000.
- Checked in headless Chromium: toss, serve menu, rally menus, receive decision, announcements, Free Practice. Not checked on a phone; the direction menu and the second page of the practice setup use the same `showButtons` code.
- Next: phase 4 (toon characters in the match: run, forehand, backhand, smash poses and sizes on the court).

## v0.70: worn gear shows on the title screen and the Hero screen
- Title and Hero drew the hero from the base appearance; now both use `applyLook(HERO.appearance, profile.inventory)` like Gear and the match. Verified in headless Chromium (equipped shirt and shorts change the title hero's colours).

## v0.69: minus buttons on the Hero screen
- Every stat row has a `-` button next to `+` (`unspend` / `canUnspend` in `profile.ts`, test added). It takes one skill point back (never below the start value, 4) and frees the point; RESET POINTS still takes everything back.
- The coins and XP the owner saw on the hero are real earnings from earlier career matches kept in the browser's save (quick matches pay nothing since v0.62). They are not a bug. Settings > RESET SAVE (tap twice) wipes the whole save, profile included.

## v0.68: fix: a faulted serve no longer flies off the glass into the net
- **Cause:** `buildCoast` (the ball's free flight after a fault or error) took its start velocity from the last two samples of the flight. For a serve fault of kind `long` (and some wall balls) the flight path ends with a tiny "snap" segment that moves the ball to the hit point in one frame, so the fake speed was 30+ m/s. The ball left the back corner at that speed, crossed the court and hit the net at up to 18 m/s.
- **Fix:** the start velocity is now the median-speed segment of the last three, which ignores a snapped last segment (`src/art/ballPath.ts`). Worst net-hit speed after a serve fault: 18.5 → about 5 m/s. Wall physics itself (glass restitution 0.76, mesh 0.3, speed-dependent normal restitution in rallies) was checked and is fine: after every wall hit the ball is slower than before.
- **Tests:** two regression tests in `ballPath.test.ts` (no serve fault hits the net faster than 8 m/s; a coast never leaves faster than its flight plus 8 m/s of gravity gain, for every shot, fault/error and error kind). The first fails on the old code.
- **Tool:** `scripts/simFault.ts` (`npx vite-node scripts/simFault.ts`) prints end-of-flight speed, speed after the walls and net-hit speed for each serve and fault kind.
- Not changed: fault kinds and their probabilities. Check on the phone that faults now look calm; if the ball still feels too lively off the glass, lower `GLASS_E` or `GLASS_KEEP`.
- Next: phase 3 (match UI in the new look).

## v0.67: new look, step 2 (all menu screens) + Spanish/English names
- **Names**: players, partners and opponents renamed to Spanish/English names (display names only; ids and stats unchanged, so saves keep working).
- **Phase 2 done**: Hero (stat rows with bars, gear bonus in orange, level-cap shading), Gear (slot tiles beside the hero in the toon look, brand tabs and model cards in a sheet below), Partners (tiles with head portraits, rating, four bars, action button in a footer), Shop, Packs, Calendar, Bracket, Result, Settings, Tutorial and Trophies all use `src/theme.ts`. Game logic untouched. Only the Match scene (and the old pixel characters in it) still has the old look.
- New helper `addToonHead(scene, cx, top, width, appearance, view, heightFrac)` in `toonTexture.ts` (portrait crop of the toon texture).
- Dev server only: `window.__game` is exposed in `main.ts` so screenshot scripts can start any scene (`g.scene.start(name, data)`).
- Screens were checked in headless Chromium at 360x640 (no page errors). Hero, Gear and Partners were adjusted after the first look; the other screens got only one pass, so expect small spacing tweaks after a look on the phone.
- Next: **priority 0 bug** (ball after a serve fault bounces off the glass and hits the net fast), then phase 3 (match UI).

## v0.66: new "broadcast" look, step 1 (theme, toon characters, new title screen)
The owner chose style **E** from the mock-ups (light sports-TV look: navy outlines with a hard offset shadow, rounded cards, orange/blue accents, Baloo 2 + Nunito, characters about 4.5 heads tall with flat cel shading, Mario-Tennis-ish cartoon, not "jelly"). Details and the migration plan: `docs/STYLE.md`. Mock-ups: row E of https://claude.ai/artifact/S7BKaxH2Wxz9Kv8nwzVFTM .
- **`src/art/toon/`** (pure, no Phaser): `ops.ts` (path ops, `drawOps` via Path2D, `toSvg`, colour helpers), `character.ts` (`buildToon(appearance, 'front'|'back')`; so far only the ready pose; hair styles, skirt/shorts, headband, cap, wristband, racket shapes all supported; women drawn 10% narrower), tests in `toon.test.ts`. `src/art/toonTexture.ts` has `ensureToonTexture` and `addToon(scene, x, feetY, bodyHeight, appearance, view)` (the only Phaser part).
- **`src/theme.ts`**: palette `TC`, fonts, `themeText`, `applyLightScreen`, `makeThemeButton` (primary/blue/secondary), `drawCard`, `drawBar`, `coinPill`, `screenHeader`, `drawStage`, `iconChip`. Fonts are npm packages (`@fontsource/baloo-2`, `@fontsource/nunito`, imported in `main.ts`), so the game stays offline-capable; `BootScene` waits for them (`loadThemeFonts`).
- **`TitleScene`** redone like the mock-up (title bar with coins, hero on a stage with a name plate showing level and XP, CAREER button, four tiles, SETTINGS). Free Practice is still behind `SHOW_FREE_PRACTICE`.
- **Not converted yet** (still the old dark look, so the game is temporarily mixed): Hero, Gear, Shop, Packs, Calendar, Bracket, Partner, Result, Settings, Tutorial, Achievements, and the whole Match scene. The old pixel-grid characters (`src/art/character.ts`, `hd/characterHd.ts`) are still used everywhere except the title screen.
- Next steps are in `docs/STYLE.md` (phases 2 to 5).

## v0.65: direction buttons side by side; medium lob (more vibora and bandeja)
- **Direction menu layout.** The three directions are in one row in the order the ball goes on the screen, BACK alone below (`showButtons(..., 'directions')`). From the left-hand player (idx 0, the hero) it is PARALLEL, MIDDLE, CROSS; from a right-hand hitter it would be CROSS, MIDDLE, PARALLEL (so left is always left). Same in free practice.
- **Medium lob (new `LobQuality` 'medium').** The owner found vibora and bandeja too rare (0.4% of hits in the CPU simulation: they need a high ball out of the air, which only a weak lob gave, and the smash was offered then too). A lob is now deep 55% (bounces; bajada after the glass), medium 25% (lands 5.8 to 7.4 m from the net, played out of the air, the receiving pair goes to mid-court) or weak 20% (smash), from a high or mid ball deep 75%, medium 15%, weak 10% (`LOB_*` constants in `point.ts`, `mediumDepth` per shot optional). A medium lob offers vibora and bandeja, not the smash (the smash still needs a weak lob). Simulation: vibora 2.9% and bandeja 2.4% of hits (together 13 times more than before), rally 7.6 hits (was 7.2), smashes 2.7% (was 4.2%), bajada 7.6% (was 9.1%). Raise `LOB_MEDIUM_CHANCE` if they should be even more frequent. Not checked on a phone: the ball hit out of the air after a medium lob uses the existing weak-lob animation (`airHit`).
- Practice mode: the WEAK LOB toggle still means a weak lob only.

## v0.64: balance pass: shots, serve receive, career pace
Tools (all CPU-driven, rest positions, no gear; see the header of each file): `scripts/simShots.ts` (rally length, shot shares, winners and errors), `scripts/simReceive.ts` (receiver's results per serve for AFTER BOUNCE vs WAIT FOR THE GLASS), `scripts/simEconomy.ts [edge] [seasons] [runs]` (career pace: the player plays the best event he can enter every week, spreads points evenly, buys the best partner he can; env `XPS`, `CS` scale XP and coins as what-ifs), `scripts/simBalance.ts` (fatigue, divisions), shared loop in `scripts/simCore.ts`.
- **Shots (no number changed).** Avg rally 7.2 hits (default teams), 7.9 (even 4), 9.0 (even 7). Volley 13% of hits with 6.7% winners, dejada 4% with 17% winners and 11% errors, smashes 61-73% winners, bajada_fast 17% winners but 32% errors. Fine, left as is. Vibora, bandeja and contrapared are only 0.1-0.2% of hits because they are rarely available (a high ball in the air from mid-court or the back only comes after a weak lob, and the smash is offered then too); the CPU now favours them x3 when it can play them (`NICHE_WEIGHT` in `ai.ts`).
- **Serve receive.** The choice matters only when the serve is much stronger than the receiver: at equal levels AFTER BOUNCE and WAIT FOR THE GLASS give identical results (no ace is possible, the pressure never decides). With a gap, it works as intended: against `hard_glass` (28 m/s) AFTER BOUNCE gives aces in 42% of the points against 19% when waiting, and the receiver wins 43% vs 45%; against the slow `t_serve` (19 m/s) taking it off the bounce is better (52.5% vs 49%). The CPU receiver now uses this too (`pickReceive(..., shot)`: waits for the glass from 26 m/s, takes the ball early up to 20 m/s). Open idea: make the choice matter at equal levels too (e.g. the pressure of the serve could also decide in even matches).
- **Partners need a level** (`minLevel` in `partners.json`: olek 1, lena 3, tomek 6, marco 9, mia 12, kasia 15, sofia 18, ivan 21, diego 24, ana 27; the partner screen shows `LEVEL n` until then; `buyPartner` checks it). Reason: prizes bought the strongest partner (Ana, 9000 coins) around season 3 at level ~11, which made the lower divisions trivial.
- **XP curve slowed:** `xpBase` 300 to 600 (all XP, prizes included, counts half as much; the level formula is `xpBase * (level-1)^1.5`). Simulated pace for a player who plays a bit better than the CPU AI (edge 0.5, 24 weeks per season, one tournament a week): level 6 after season 1, 11 after 2, 16 after 3, 20 after 4, 26 after 5, 30 (and the top division) in season 6, so about 144 tournaments or 25 to 30 hours. A player as good as the AI (edge 0): level 30 in season 7. Before: level 30 in season 3.
- **Top prizes trimmed** (coins of the title): p2 3800 to 2900, p1 5500 to 3200, major 9000 to 4500, finals 6000 to 3500. Reason: nothing to spend that much on (all partners cost 27750 together). The coins still pile up in the simulation (about 40000 in season 5, packs are not modelled), so **watch the coin flow in play** and use the shop (more things to buy, packs per brand) as the sink rather than cutting prizes further.
- Not touched: attribute caps (`capBase` 5, +1 every 5 levels), division level gates, gear levels. With the slower XP the hero reaches them later, which fits the new pace. Gear bonuses are not in the simulation: if the final divisions turn out too easy in play, look at gear first.

## v0.63: result screen of a quick match shows no sparring text
- The `SPARRING / NO XP, COINS OR ACHIEVEMENTS` line added in v0.62 is removed (the owner finds it redundant): the quick-match result shows only YOU WIN / YOU LOSE and the games. Behaviour unchanged (still no XP, coins, stats or achievements).

## v0.62: quick match is a sparring; Vibora only on high balls; weaker Lena
- **Quick match changes nothing:** no XP, coins, played/won/lost stats, records or achievements (`MatchScene.endMatch` only calls `updateSave` for career matches). The result screen of a quick match shows `SPARRING / NO XP, COINS OR ACHIEVEMENTS` and no level bar. The title screen's PLAYED/WON/LOST line now counts career matches only.
- **Vibora is offered only on a high ball** (was mid and high), like Bandeja (`heights: ['high']` in `shots.json`, still only out of the air from mid-court or the back). Tests and GDD updated. Balance not re-tuned for this: Vibora is used less, watch the length of rallies and the smash/bandeja share.
- **Partner Lena (200 coins) weakened** from all 5s (avg 5.0) to avg 4.4 (technique, stamina, defense 5, the rest 4), so buying her at level 3 is no longer a big jump; the CPU-driven hero still wins about 64% in Regional with her. Tomek (450) is the next step at 5.1.

## v0.61: balance: opponents share the work evenly; first divisions harder
- **Uneven fatigue (reported in play): fixed.** Cause found with a CPU-vs-CPU simulation (`scripts/simBalance.ts fatigue`): the CPU plays ~85% of its balls down the middle, aimed at the centre line, and ties were resolved in a fixed order (`gapX` in `ai.ts`, nearest aim point in `court.ts`, and `landX < 0 ? 0 : 1` in `stepHit`), so those balls always went to the right-hand player. With identical stats the right-hand player hit 42 balls per match and the left-hand one 24. Now ties are random (`gapX`, `aimX`) and a ball exactly on the centre line goes to the player it was aimed at. Result with identical stats: 34 to 36 hits per player. Differences that remain come from stats (the AI aims at the weaker defender, low stamina tires faster) and are intended. Test: `point.test.ts` (shared work inside a pair).
- **Career too easy at the start: division ratings raised.** The simulation (`scripts/simBalance.ts career`, hero with evenly spread points plus the partner a player usually has at that level, both played by the CPU AI) gave 77% match wins in Club Cup and 82-85% in Regional and Rise. New ratings: club 3.0 to 3.7, regional 3.8 to 4.4, rise 4.6 to 5.1, bronze 5.4 to 5.8, silver 6.2 to 6.4; later divisions unchanged. New win rates for the CPU-driven hero: club 53%, regional 64%, rise 62%, bronze 66%, silver 57%, gold 49%, platinum 36%. A human plays better than the CPU AI, so his real win rate is higher: **check in the game that Club Cup now takes effort without being unfair, and move the numbers in `divisions.json` if not.**
- Start points of the hero are `startStat` 4 plus `startPoints` 2 (the plan wrongly said 6 free points). Partner Olek averages 3.4; buying Lena (200 coins) at level 3 is a big jump (the sim shows 85% before the change), consider a cheaper or weaker Lena.
- Simulation tool: `npx vite-node scripts/simBalance.ts fatigue|career [matches] [rating offset]`. Limits: players stand at rest positions (no movement), the human is replaced by the CPU AI, gear and boosts are ignored.

## v0.60: coin toss before every match
- New `src/game/toss.ts` (`flipCoin(rng)`, `tossWinner(call, result, caller)`, tested in `toss.test.ts`). `MatchScene.coinToss()` runs at the start of every quick and career match (not in practice): the player calls HEADS or TAILS, the coin flies up and spins (flat gold coin with an H/T face, shadow on the court), then the result is announced and the winner serves first (`this.server = winner`; before this the human always served first).
- Practice mode has no toss. Match data, scoring and the rest of the serve rotation are unchanged (the server swaps after each game as before).
- Checked in headless Chromium (screens: call buttons, coin in flight, result, first point served by the toss winner). Sound is only the existing placeholder `select`/`point` beeps: a coin sound and a nicer coin (rim/edge) are open polish items.

## v0.59: receive decision: SPEED and SPIN chips
- Under the km/h number two colour-coded chips: `SPEED: SLOW/MEDIUM/FAST` (km/h < 78 / < 95 / above) and `SPIN: LOW/MEDIUM/HIGH` (`hypot(spin, side) x spinMul(server)` < 0.6 / < 1.2 / above). Green = easy, yellow = medium, red = hard. The owner rejected a third GLASS chip (too much to read in a few seconds) and the per-button risk word for now.
- Thresholds are first guesses: check on a phone that all four serves land in different classes (hard glass: fast/low-medium, spin glass: medium/high, at opponent: medium-fast/low, T-serve: slow/medium).

## v0.58: receiving a serve off the glass: clearer buttons, no hint line
- The two receive buttons are now `AFTER BOUNCE` (fast, clean) and `WAIT FOR THE GLASS` (more time) (were ON THE BOUNCE / OFF THE GLASS). The line under the km/h (`HARD GLASS  WIDE, OFF THE LEFT GLASS`) is removed.
- Owner clarification: the `bouncemesh` serve fault is meant as is: the serve bounces in the service box, but is too short and then hits the side fence (the mesh), not the glass. Kept (v0.57 only stopped it leaving the court).
- Open: what to show instead of the removed line so the receiver can judge the risk (speed, spin, how close to the glass, how much time). Proposal discussed in the chat (risk chips and a risk word per button); nothing built yet. Numbers behind the choice: `BOUNCE_DEFENSE` 0.9 / `WALL_DEFENSE` 1.1 in the receiver's defence, `BOUNCE_PRESSURE_RELIEF` 0.5 (a serve taken after the bounce puts half the pressure on the return), decision time `receiveDecisionMs` (6.2 s x 40..100% by guts).

## v0.57: second serve from the baseline, faulted serves stay in the court
- Bug (screenshot, 22.11): on the second serve the server stood at the net. While the first serve was in the air everybody walked to the formation after the serve (the server up to the net), and after a fault `serveTurn()` was called without sending them back. Fix: `startServe` remembers the serving spots (`serveSpots`), a fault now calls `backToServeSpots()` (all four walk back in 450 ms, the ball of the fault is stopped, then `serveTurn()`).
- Bug (22.11): a serve that went out flew off into the crowd. Cause: the `bouncemesh` fault (bounces in the court, then hits the side mesh) ran on 0.5 * vz * t2 metres after the bounce (about 7 m) and left through the back glass (z beyond 0 / 20), and it hit the wall at 3.2-3.7 m, which is above the fence where the side wall is lower. Now the run stops 0.4 m before the back glass and the ball meets the wall on the mesh of that wall segment (`sideWallSegments()`), so the coast bounces it back into the court.
- New test: no faulted serve (every serve shot, both sides, all fault kinds, many aims) leaves the court, neither in the flight nor in the rolling coast.
- The other fault kinds (net, low back glass, low side glass first, long) were already inside the court (checked by that test). Open question for the owner: `bouncemesh` still hits the mesh above the glass (owner's earlier design); the owner said a faulted serve should bounce low off the glass: say if that variant should be dropped or lowered.

## v0.56: Powerful Smash (a Por Cuatro that stays in the court)
- Owner report (22.11): a Por Cuatro whose ball bounced and then came back off the back glass into the opponents' court was still called Por Cuatro. A real Por Cuatro bounces flat in the front of the court and flies out over the back glass.
- Rule (`isPowerfulSmash` / `shotLabel` in `src/game/point.ts`): `smash_x4` with `reboundBack` (the deeper winner, or a hard ball that comes off the glass) or `netReturn` (a mishit that the defender plays back from the net) is shown as **Powerful Smash**; every other `smash_x4` result (nail over the glass, early-take error, error) stays Por Cuatro. The shot itself, its numbers and its flight are unchanged.
- `MatchScene`: the headline and the winner banner chip use `shotLabel(step)`. At the hit a `POWERFUL SMASH!` banner (orange, above the court), a ring of rays, an orange camera flash and a shake are played (`powerSmashFx`), with `powerSmashSound()` in `src/audio.ts` (rising sweep, deep boom, crack, ring of the glass). The old impact flash at the bounce stays.
- Tests: label rules (both Powerful Smash cases, Por Cuatro otherwise, no other shot renamed). Not checked on a phone: the look and the length of the banner and the sound.

## v0.55: new shots (dejada, contrapared, block), stronger volley, shot rules tightened
- Owner decisions (22.11): **Bandeja** now needs `formations: [mid, back]` (not at the net) on top of `air`; **Flat shot** (`bounce_shot`) gets `air: false` (only after a bounce). Vibora already had mid/back + air.
- New `ShotRequires` fields: `air: false`, `oppFormations`, `minBallSpeed`, `nearWall`. `BallState.nearWall` is set in `stepHit` when the ball is aimed at |x| >= `NEAR_WALL_X` (3 m). New `ShotDef` flags: `drop`, `ignorePressure`, `ownWall`.
- **Dejada** (`dejada`, technique, cost 1, lands 1.2 m behind the net, `winnerMargin` 8): hitter at the net or mid, ball low/mid, not off the glass, opponents' formation back or mid. `drop` makes the defender's rating speed-heavy (`defense 3, speed 7`) and position-dependent (`DROP_POSITION`: back 0.75, mid 0.95, net 1.2). **Deviation from the chat:** the owner asked for "at least one opponent at the back", but `formation` is per team and a team is `back` only before it has hit (start of the point), so `back` alone made the shot almost never available. Offered against `back` or `mid` (not both at the net).
- **Contrapared** (`contrapared`, spin, cost 1, always cross, `ownWall`): hitter in `mid` or `back` (not at the net), ball bounced (`air: false`), low/mid, not off the glass, `nearWall`. Same deviation: the owner said "at the back of the court by a side", but a hitter in `back` with a low/mid bounced ball almost never happens (back only after a lob = high ball), so mid-court is allowed. In a CPU sim it is offered on about 0.7% of rally hits (every near-wall ball), the CPU picks it rarely.
- Flight: `buildContrapared` in `ballPath.ts`: a short leg into the hitter's own side wall (3.2 m ahead, closer when hit from further up), a `glass` event, then the normal flight from that spot (errors included).
- **Block** (`bloqueo`, defense, cost 0, `ignorePressure`, lands 2.8 m from the net): hitter at the net, ball in the air, low/mid, ball speed >= 21 m/s (`minBallSpeed`). The volley stays available against a hard ball.
- **Volley is stronger** (owner): power 1.05 -> 1.15, risk 0.07 -> 0.08, speed 21 -> 26 m/s. CPU-vs-CPU sim (8000 points): avg hits 7.7 -> 7.0, server wins 52.5%, volley winners about x2.7 (312 -> ~850 per 6000 points). Power 1.25 was too much (avg hits 6.7, 1247 volley winners). Tune together with the balance task (plan point 1).
- Practice SETUP got a second page: AFTER BOUNCE, HARD BALL, BY THE WALL (needed to test the flat shot, block, contrapared).
- Menu size: at most 7 rally shots are offered at once (3 compact columns hold 9); typically 4-5.
- Tests: availability of every changed shot, near-wall balls after a parallel shot, dejada vs back/net defenders, contrapared flight (both sides). 282 tests pass.
- Not checked on a phone: the three new buttons, the contrapared animation (the hitter plays the usual stroke), the 3D branch (`strokeFor` in the 3D demo has no entries for the new shots: rebase `style/3d` and map dejada/bloqueo to volley/chiquita strokes, contrapared to the forehand).

## v0.54: shots from the air never after a bounce
- Owner decision (22.11, replaces the v0.43 rule): vibora, bandeja, volley, rulo and both smashes need `requires.air` (the ball has not bounced). `BallState.air` is set for balls a net or mid-court defender takes out of the air (block, net return) and for weak lobs (short, taken out of the air). A deep lob (bounced, with or without the glass) offers only bajadas (glass), flat shot, lob, chiquita.
- Tests in `point.test.ts`: availability after a deep lob, after a weak lob, and 400 random lobs (nothing from the air after a bounce). `noLob` was removed. The test helper `rallyState` now defaults to an air ball.

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
