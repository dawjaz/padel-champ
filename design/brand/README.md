# PorTres brand: chosen direction C ("fireball", 2026-11-26)

Source: `design/brand-proposals/tools/c.mjs` (logo, icon, logo layers, adaptive icon parts) and `l.mjs` (start-screen
background, glass cracks, the one-line bar logo). Fonts: Anton, Big Shoulders Display (OFL), letters as outlines.

## App icons (ready for Capacitor)
- `ios/AppIcon-*.png`: 1024 (store / single-size Xcode asset) plus the classic sizes 180-20.
- `android/mipmap-*/ic_launcher.png` and `ic_launcher_round.png` (legacy), `ic_launcher_background.png` + `ic_launcher_foreground.png`
  (adaptive, 108 dp, the ball and flame inside the 66% safe zone), `mipmap-anydpi-v26/*.xml`, `play-store-512.png`.
- Web: `public/icons/` (favicons, apple-touch-icon, PWA 192/512) and `public/manifest.webmanifest`.

## In the game (`public/assets/brand/`, registered in `src/assets.ts`)
- `logo_all.png` and its layers `logo_word|por|tag|flame|shards|ball.png` (same 900x615 frame, so they stack): the intro animates them.
- `logo_bar.png`: POR tag + TRES on one line, for the title bar. `cracks.png`, `start_bg.jpg`: intro and start screen.

## Palette
Navy #0a0f2e / #1a2470, orange #ff5a1f, red #e8261c, gold #ffd23f, glass #7fe8ff, lime ball. The UI palette (`TC` in
`src/theme.ts`) already matches; only `orangeLight` (now the logo orange) and `gold` (a step lighter) were aligned.
Sport lettering (`SPORT` = Anton, slanted) is for the brand moments only (intro, TAP TO PLAY, CAREER); the UI keeps Baloo 2 / Nunito.
