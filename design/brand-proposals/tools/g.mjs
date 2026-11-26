// C4: URBAN BRUSH. Black, a red brush slash, white heavy italic TRES, a yellow marker POR, motion-blurred ball, paint splatter.
import { font, layout, joined, svg, save, ball, rng } from './lib.mjs';
const BLACK = '#0d0d10', RED = '#ff2b3d', RED_D = '#b5101f', YELLOW = '#ffe23d', WHITE = '#ffffff';

/** A rough brush stroke along a quadratic curve P0-C-P1, `w` wide, with dry-brush bristles at the end. */
function brush(P0, C, P1, w, seed, { color = RED, dark = RED_D } = {}) {
  const R = rng(seed);
  const N = 70;
  const at = (t) => [(1 - t) ** 2 * P0[0] + 2 * t * (1 - t) * C[0] + t * t * P1[0], (1 - t) ** 2 * P0[1] + 2 * t * (1 - t) * C[1] + t * t * P1[1]];
  const tan = (t) => {
    const a = at(Math.max(0, t - 0.01)), b = at(Math.min(1, t + 0.01));
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const prof = (t) => (t < 0.08 ? Math.sqrt(t / 0.08) * 0.92 : t > 0.78 ? Math.max(0.05, 1 - (t - 0.78) / 0.22) ** 0.7 : 0.92 + 0.08 * Math.sin(t * 7));
  const side = (s, k) => {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = at(t), d = tan(t), n = [-d[1], d[0]];
      const half = (w / 2) * prof(t) * k * (1 + (R() - 0.5) * 0.09);
      out.push([p[0] + n[0] * half * s, p[1] + n[1] * half * s]);
    }
    return out;
  };
  const shape = (k) => {
    const a = side(1, k), b = side(-1, k).reverse();
    return 'M ' + [...a, ...b].map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ') + ' Z';
  };
  // bristles: thin streaks continuing past the end
  let bristles = '';
  for (let i = 0; i < 9; i++) {
    const off = (R() - 0.5) * w * 0.8, t0 = 0.6 + R() * 0.2, t1 = Math.min(1.08, 0.9 + R() * 0.2);
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const t = t0 + ((t1 - t0) * j) / 10, p = at(Math.min(t, 1)), d = tan(Math.min(t, 0.999)), n = [-d[1], d[0]];
      const ext = t > 1 ? (t - 1) * 400 : 0;
      pts.push(`${(p[0] + n[0] * off + d[0] * ext).toFixed(1)} ${(p[1] + n[1] * off + d[1] * ext).toFixed(1)}`);
    }
    bristles += `<path d="M ${pts.join(' L ')}" fill="none" stroke="${color}" stroke-width="${(3 + R() * 7).toFixed(1)}" stroke-linecap="round" opacity="${(0.6 + R() * 0.4).toFixed(2)}"/>`;
  }
  // inner streaks (lighter) for paint texture
  let streaks = '';
  for (let i = 0; i < 7; i++) {
    const off = (R() - 0.5) * w * 0.7, t0 = R() * 0.5, t1 = t0 + 0.2 + R() * 0.3;
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const t = t0 + ((t1 - t0) * j) / 8, p = at(t), d = tan(t), n = [-d[1], d[0]];
      pts.push(`${(p[0] + n[0] * off).toFixed(1)} ${(p[1] + n[1] * off).toFixed(1)}`);
    }
    streaks += `<path d="M ${pts.join(' L ')}" fill="none" stroke="#ff6b78" stroke-width="${(2 + R() * 4).toFixed(1)}" stroke-linecap="round" opacity="0.45"/>`;
  }
  return `<path d="${shape(1.04)}" fill="${dark}"/><path d="${shape(0.97)}" fill="${color}"/>${streaks}${bristles}`;
}

function splatter(cx, cy, r, n, seed, color = RED) {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = r * (0.3 + R() * 0.9), s = 3 + R() * 14 * (1 - d / (r * 1.3));
    out += `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${Math.max(2, s).toFixed(1)}" fill="${color}"/>`;
  }
  return out;
}

