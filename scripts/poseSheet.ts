// Writes /tmp/poses.html: every toon pose of a few characters, for a visual check. Run: npx vite-node scripts/poseSheet.ts
import { writeFileSync } from 'node:fs';
import playersData from '../src/data/players.json';
import { buildToon, RUN_FRAMES, runFrame, TOON_POSES, type ToonView } from '../src/art/toon/character';
import { toSvg } from '../src/art/toon/ops';
import type { Appearance } from '../src/game/types';

const who = (process.argv[2] ?? 'you:0').split(':');
const list = (playersData as unknown as Record<string, Array<{ name: string; appearance: Appearance }>>)[who[0]];
const pl = list[Number(who[1])];
const views = (process.argv[3] ?? 'back,front').split(',') as ToonView[];
let html = '<body style="margin:0;background:#eaf1fa;font:12px sans-serif">';
for (const view of views) {
  html += `<h3 style="margin:4px 8px">${pl.name} ${view}</h3><div style="display:flex;flex-wrap:wrap">`;
  for (const pose of TOON_POSES) html += `<div style="width:190px;text-align:center">${toSvg(buildToon(pl.appearance, view, pose), 190)}<br>${pose}</div>`;
  for (let f = 0; f < RUN_FRAMES; f++) html += `<div style="width:190px;text-align:center">${toSvg(buildToon(pl.appearance, view, runFrame(f)), 190)}<br>run ${f}</div>`;
  html += '</div>';
}
writeFileSync(process.argv[4] ?? '/tmp/poses.html', html);
