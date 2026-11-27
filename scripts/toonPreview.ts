import { writeFileSync } from 'node:fs';
import { buildToon } from '../src/art/toon/character';
import { toSvg } from '../src/art/toon/ops';
import players from '../src/data/players.json';
const a = { ...(players.you[0].appearance as never as Record<string, unknown>), racket: '#d8352a', racketShape: process.argv[3] ?? 'diamond', racketFace: 'carbon', racketAccent: '#f6d743' } as never;
const poses = ['ready', 'fhHit', 'smashHit', 'bhPrep'] as const;
const parts = poses.map((p, i) => `<g transform="translate(${i * 360} 0)">${toSvg(buildToon(a, 'front', p)).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`);
parts.push(`<g transform="translate(${4 * 360} 0)">${toSvg(buildToon(a, 'side', 'fhHit')).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`);
writeFileSync(process.argv[2], `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -130 1800 476" width="1800" height="476" style="background:#eef">${parts.join('')}</svg>`);