/** Motion-blurred ball: fading ghosts behind it along angle `ang` (the direction it came from). */
function movingBall(id, x, y, r, ang, { ghosts: withGhosts = true } = {}) {
  const a = (ang * Math.PI) / 180;
  let ghosts = '';
  [0.16, 0.28, 0.45].forEach((op, i) => {
    const k = 3 - i;
    ghosts += `<circle cx="${x + Math.cos(a) * r * 0.75 * k}" cy="${y + Math.sin(a) * r * 0.75 * k}" r="${r * (1 - k * 0.04)}" fill="#c8f23a" opacity="${op}"/>`;
  });
  let lines = '';
  for (let i = -1; i <= 1; i++) {
    const nx = -Math.sin(a), ny = Math.cos(a);
    const sx = x + nx * i * r * 0.62 + Math.cos(a) * r * 1.2, sy = y + ny * i * r * 0.62 + Math.sin(a) * r * 1.2;
    lines += `<path d="M ${sx} ${sy} l ${Math.cos(a) * r * (i === 0 ? 3.2 : 2.2)} ${Math.sin(a) * r * (i === 0 ? 3.2 : 2.2)}" stroke="${WHITE}" stroke-width="${r * 0.12}" stroke-linecap="round" opacity="0.85"/>`;
  }
  return (withGhosts ? ghosts : '') + lines + ball(x, y, r, { id, rot: -30, outline: BLACK, ow: r * 0.14 });
}

/** A flat white padel racket silhouette with holes cut out (local: head centre 0,0, handle down). */
function racketSil(color = WHITE, hole = BLACK) {
  let holes = '';
  for (let y = -120; y <= 110; y += 38) for (let x = -110; x <= 110; x += 38) {
    const xx = x + ((Math.round(y / 38) % 2) ? 19 : 0);
    if ((xx / 112) ** 2 + ((y + 4) / 136) ** 2 < 0.72) holes += `<circle cx="${xx}" cy="${y}" r="11" fill="${hole}"/>`;
  }
  return `<g><ellipse cx="0" cy="0" rx="160" ry="188" fill="${color}"/><path d="M -100 120 L 100 120 L 34 236 L -34 236 Z" fill="${color}"/>
    <path d="M -40 150 L 40 150 L 0 206 Z" fill="${hole}"/><rect x="-28" y="226" width="56" height="200" rx="14" fill="${color}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="-28" y="${262 + i * 32}" width="56" height="8" fill="${hole}" transform="skewY(-12)" opacity="0.8"/>`).join('')}
    <ellipse cx="0" cy="0" rx="132" ry="160" fill="none" stroke="${hole}" stroke-width="10"/>${holes}</g>`;
}

function icon() {
  return svg(1024, 1024, `<rect width="1024" height="1024" fill="${BLACK}"/>
    ${brush([60, 900], [430, 560], [1000, 170], 330, 11)}
    ${splatter(150, 840, 150, 26, 5)}
    <g transform="translate(452 582) rotate(-30) scale(1.04)">${racketSil()}</g>
    ${movingBall('ib', 752, 258, 118, 200, { ghosts: false })}`);
}

function logo() {
  const W = 1600, H = 760;
  const tres = layout(font('kanit', 900, 'italic'), 'TRES', 300, { tracking: -0.01 });
  const por = layout(font('permanent-marker', 400), 'POR', 150, { tracking: 0.02 });
  const tag = layout(font('kanit', 900, 'italic'), 'PADEL CAREER', 52, { tracking: 0.2 });
  const cx = W / 2 + 30;
  const tx = cx - tres.bbox.w / 2 - tres.bbox.x1, ty = 500;
  const px = tx - 40, py = ty - tres.bbox.h - 26;
  const bx = tx + tres.bbox.w + 90, by = py - 10;
  return svg(W, H, `<rect width="${W}" height="${H}" fill="${BLACK}"/>
    ${brush([160, 560], [700, 320], [1500, 260], 290, 21)}
    ${splatter(230, 560, 140, 24, 3)}
    ${splatter(1380, 250, 120, 14, 8)}
    <path transform="translate(${tx + 14} ${ty + 14})" d="${joined(tres)}" fill="${BLACK}" opacity="0.65"/>
    <path transform="translate(${tx} ${ty})" d="${joined(tres)}" fill="${WHITE}" stroke="${BLACK}" stroke-width="6" paint-order="stroke"/>
    <g transform="rotate(-9 ${px} ${py})"><path transform="translate(${px + 6} ${py + 6})" d="${joined(por)}" fill="${BLACK}"/><path transform="translate(${px} ${py})" d="${joined(por)}" fill="${YELLOW}"/></g>
    ${movingBall('lb', bx, by, 64, 200)}
    <path transform="translate(${cx - tag.bbox.w / 2 - tag.bbox.x1} ${ty + 120})" d="${joined(tag)}" fill="${WHITE}"/>
    <path d="M ${cx - tag.bbox.w / 2 - 10} ${ty + 146} q ${tag.bbox.w / 2} -14 ${tag.bbox.w + 20} 4" fill="none" stroke="${YELLOW}" stroke-width="10" stroke-linecap="round"/>`);
}

save('out/C4_icon.svg', icon());
save('out/C4_logo.svg', logo());
