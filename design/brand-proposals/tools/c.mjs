// C: DYNAMIC / SPORT. Heavy italic letters, a fireball smash through cracked glass, speed lines.
import { font, layout, joined, svg, save, ball, rng } from './lib.mjs';
const NAVY = '#0a0f2e', NAVY2 = '#1a2470', ORANGE = '#ff5a1f', RED = '#e8261c', GOLD = '#ffd23f', CYAN = '#7fe8ff', WHITE = '#ffffff';

/** A tapered flame trail from (bx, by) (the ball, width w) to (ex, ey) (the tip). */
function flame(id, bx, by, ex, ey, w, seed = 1) {
  const R = rng(seed);
  const dx = ex - bx, dy = ey - by, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const layer = (wk, lk, color, op, wob) => {
    const pts = [];
    const N = 9;
    for (let side of [1, -1]) {
      const arr = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const half = (w / 2) * wk * Math.pow(1 - t, 0.85) * (1 + (R() - 0.5) * wob);
        const along = t * len * lk;
        arr.push([bx + ux * along + nx * half * side, by + uy * along + ny * half * side]);
      }
      pts.push(side === 1 ? arr : arr.reverse());
    }
    const all = [...pts[0], ...pts[1]];
    // smooth with quadratic midpoints
    let d = `M ${all[0][0].toFixed(1)} ${all[0][1].toFixed(1)}`;
    for (let i = 1; i < all.length - 1; i++) {
      const mx = (all[i][0] + all[i + 1][0]) / 2, my = (all[i][1] + all[i + 1][1]) / 2;
      d += ` Q ${all[i][0].toFixed(1)} ${all[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    d += ' Z';
    return `<path d="${d}" fill="${color}" opacity="${op}"/>`;
  };
  const cap = (k, color, op) => `<circle cx="${bx}" cy="${by}" r="${(w / 2) * k}" fill="${color}" opacity="${op}"/>`;
  return `<g>${cap(1.02, RED, 0.9)}${layer(1.05, 1.0, RED, 0.9, 0.25)}${cap(0.86, ORANGE, 1)}${layer(0.86, 0.82, ORANGE, 1, 0.3)}${cap(0.66, GOLD, 1)}${layer(0.62, 0.62, GOLD, 1, 0.3)}${layer(0.34, 0.4, '#fff6c8', 1, 0.2)}</g>`;
}

/** Cracks radiating from (cx, cy). */
function cracks(cx, cy, seed, { n = 11, rMin = 220, rMax = 520, w = 7, color = WHITE } = {}) {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.4;
    const L = rMin + R() * (rMax - rMin);
    let x = cx, y = cy, d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const aa = a + (R() - 0.5) * 0.35;
      const seg = (L / steps) * (0.7 + R() * 0.6);
      x += Math.cos(aa) * seg;
      y += Math.sin(aa) * seg;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w * (0.6 + R() * 0.6)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
  }
  // a broken ring
  for (let k = 0; k < 2; k++) {
    const rr = 120 + k * 110;
    for (let i = 0; i < 6; i++) {
      const a0 = R() * Math.PI * 2, a1 = a0 + 0.3 + R() * 0.5;
      out += `<path d="M ${cx + Math.cos(a0) * rr} ${cy + Math.sin(a0) * rr} A ${rr} ${rr} 0 0 1 ${cx + Math.cos(a1) * rr} ${cy + Math.sin(a1) * rr}" fill="none" stroke="${color}" stroke-width="${w * 0.6}" stroke-linecap="round" opacity="0.6"/>`;
    }
  }
  return out;
}

function shards(cx, cy, seed, { n = 9, r0 = 160, r1 = 420, s0 = 26, s1 = 70 } = {}) {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    // spread around the impact, but not over the flame (which leaves down-left, about 125-150 deg)
    const a = (-Math.PI * 0.85) + (i / Math.max(1, n - 1)) * Math.PI * 1.45 + (R() - 0.5) * 0.25;
    const r = r0 + R() * (r1 - r0);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const s = s0 + R() * (s1 - s0);
    const rot = R() * 360;
    const k = 0.35 + R() * 0.25;
    const p = [[-s * 0.55, -s * k], [s * 0.15, -s * 0.5], [s * 0.7, -s * 0.05], [s * 0.05, s * k * 1.2], [-s * 0.45, s * 0.2]]
      .map(([a, b]) => `${(a * (0.8 + R() * 0.4)).toFixed(1)},${(b * (0.8 + R() * 0.4)).toFixed(1)}`).join(' ');
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})"><polygon points="${p}" fill="url(#shardg)" stroke="${WHITE}" stroke-width="${(s * 0.07).toFixed(1)}" stroke-linejoin="round" stroke-opacity="0.9"/></g>`;
  }
  return out;
}

