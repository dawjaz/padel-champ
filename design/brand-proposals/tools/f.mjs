// C3: CHAMPIONSHIP BROADCAST. Night-stadium blue, gold bevelled metal, light beams, the numeral 3 as the mark.
import { font, layout, joined, svg, save, ball, rng, burst } from './lib.mjs';
const NIGHT = '#070a2e', ROYAL = '#1b2a9e', VIOLET = '#3a1f8f', WHITE = '#ffffff', OUT = '#2a1600';

const goldDefs = (id) => `
  <linearGradient id="${id}gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fffdf0"/><stop offset="0.22" stop-color="#ffe98f"/><stop offset="0.47" stop-color="#e9ad22"/><stop offset="0.5" stop-color="#9a5c00"/>
    <stop offset="0.5" stop-color="#7a4600"/><stop offset="0.6" stop-color="#ffc93a"/><stop offset="0.82" stop-color="#fff2b0"/><stop offset="1" stop-color="#d0901a"/>
  </linearGradient>
  <linearGradient id="${id}side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6200"/><stop offset="1" stop-color="#4a2a00"/></linearGradient>`;

/** Gold bevelled lettering: dark outline, a 3D side, a gold face and a light inner rim. `T` = transform of the glyph group. */
function gold(id, d, T, { depth = 12, dx = 0.9, dy = 1.3, stroke = 18 } = {}) {
  let side = '';
  for (let i = depth; i >= 1; i--) side += `<path transform="translate(${(i * dx).toFixed(1)} ${(i * dy).toFixed(1)})" d="${d}" fill="url(#${id}side)" stroke="url(#${id}side)" stroke-width="${stroke}" stroke-linejoin="round"/>`;
  return `<g transform="${T}">
    <path transform="translate(${depth * dx} ${depth * dy})" d="${d}" fill="${OUT}" stroke="${OUT}" stroke-width="${stroke + 16}" stroke-linejoin="round"/>
    <path d="${d}" fill="${OUT}" stroke="${OUT}" stroke-width="${stroke + 16}" stroke-linejoin="round"/>
    ${side}
    <path d="${d}" fill="#5a3500" stroke="#5a3500" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="${d}" fill="url(#${id}gold)"/>
    <path d="${d}" fill="none" stroke="#fff8d8" stroke-width="3" opacity="0.85"/>
  </g>`;
}

/** Two stadium light beams from the top corners. */
const beams = (W, H, op = 0.16) => `
  <polygon points="${W * 0.08},-20 ${W * 0.16},-20 ${W * 0.62},${H} ${W * 0.30},${H}" fill="url(#beam)" opacity="${op}"/>
  <polygon points="${W * 0.84},-20 ${W * 0.92},-20 ${W * 0.70},${H} ${W * 0.38},${H}" fill="url(#beam)" opacity="${op}"/>`;

const bgDefs = (W, H) => `
  <radialGradient id="bg" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="${ROYAL}"/><stop offset="0.55" stop-color="#121a6a"/><stop offset="1" stop-color="${NIGHT}"/></radialGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WHITE}"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/></linearGradient>
  <linearGradient id="streak" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></linearGradient>
  <radialGradient id="flare" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${WHITE}"/><stop offset="0.25" stop-color="#fff3b0" stop-opacity="0.8"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>`;

/** Bokeh crowd lights along the bottom. */
function crowd(W, y0, y1, seed, n = 60) {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = y0 + R() * (y1 - y0), r = 3 + R() * 9;
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${R() < 0.5 ? '#ffd86b' : '#9fb6ff'}" opacity="${(0.15 + R() * 0.35).toFixed(2)}"/>`;
  }
  return out;
}

/** An impact flash at (x, y): soft glow, a white star and short rays; plus a golden light streak towards angle `ang`. */
function impact(x, y, r, ang = -45, len = 420) {
  const a = (ang * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const w = r * 0.9;
  const streak = `<polygon points="${x + nx * w},${y + ny * w} ${x + ux * len},${y + uy * len} ${x - nx * w},${y - ny * w}" fill="url(#streak)" opacity="0.9"/>`;
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const b = a + Math.PI + (i - 3.5) * 0.34;
    rays += `<path d="M ${x + Math.cos(b) * r * 1.25} ${y + Math.sin(b) * r * 1.25} L ${x + Math.cos(b) * r * (1.6 + (i % 2) * 0.35)} ${y + Math.sin(b) * r * (1.6 + (i % 2) * 0.35)}" stroke="#fff3b0" stroke-width="${r * 0.09}" stroke-linecap="round"/>`;
  }
  return `${streak}<polygon points="${burst(x, y, r * 1.75, r * 0.7, 10, 0.2)}" fill="#fff6c8" opacity="0.85"/>${rays}`;
}

