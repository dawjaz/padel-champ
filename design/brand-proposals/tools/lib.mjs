// Helpers for the PorTres logo proposals: text to SVG paths (with kerning), small SVG utilities.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

import { execFileSync } from 'node:child_process';
const here = new URL('.', import.meta.url).pathname;
/** A font reference: the TTF converted from the @fontsource package. */
export const font = (name, weight = 400, style = "normal") => `${here}ttf/${name}-latin-${weight}-${style}.ttf`;

/**
 * Lays out `text` with HarfBuzz (kerning) plus extra tracking (in em). Per-glyph paths have the origin at the baseline start,
 * y down. Returns { glyphs: [{ch, d, x, w, bb}], advance, bbox }.
 */
export function layout(f, text, size, { tracking = 0 } = {}) {
  const res = execFileSync('python3', [`${here}shape.py`], { input: JSON.stringify([{ font: f, text, size, tracking }]) });
  return JSON.parse(res.toString())[0];
}

/** One path string for a whole laid-out word. */
export const joined = (lay) => lay.glyphs.map((g) => g.d).join(' ');

export const svg = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${extra}>${body}</svg>`;

export function save(path, content) {
  mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  writeFileSync(path, content);
}

/** The inner markup of an exported toon SVG (without the outer <svg>), plus its viewBox. */
export function toonInner(file) {
  const s = readFileSync(file, 'utf8');
  const vb = s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const inner = s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { vb, inner };
}

/** A 5-point burst / star polygon. */
export function burst(cx, cy, rOut, rIn, n, rot = 0, jitter = null) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    let r = i % 2 === 0 ? rOut : rIn;
    if (jitter) r *= jitter(i);
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Deterministic pseudo-random numbers (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A padel ball (lime felt with the curved seam). `rot` in degrees. */
export function ball(cx, cy, r, { rot = -25, id = 'b', seam = '#ffffff', base = ['#f4ff9a', '#d9f53c', '#9fbf12'], outline = null, ow = 0 } = {}) {
  const s = r;
  const seamPath = `M ${-0.62 * s} ${-0.78 * s} Q ${-0.02 * s} 0 ${-0.62 * s} ${0.78 * s} M ${0.62 * s} ${-0.78 * s} Q ${0.02 * s} 0 ${0.62 * s} ${0.78 * s}`;
  return `<defs><radialGradient id="${id}g" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="${base[0]}"/><stop offset="0.55" stop-color="${base[1]}"/><stop offset="1" stop-color="${base[2]}"/></radialGradient>
  <clipPath id="${id}c"><circle cx="0" cy="0" r="${s}"/></clipPath></defs>
  <g transform="translate(${cx} ${cy}) rotate(${rot})">
    ${outline ? `<circle r="${s + ow / 2}" fill="${outline}"/>` : ''}
    <circle r="${s}" fill="url(#${id}g)"/>
    <g clip-path="url(#${id}c)"><path d="${seamPath}" fill="none" stroke="${seam}" stroke-width="${0.11 * s}" stroke-linecap="round" opacity="0.95"/></g>
  </g>`;
}
