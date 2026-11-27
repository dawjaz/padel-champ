// Writes an SVG of the three racket shapes from src/art/racketShape.ts (for checking the geometry by eye).
import { writeFileSync } from 'node:fs';
import { racketGeom, RACKET, type Pt } from '../src/art/racketShape';
const d = (pts: Pt[], close = true): string => 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') + (close ? ' Z' : '');
let body = '';
(['round', 'teardrop', 'diamond'] as const).forEach((s, i) => {
  const g = racketGeom(s);
  const tx = 20 + i * 32;
  body += `<g transform="translate(${tx} 50)">`;
  body += `<rect x="${-RACKET.gripW / 2}" y="${-RACKET.gripTo}" width="${RACKET.gripW}" height="${RACKET.gripTo}" fill="#222"/>`;
  body += `<path d="${d(g.head)}" fill="#d33"/>`;
  for (const a of g.arms) body += `<path d="${d(a)}" fill="#d33"/>`;
  body += `<path d="${d(g.face)}" fill="#20252f"/>`;
  body += `<path d="${d(g.sweep)}" fill="#d33"/><path d="${d(g.stripe)}" fill="#fc0"/>`;
  for (const [x, y] of g.holes) body += `<circle cx="${x}" cy="${y}" r="${RACKET.holeR}" fill="#000"/>`;
  body += `<path d="${d(g.outline)}" fill="none" stroke="#000" stroke-width="0.2"/><path d="${d(g.heart)}" fill="none" stroke="#06f" stroke-width="0.2"/>`;
  body += `<path d="${d(g.protector, false)}" fill="none" stroke="#000" stroke-width="0.6" opacity="0.5"/>`;
  body += `<text x="-6" y="3" font-size="2.4">${s} ${g.widestAt.toFixed(1)}</text></g>`;
});
writeFileSync(process.argv[2] ?? 'rackets.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 56" width="1000" height="560" style="background:#eef">${body}</svg>`);