function speedLines(seed, { n = 14, x0 = 0, x1 = 1024, y0 = 0, y1 = 1024, ang = -32, color = WHITE, op = 0.5, w = [3, 10] } = {}) {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
    const L = 120 + R() * 280;
    const a = (ang * Math.PI) / 180;
    out += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} l ${(Math.cos(a) * L).toFixed(1)} ${(Math.sin(a) * L).toFixed(1)}" stroke="${color}" stroke-width="${(w[0] + R() * (w[1] - w[0])).toFixed(1)}" stroke-linecap="round" opacity="${(op * (0.5 + R() * 0.5)).toFixed(2)}"/>`;
  }
  return out;
}

function icon(part = 'all') {
  const bx = 590, by = 420, r = 178;
  const defs = `<defs>
    <radialGradient id="cbg" cx="0.58" cy="0.42" r="0.75"><stop offset="0" stop-color="#3b1f7a"/><stop offset="0.45" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
    <radialGradient id="cglow" cx="${bx / 1024}" cy="${by / 1024}" r="0.42"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.75"/><stop offset="0.4" stop-color="${ORANGE}" stop-opacity="0.35"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
    <linearGradient id="shardg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${WHITE}" stop-opacity="0.85"/><stop offset="0.35" stop-color="${CYAN}" stop-opacity="0.55"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0.15"/></linearGradient>
    <linearGradient id="cglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${CYAN}" stop-opacity="0.22"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0.06"/></linearGradient>
  </defs>`;
  const glass = `<rect x="-20" y="-20" width="1064" height="1064" fill="url(#cglass)"/>`;
  const back = `<rect width="1024" height="1024" fill="url(#cbg)"/>${glass}
    ${cracks(bx, by, 4, { n: 13, rMin: 380, rMax: 700, w: 13, color: '#d8f6ff' })}
    <rect width="1024" height="1024" fill="url(#cglow)"/>
    ${speedLines(9, { n: 16, x0: 0, x1: 700, y0: 520, y1: 1100, ang: -38, op: 0.55, w: [4, 12] })}`;
  const front = `${flame('cf', bx, by, -10, 1060, r * 2.25, 3)}
    ${shards(bx, by, 7, { n: 7, r0: 230, r1: 400, s0: 60, s1: 110 })}
    ${ball(bx, by, r, { id: 'cball', rot: -40, outline: NAVY, ow: 18 })}`;
  // Android adaptive icon: the front is scaled into the 66% safe zone of the 108 dp canvas.
  if (part === 'back') return svg(1024, 1024, defs + back);
  if (part === 'front') return svg(1024, 1024, `${defs}<g transform="translate(512 512) scale(0.62) translate(-560 -470)">${front}</g>`);
  return svg(1024, 1024, `${defs}${back}${front}`);
}

