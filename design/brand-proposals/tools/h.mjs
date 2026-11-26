// D2: POP-ART COMIC. Yellow with red Ben-Day dots, a cyan comic panel, the ball breaking out through the panel frame,
// sound-effect lettering POR TRES! and a caption box.
import { font, layout, joined, svg, save, ball, burst, rng } from './lib.mjs';
const INK = '#111111', YELLOW = '#ffe14d', RED = '#e8202a', CYAN = '#1fb5e8', CYAN_L = '#7fd6f5', WHITE = '#ffffff', PAPER = '#fff8e1';

const dots = (id, color, step, r, rot = 30) => `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="${color}"/></pattern>`;

/** Jagged hole polygon around (cx, cy). */
function jag(cx, cy, r, n, seed, k = 0.55) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = (i % 2 ? r * (k + R() * 0.2) : r * (0.9 + R() * 0.25));
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Broken pieces of the panel frame flying out from (cx, cy). */
function shards(cx, cy, seed, n, r0, r1, s) {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 1.15 + (R() - 0.5) * 0.2;
    const d = r0 + R() * (r1 - r0), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const w = s * (0.7 + R() * 0.6), h = s * 0.32;
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(R() * 360).toFixed(0)})"><polygon points="${-w / 2},${-h / 2} ${w / 2},${-h * 0.2} ${w * 0.4},${h / 2} ${-w * 0.45},${h * 0.4}" fill="${WHITE}" stroke="${INK}" stroke-width="${s * 0.09}" stroke-linejoin="round"/></g>`;
  }
  return out;
}

const actionLines = (cx, cy, r0, r1, n, w, seed, color = INK) => {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.1;
    const a0 = r0 * (0.9 + R() * 0.3), a1 = r1 * (0.8 + R() * 0.3);
    out += `<path d="M ${cx + Math.cos(a) * a0} ${cy + Math.sin(a) * a0} L ${cx + Math.cos(a) * a1} ${cy + Math.sin(a) * a1}" stroke="${color}" stroke-width="${w * (0.5 + R() * 0.8)}" stroke-linecap="round"/>`;
  }
  return out;
};

/** SFX lettering: hard black drop, black outline, red face, white inner highlight on the top-left edges. */
function sfx(d, x, y, { stroke = 22, drop = [16, 18], face = RED, hi = WHITE } = {}) {
  return `<path transform="translate(${x + drop[0]} ${y + drop[1]})" d="${d}" fill="${INK}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path transform="translate(${x} ${y})" d="${d}" fill="${INK}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path transform="translate(${x - 4} ${y - 4})" d="${d}" fill="${hi}"/>
    <path transform="translate(${x + 3} ${y + 3})" d="${d}" fill="${face}"/>`;
}

function icon() {
  const bx = 700, by = 318, br = 140;
  const panel = [[118, 214], [860, 156], [904, 892], [96, 914]];
  const P = panel.map((p) => p.join(',')).join(' ');
  return svg(1024, 1024, `<defs>${dots('od', RED, 30, 7)}${dots('pd', CYAN_L, 26, 6, 20)}
      <clipPath id="pc"><polygon points="${P}"/></clipPath>
      <mask id="hole" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/><polygon points="${jag(bx + 40, by - 40, 190, 9, 3)}" fill="black"/></mask></defs>
    <rect width="1024" height="1024" fill="${YELLOW}"/><rect width="1024" height="1024" fill="url(#od)" opacity="0.55"/>
    <g mask="url(#hole)">
      <polygon points="${P}" fill="${INK}" transform="translate(16 18)"/>
      <polygon points="${P}" fill="${WHITE}" stroke="${INK}" stroke-width="18" stroke-linejoin="round"/>
      <polygon points="${panel.map(([x, y]) => `${x + (x < 512 ? 34 : -34)},${y + (y < 512 ? 34 : -34)}`).join(' ')}" fill="${CYAN}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
      <g clip-path="url(#pc)"><rect width="1024" height="1024" fill="url(#pd)" opacity="0.6"/>${actionLines(bx, by, 220, 900, 26, 14, 2, WHITE)}</g>
    </g>
    <polygon points="${burst(bx, by, 250, 150, 12, 0.15, (i) => (i % 2 ? 1 : 0.8 + (i % 3) * 0.12))}" fill="${RED}" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/>
    <polygon points="${burst(bx, by, 190, 120, 12, 0.4)}" fill="${YELLOW}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
    ${shards(bx + 40, by - 40, 6, 7, 230, 330, 64)}
    ${ball(bx, by, br, { id: 'ib', rot: -30, outline: INK, ow: 20 })}
`);
}

