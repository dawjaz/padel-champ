# PorTres: Padel Career

_(working name until 2026-11-26: Padel Champ; the repository, the package name and the save key keep the old name on purpose.)_

A command-based padel game for phones (portrait), inspired by NES-era command sports games.
Pick a shot, your opponent picks a response, guts (stamina) decide the rest.

## Run it

```bash
npm install
npm run dev      # open the printed URL; on a phone use the "Network" URL on the same Wi-Fi
npm test
npm run build
```

## Play in the browser without installing anything

Every push to `main` is built and deployed by GitHub Actions (`.github/workflows/pages.yml`).
Enable it once: **Settings -> Pages -> Source: GitHub Actions**. The link appears in the workflow run.
(GitHub Pages on private repos needs a paid GitHub plan.)

## Docs
- [`CLAUDE.md`](CLAUDE.md): instructions for AI agents working in this repo
- [`docs/GDD.md`](docs/GDD.md): game design
- [`docs/DECISIONS.md`](docs/DECISIONS.md): technical decisions
- [`docs/HANDOFF.md`](docs/HANDOFF.md): current state and next steps