function logo(parts = ['bg', 'word', 'por', 'tag', 'flame', 'shards', 'ball']) {
  const on = (k, str) => (parts.includes(k) ? str : '');
  const W = 1600, H = 700;
  const anton = font('anton', 400);
  const tres = layout(anton, 'TRES', 380, { tracking: 0.02 });
  const por = layout(anton, 'POR', 150, { tracking: 0.04 });
  const tag = layout(font('big-shoulders-display', 900), 'PADEL CAREER', 64, { tracking: 0.28 });
  const skew = -13;
  const tx = (W - tres.bbox.w) / 2 - 20, ty = 560; // TRES baseline
  const defs = `<defs>
    <linearGradient id="shardg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${WHITE}" stop-opacity="0.85"/><stop offset="0.35" stop-color="${CYAN}" stop-opacity="0.55"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0.15"/></linearGradient>
    <linearGradient id="lbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient>
    <linearGradient id="lfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WHITE}"/><stop offset="0.55" stop-color="#fff3b0"/><stop offset="1" stop-color="${GOLD}"/></linearGradient>
    <mask id="lcut" maskUnits="userSpaceOnUse" x="-400" y="-700" width="${W + 800}" height="900"><rect x="-400" y="-700" width="${W + 800}" height="900" fill="white"/>
      ${[0, 1, 2].map((i) => `<rect x="-400" y="${-96 + i * 30}" width="${W + 800}" height="${9 - i * 2.5}" fill="black"/>`).join('')}
    </mask>
  </defs>`;
  const word = joined(tres);
  const T = (dx, dy) => `translate(${tx + dx} ${ty + dy}) skewX(${skew})`;
  const porW = por.bbox.w;
  const porX = tx + 30, porY = ty - tres.bbox.h - 40;
  const body = `${defs}${on('bg', `<rect width="${W}" height="${H}" fill="url(#lbg)"/>
    <polygon points="0,${H * 0.74} ${W},${H * 0.30} ${W},${H * 0.335} 0,${H * 0.775}" fill="${ORANGE}"/><polygon points="0,${H * 0.80} ${W},${H * 0.36} ${W},${H * 0.37} 0,${H * 0.81}" fill="${GOLD}"/>
    ${speedLines(21, { n: 22, x0: -100, x1: W, y0: 60, y1: H, ang: 0, op: 0.22, w: [3, 9] })}`)}
    ${on('word', `<g transform="${T(16, 16)}"><path d="${word}" fill="${RED}" stroke="${RED}" stroke-width="26" stroke-linejoin="round"/></g>
    <g transform="${T(0, 0)}"><path d="${word}" fill="none" stroke="${NAVY}" stroke-width="26" stroke-linejoin="round"/></g>
    <g transform="${T(0, 0)}" mask="url(#lcut)"><path d="${word}" fill="url(#lfill)"/></g>`)}
    ${on('por', `<g transform="translate(${porX} ${porY}) skewX(${skew})">
      <rect x="-26" y="${-por.bbox.h - 22}" width="${porW + 52}" height="${por.bbox.h + 44}" fill="${ORANGE}" stroke="${NAVY}" stroke-width="10"/>
      <path d="${joined(por)}" fill="${WHITE}"/>
    </g>`)}
    ${on('flame', flame('lf2', tx + tres.bbox.w + 120, porY - 10, tx + tres.bbox.w - 260, porY + 80, 150, 8))}
    ${on('shards', shards(tx + tres.bbox.w + 120, porY - 10, 12, { n: 6, r0: 100, r1: 180, s0: 30, s1: 54 }))}
    ${on('ball', ball(tx + tres.bbox.w + 120, porY - 10 + 0, 66, { id: 'lball', rot: -35, outline: NAVY, ow: 12 }))}
    ${on('tag', `<g transform="translate(${tx + 70} ${ty + 96}) skewX(${skew})">
      <rect x="-20" y="-58" width="${tag.bbox.w + 40}" height="74" fill="${NAVY}" stroke="${WHITE}" stroke-width="5"/>
      <path d="${joined(tag)}" fill="${WHITE}"/>
    </g>`)}`;
  return svg(W, H, body);
}

save('out/C_icon.svg', icon());
save('out/C_icon_back.svg', icon('back'));
save('out/C_icon_front.svg', icon('front'));
save('out/C_logo.svg', logo());
const LAYERS = { word: ['word'], por: ['por'], tag: ['tag'], flame: ['flame'], shards: ['shards'], ball: ['ball'], all: ['word', 'por', 'tag', 'flame', 'shards', 'ball'] };
for (const [k, p] of Object.entries(LAYERS)) save(`out/Cl_${k}.svg`, logo(p));
export { flame, cracks, shards, speedLines, logo };
