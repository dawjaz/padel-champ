// D: COMIC (the game's own look). The real hero from the game, sunburst, comic lettering with a 3D extrusion.
import { font, layout, joined, svg, save, ball, burst, toonInner, rng } from './lib.mjs';
const OUT = '#14213d', NAVY = '#0b2a5b', BLUE = '#1e6bff', BLUE_L = '#4b8bff', ORANGE = '#d93f00', ORANGE_L = '#f0642a', GOLD = '#ffb800', YELLOW = '#ffe066', WHITE = '#ffffff';

function rays(cx, cy, n, r, c1, c2, rot = 0) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/>`;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 0.5) / n) * Math.PI * 2;
    out += `<polygon points="${cx},${cy} ${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r} ${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r}" fill="${c2}"/>`;
  }
  return out;
}

const halftone = (id, color, step = 22, rMax = 6) => `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="${step / 2}" cy="${step / 2}" r="${rMax}" fill="${color}"/></pattern>`;

/** Comic text: navy outline, an orange 3D extrusion (down-right), white face with a soft top shade. */
function comicWord(lay, x, y, { depth = 10, stroke = 20, face = WHITE, ext = ORANGE, id = 'w' } = {}) {
  const d = joined(lay);
  const at = (i) => `translate(${(x + i * 1.1).toFixed(1)} ${(y + i * 1.5).toFixed(1)})`;
  let outer = '', side = '';
  for (let i = depth; i >= 0; i--) outer += `<path transform="${at(i)}" d="${d}" fill="${OUT}" stroke="${OUT}" stroke-width="${stroke + 14}" stroke-linejoin="round"/>`;
  for (let i = depth; i >= 1; i--) side += `<path transform="${at(i)}" d="${d}" fill="${ext}" stroke="${ext}" stroke-width="${stroke}" stroke-linejoin="round"/>`;
  return `${outer}${side}
    <path transform="${at(0)}" d="${d}" fill="${OUT}" stroke="${OUT}" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path transform="${at(0)}" d="${d}" fill="url(#${id}face)"/>`;
}

function logo() {
  const W = 1600, H = 760;
  const f = font('luckiest-guy', 400);
  const por = layout(f, 'POR', 170, { tracking: 0.03 });
  const tres = layout(f, 'TRES!', 300, { tracking: 0.02 });
  const tag = layout(font('baloo-2', 800), 'PADEL CAREER', 62, { tracking: 0.12 });
  const cx = W / 2, cy = 380;
  const R = rng(5);
  const jag = (i) => (i % 2 === 0 ? 0.86 + R() * 0.28 : 0.92 + R() * 0.16);
  const burstPts = burst(cx, cy, 335, 240, 14, -0.2, jag);
  const burstPts2 = burst(cx + 18, cy + 22, 345, 248, 14, -0.2, (i) => 1);
  const tx = cx - tres.bbox.w / 2 - tres.bbox.x1, ty = cy + 150;
  const px = cx - por.bbox.w / 2 - por.bbox.x1 - 40, py = cy - 95;
  // ribbon
  const rw = tag.bbox.w + 120, rh = 96, rx = cx - rw / 2, ry = cy + 240;
  const ribbon = `<g>
    <polygon points="${rx - 70},${ry + 26} ${rx + 20},${ry + 26} ${rx + 20},${ry + rh + 26} ${rx - 70},${ry + rh + 26} ${rx - 40},${ry + 26 + rh / 2}" fill="${NAVY}" stroke="${OUT}" stroke-width="10" stroke-linejoin="round"/>
    <polygon points="${rx + rw + 70},${ry + 26} ${rx + rw - 20},${ry + 26} ${rx + rw - 20},${ry + rh + 26} ${rx + rw + 70},${ry + rh + 26} ${rx + rw + 40},${ry + 26 + rh / 2}" fill="${NAVY}" stroke="${OUT}" stroke-width="10" stroke-linejoin="round"/>
    <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="10" fill="${BLUE}" stroke="${OUT}" stroke-width="10"/>
    <rect x="${rx + 10}" y="${ry + 10}" width="${rw - 20}" height="${rh * 0.34}" rx="8" fill="${WHITE}" opacity="0.18"/>
    <path transform="translate(${cx - tag.bbox.w / 2 - tag.bbox.x1} ${ry + rh / 2 + 22})" d="${joined(tag)}" fill="${WHITE}"/>
  </g>`;
  const defs = `<defs>
    <radialGradient id="dbg" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="${BLUE_L}"/><stop offset="0.6" stop-color="${BLUE}"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
    <radialGradient id="dburst" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#fff3a6"/><stop offset="0.6" stop-color="${YELLOW}"/><stop offset="1" stop-color="${GOLD}"/></radialGradient>
    <linearGradient id="wface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WHITE}"/><stop offset="0.6" stop-color="${WHITE}"/><stop offset="1" stop-color="#dfe9ff"/></linearGradient>
    <linearGradient id="pface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WHITE}"/><stop offset="1" stop-color="#ffe9c2"/></linearGradient>
    ${halftone('dots', ORANGE_L, 26, 5.5)}
    <clipPath id="bclip"><polygon points="${burstPts}"/></clipPath>
  </defs>`;
  const body = `${defs}<rect width="${W}" height="${H}" fill="url(#dbg)"/>
    <g opacity="0.22">${rays(cx, cy, 28, 1100, 'none', WHITE, 0.05)}</g>
    <polygon points="${burstPts2}" fill="${ORANGE}" stroke="${OUT}" stroke-width="14" stroke-linejoin="round"/>
    <polygon points="${burstPts}" fill="url(#dburst)" stroke="${OUT}" stroke-width="14" stroke-linejoin="round"/>
    <g clip-path="url(#bclip)" opacity="0.45"><rect x="${cx - 400}" y="${cy + 40}" width="800" height="400" fill="url(#dots)"/></g>
    <g transform="rotate(-6 ${cx} ${cy})">
      <g transform="rotate(-4 ${px} ${py})">${comicWord(por, px, py, { depth: 7, stroke: 18, ext: BLUE, id: 'p' })}</g>
      ${comicWord(tres, tx, ty, { depth: 11, stroke: 22, ext: ORANGE, id: 'w' })}
    </g>
    ${ball(cx + 330, cy - 200, 62, { id: 'dball', rot: -30, outline: OUT, ow: 14 })}
    <g stroke="${OUT}" stroke-width="10" stroke-linecap="round">
      <path d="M ${cx + 230} ${cy - 160} l -80 30"/><path d="M ${cx + 250} ${cy - 120} l -60 34"/><path d="M ${cx + 270} ${cy - 250} l -70 6"/>
    </g>
    ${ribbon}`;
  return svg(W, H, body);
}

function icon() {
  const { inner } = toonInner('hero_smashHit.svg');
  const k = 4.0, cx0 = -9, cy0 = -130;
  const defs = `<defs>
    <radialGradient id="ibg" cx="0.42" cy="0.55" r="0.8"><stop offset="0" stop-color="#fff3a6"/><stop offset="0.45" stop-color="${YELLOW}"/><stop offset="1" stop-color="${GOLD}"/></radialGradient>
    ${halftone('idots', ORANGE_L, 30, 6)}
    <radialGradient id="ivig" cx="0.45" cy="0.5" r="0.75"><stop offset="0.62" stop-color="${ORANGE}" stop-opacity="0"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0.6"/></radialGradient>
  </defs>`;
  const hero = `<g transform="scale(${k}) translate(${-cx0} ${-cy0})">${inner}</g>`;
  const bx = 748, by = 206;
  const body = `${defs}<rect width="1024" height="1024" fill="url(#ibg)"/>
    ${rays(bx - 80, by + 120, 24, 1500, 'none', '#ffd23f', 0.05)}
    <rect width="1024" height="1024" fill="url(#idots)" opacity="0.25"/>
    <rect width="1024" height="1024" fill="url(#ivig)"/>
    <polygon points="${burst(bx, by, 190, 112, 11, 0.25, (i) => (i % 2 ? 1 : 0.85 + (i % 3) * 0.1))}" fill="${WHITE}" stroke="${OUT}" stroke-width="14" stroke-linejoin="round"/>
    ${hero}
    ${ball(bx, by, 92, { id: 'iball', rot: -30, outline: OUT, ow: 18 })}
    <g stroke="${OUT}" stroke-width="15" stroke-linecap="round">
      <path d="M ${bx + 120} ${by - 30} l 70 -30"/><path d="M ${bx + 110} ${by + 50} l 80 14"/><path d="M ${bx + 40} ${by - 118} l 22 -70"/>
    </g>`;
  return svg(1024, 1024, body);
}

save('out/D_logo.svg', logo());
save('out/D_icon.svg', icon());
