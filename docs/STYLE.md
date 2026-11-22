# Style: "broadcast" look (chosen 2026-11-22)

## Decisions (owner)
- Light colours like a sports TV broadcast. Palette: navy 0x0b2a5b (outlines, bars), blue 0x1e6bff, orange 0xd93f00 (main accent, XP), light blue background 0xeaf1fa, gold 0xffb800 (coins, level badge). All in `src/theme.ts` (`TC`).
- UI language: cards with a 2.5 px navy outline and a 3 px hard offset shadow, 14-16 px corner radius, glossy gradient buttons (orange primary, blue, white secondary), rounded progress bars with a gloss line, XP and coins as numbers plus bars, attributes as rounded bars with an icon.
- Fonts: Baloo 2 (headings, buttons), Nunito (body); from @fontsource, offline.
- Screens: home/title as hero on a pale stage + name plate + CAREER + tiles; outfit screen with the character at about half the screen, six slot tiles (head, top, shorts, shoes, racket, bag) left and right, options sheet below; partners as tiles (portrait, name, state, POW/TEC/DEF bars); match with the court, TV-style scoreboard, SPEED/SPIN chips, guts bars, three direction buttons side by side.
- Characters: same height and proportions, big-ish heads kept but about 4.5 heads tall (not jelly-like), different hair, skin, colours, women and men, builds differ slightly; flat cel shading with a dark outline. The owner may send reference pictures if this is not the right feel yet.

## Code
- `src/art/toon/` builds a character as a list of SVG-style paths (`buildToon`), drawn with Canvas2D `Path2D` (sync, no async image loading) or exported with `toSvg` (tests, mock-ups). Character units: the figure is about 340 tall, centre x 100, soles y 334 (`FIG`).
- `src/art/toonTexture.ts` makes the Phaser texture (`addToon`).

## Migration phases
1. DONE (v0.66): theme, fonts, toon characters (ready pose, front and back), title screen.
2. DONE (v0.67): menu screens: Hero (with attribute bars), Gear (outfit layout with slot tiles), Partner (tiles), Shop and Packs, Calendar, Bracket, Result, Settings, Tutorial, Achievements. Add `build` (body width) to `Appearance` if wanted. Replace `applyScreen` backdrops by `applyLightScreen`.
3. DONE (v0.71): match scene UI: scoreboard, buttons, chips, guts bars, receive/toss screens in the new theme (court stays the current arena at first, then a lighter one).
4. DONE (v0.72-v0.76): toon poses (run, forehand, backhand, smash) and integration into the match; old pixel character code retired.
5. 5a DONE (v0.77): lighter arena. 5b: tutorial in graphic form (plan point 9) in the new style.
