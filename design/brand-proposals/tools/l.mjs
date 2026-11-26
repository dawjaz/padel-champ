// Game assets for the PorTres brand (C): start-screen background, glass cracks, a one-line logo for the title bar.
import { font, layout, joined, svg, save, rng } from './lib.mjs';
import { cracks, speedLines } from './c.mjs';
const NAVY = '#0a0f2e', NAVY2 = '#1a2470', ORANGE = '#ff5a1f', RED = '#e8261c', GOLD = '#ffd23f', WHITE = '#ffffff';

function startBg() {
  const W = 720, H = 1280, R = rng(5);
  let bokeh = '';
  for (let i = 0; i < 70; i++) bokeh += `<circle cx="${(R() * W).toFixed(0)}" cy="${(H * 0.55 + R() * H * 0.2).toFixed(0)}" r="${(3 + R() * 10).toFixed(1)}" fill="${R() < 0.5 ? '#ffd86b' : '#9fb6ff'}" opacity="${(0.12 + R() * 0.3).toFixed(2)}"/>`;
  return svg(W, H, `<defs>
      <radialGradient id="bg" cx="0.5" cy="0.38" r="0.8"><stop offset="0" stop-color="#2c3a9e"/><stop offset="0.5" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WHITE}"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/></linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f4fd0"/><stop offset="1" stop-color="#0d2378"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <polygon points="40,-10 130,-10 470,${H * 0.75} 160,${H * 0.75}" fill="url(#beam)" opacity="0.16"/>
    <polygon points="590,-10 680,-10 560,${H * 0.75} 250,${H * 0.75}" fill="url(#beam)" opacity="0.16"/>
    ${bokeh}
    <polygon points="0,${H * 0.62} ${W},${H * 0.44} ${W},${H * 0.465} 0,${H * 0.645}" fill="${ORANGE}" opacity="0.85"/>
    <polygon points="0,${H * 0.66} ${W},${H * 0.48} ${W},${H * 0.487} 0,${H * 0.667}" fill="${GOLD}" opacity="0.7"/>
    <polygon points="-40,${H} ${W + 40},${H} ${W * 0.82},${H * 0.74} ${W * 0.18},${H * 0.74}" fill="url(#floor)"/>
    <g stroke="${WHITE}" stroke-width="5" opacity="0.75" fill="none"><path d="M ${W * 0.18} ${H * 0.74} L ${W * 0.82} ${H * 0.74} M ${W / 2} ${H * 0.74} L ${W / 2} ${H}"/><path d="M ${W * 0.1} ${H * 0.86} L ${W * 0.9} ${H * 0.86}"/></g>
    ${speedLines(31, { n: 18, x0: -100, x1: W, y0: 80, y1: H * 0.7, ang: 0, op: 0.18, w: [2, 6] })}`);
}

const crackImg = () => svg(800, 800, cracks(400, 400, 4, { n: 14, rMin: 220, rMax: 390, w: 7, color: '#e6f9ff' }));

function barLogo() {
  const anton = font('anton', 400), sk = -13;
  const por = layout(anton, 'POR', 70, { tracking: 0.04 }), tres = layout(anton, 'TRES', 100, { tracking: 0.02 });
  const pad = 12, porW = por.bbox.w + pad * 2, H = 130, base = 104;
  const tx = porW + 40;
  const W = Math.ceil(tx + tres.bbox.w + 40);
  const d = joined(tres);
  const T = (dx, dy) => `translate(${tx - tres.bbox.x1 + dx} ${base + dy}) skewX(${sk})`;
  return svg(W, H, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WHITE}"/><stop offset="0.55" stop-color="#fff3b0"/><stop offset="1" stop-color="${GOLD}"/></linearGradient></defs>
    <g transform="translate(14 ${base - 12}) skewX(${sk})"><rect x="0" y="${-por.bbox.h - pad}" width="${porW}" height="${por.bbox.h + pad * 2}" fill="${ORANGE}" stroke="${NAVY}" stroke-width="6"/>
      <path transform="translate(${pad - por.bbox.x1} 0)" d="${joined(por)}" fill="${WHITE}"/></g>
    <g transform="${T(6, 6)}"><path d="${d}" fill="${RED}" stroke="${RED}" stroke-width="10" stroke-linejoin="round"/></g>
    <g transform="${T(0, 0)}"><path d="${d}" fill="url(#g)" stroke="${NAVY}" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/></g>`);
}

save('out/start_bg.svg', startBg());
save('out/cracks.svg', crackImg());
save('out/bar_logo.svg', barLogo());