function icon() {
  const f = font('archivo', 900, 'italic');
  const three = layout(f, '3', 880);
  const tx = 512 - three.bbox.w / 2 - three.bbox.x1 - 16, ty = 512 + three.bbox.h / 2 - 6;
  const bx = 700, by = 262;
  return svg(1024, 1024, `<defs>${bgDefs(1024, 1024)}${goldDefs('i')}</defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    ${beams(1024, 1024, 0.2)}
    ${crowd(1024, 820, 1010, 4, 40)}
    <circle cx="${bx}" cy="${by}" r="300" fill="url(#flare)" opacity="0.55"/>
    ${gold('i', joined(three), `translate(${tx} ${ty})`, { depth: 16, stroke: 22 })}
    ${impact(bx, by, 104, -40, 520)}
    ${ball(bx, by, 104, { id: 'ib', rot: -30, outline: OUT, ow: 16 })}`);
}

function logo() {
  const W = 1600, H = 800;
  const f = font('archivo', 900, 'italic');
  const por = layout(f, 'POR', 150, { tracking: 0.01 }), tres = layout(f, 'TRES', 230, { tracking: 0.0 });
  const tag = layout(font('archivo', 900, 'italic'), 'PADEL CAREER', 48, { tracking: 0.22 });
  const big3 = layout(f, '3', 900);
  const cx = W / 2;
  const tx = cx - tres.bbox.w / 2 - tres.bbox.x1, ty = 520;
  const px = cx - por.bbox.w / 2 - por.bbox.x1 - 120, py = ty - tres.bbox.h - 34;
  const bx = cx + tres.bbox.w / 2 + 40, by = py - 70;
  const stripY = ty + 54, stripW = tag.bbox.w + 140;
  return svg(W, H, `<defs>${bgDefs(W, H)}${goldDefs('l')}
      <linearGradient id="strip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f49ff"/><stop offset="1" stop-color="#1424a8"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${beams(W, H, 0.14)}
    ${crowd(W, 620, 790, 9, 90)}
    <path transform="translate(${cx - big3.bbox.w / 2 - big3.bbox.x1 + 380} ${H / 2 + big3.bbox.h / 2 - 40})" d="${joined(big3)}" fill="#ffffff" opacity="0.06"/>
    <circle cx="${bx}" cy="${by}" r="260" fill="url(#flare)" opacity="0.5"/>
    <path d="M ${px - 60} ${ty + 20} Q ${cx} ${ty - 520} ${bx} ${by}" fill="none" stroke="#fff3b0" stroke-width="8" stroke-linecap="round" opacity="0.55" stroke-dasharray="2 18"/>
    ${gold('lp', joined(por), `translate(${px} ${py})`, { depth: 8, stroke: 14 })}
    ${gold('l', joined(tres), `translate(${tx} ${ty})`, { depth: 12, stroke: 18 })}
    ${impact(bx, by, 62, -30, 300)}
    ${ball(bx, by, 62, { id: 'lb', rot: -30, outline: OUT, ow: 12 })}
    <g transform="translate(${cx - stripW / 2} ${stripY}) skewX(-14)">
      <rect x="0" y="0" width="${stripW}" height="76" fill="url(#strip)" stroke="#ffd23f" stroke-width="6"/>
      <path transform="translate(${70 - tag.bbox.x1} 58)" d="${joined(tag)}" fill="${WHITE}"/>
    </g>`.replace('id="lgold"', 'id="lgold"').replace(/url\(#lpgold\)/g, 'url(#lgold)').replace(/url\(#lpside\)/g, 'url(#lside)'));
}

save('out/C3_icon.svg', icon());
save('out/C3_logo.svg', logo());