function logo() {
  const W = 1600, H = 820;
  const f = font('bangers', 400);
  const por = layout(f, 'POR', 190, { tracking: 0.04 }), tres = layout(f, 'TRES!', 330, { tracking: 0.04 });
  const tag = layout(f, 'PADEL CAREER', 64, { tracking: 0.08 });
  const cx = W / 2 - 60, cy = 410;
  const tx = cx - tres.bbox.w / 2 - tres.bbox.x1, ty = cy + 170;
  const px = tx + 10, py = ty - tres.bbox.h - 30;
  const panel = [[230, 110], [1330, 70], [1370, 720], [200, 760]];
  const P = panel.map((p) => p.join(',')).join(' ');
  const bx = 1270, by = 170;
  const capW = tag.bbox.w + 70, capX = 250, capY = 640;
  return svg(W, H, `<defs>${dots('od', RED, 28, 6.5)}${dots('pd', CYAN_L, 24, 5.5, 20)}
      <clipPath id="pc"><polygon points="${P}"/></clipPath>
      <mask id="hole" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/><polygon points="${jag(bx + 20, by - 10, 150, 9, 5)}" fill="black"/></mask></defs>
    <rect width="${W}" height="${H}" fill="${YELLOW}"/><rect width="${W}" height="${H}" fill="url(#od)" opacity="0.5"/>
    <g mask="url(#hole)">
      <polygon points="${P}" fill="${INK}" transform="translate(18 20)"/>
      <polygon points="${P}" fill="${WHITE}" stroke="${INK}" stroke-width="16" stroke-linejoin="round"/>
      <polygon points="${panel.map(([x, y]) => `${x + (x < 800 ? 30 : -30)},${y + (y < 400 ? 30 : -30)}`).join(' ')}" fill="${CYAN}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
      <g clip-path="url(#pc)"><rect width="${W}" height="${H}" fill="url(#pd)" opacity="0.55"/>${actionLines(cx, cy, 380, 1200, 40, 12, 7, WHITE)}</g>
    </g>
    <g transform="rotate(-6 ${cx} ${cy})">
      ${sfx(joined(por), px, py, { stroke: 18, drop: [12, 14], face: YELLOW })}
      ${sfx(joined(tres), tx, ty, { stroke: 24, drop: [18, 20] })}
    </g>
    <polygon points="${burst(bx, by, 150, 92, 12, 0.15)}" fill="${RED}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
    ${shards(bx + 20, by - 10, 9, 7, 170, 250, 48)}
    ${ball(bx, by, 78, { id: 'lb', rot: -30, outline: INK, ow: 14 })}
    <g transform="rotate(-3 ${capX} ${capY})">
      <rect x="${capX + 10}" y="${capY + 12}" width="${capW}" height="96" fill="${INK}"/>
      <rect x="${capX}" y="${capY}" width="${capW}" height="96" fill="${PAPER}" stroke="${INK}" stroke-width="8"/>
      <path transform="translate(${capX + 35 - tag.bbox.x1} ${capY + 74})" d="${joined(tag)}" fill="${INK}"/>
    </g>`);
}

save('out/D2_icon.svg', icon());
save('out/D2_logo.svg', logo());
