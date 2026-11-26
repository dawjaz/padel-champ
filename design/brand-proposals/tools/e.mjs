// C2: ESPORTS CREST. Black/graphite, electric lime, white. An angular club crest with a padel racket and the ball.
import { font, layout, joined, svg, save, ball, rng } from './lib.mjs';
const LIME = '#c8ff2e', LIME_D = '#7fae00', INK = '#0b0d10', GRAPH = '#1d2229', GRAPH2 = '#2c333d', WHITE = '#ffffff';

/** The crest outline, scaled around (512, 512). */
const CREST = [[200, 150], [420, 150], [512, 104], [604, 150], [824, 150], [884, 236], [884, 548], [512, 938], [140, 548], [140, 236]];
const pts = (P, k = 1, ox = 0, oy = 0) => P.map(([x, y]) => `${(512 + (x - 512) * k + ox).toFixed(1)},${(512 + (y - 512) * k + oy).toFixed(1)}`).join(' ');

/** A padel racket in local units (head centre at 0,0, handle down), with holes. */
function racket(id, { frame = WHITE, face = GRAPH2, hole = INK, grip = [LIME, INK] } = {}) {
  let holes = '';
  for (let y = -140; y <= 120; y += 34) for (let x = -120; x <= 120; x += 34) {
    const xx = x + ((y / 34) % 2 ? 17 : 0);
    if ((xx / 118) ** 2 + ((y + 4) / 140) ** 2 < 0.78) holes += `<circle cx="${xx}" cy="${y}" r="9"/>`;
  }
  let stripes = '';
  for (let i = 0; i < 6; i++) stripes += `<polygon points="-30,${262 + i * 30} 30,${248 + i * 30} 30,${262 + i * 30} -30,${276 + i * 30}" fill="${grip[1]}"/>`;
  return `<g>
    <rect x="-30" y="230" width="60" height="196" rx="10" fill="${grip[0]}" stroke="${INK}" stroke-width="14"/>
    ${stripes}
    <rect x="-36" y="418" width="72" height="30" rx="10" fill="${INK}"/>
    <path d="M -104 120 L 104 120 L 40 240 L -40 240 Z" fill="${frame}" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M -46 150 L 46 150 L 0 212 Z" fill="${INK}"/>
    <ellipse cx="0" cy="0" rx="168" ry="196" fill="${frame}" stroke="${INK}" stroke-width="14"/>
    <ellipse cx="0" cy="0" rx="138" ry="166" fill="${face}"/>
    <g fill="${hole}">${holes}</g>
    <path d="M -110 -96 A 138 166 0 0 1 40 -160" fill="none" stroke="${WHITE}" stroke-width="12" stroke-linecap="round" opacity="0.35"/>
  </g>`;
}

/** Angular speed slashes trailing behind (x, y) towards angle `ang` (deg). */
function slashes(x, y, ang, { n = 3, len = 260, w = 30, color = LIME, gap = 46 } = {}) {
  const a = (ang * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  let out = '';
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * gap;
    const L = len * (i === (n - 1) / 2 ? 1 : 0.7);
    const sx = x + nx * off, sy = y + ny * off;
    const ex = sx + ux * L, ey = sy + uy * L;
    out += `<polygon points="${sx + nx * w / 2},${sy + ny * w / 2} ${ex},${ey} ${sx - nx * w / 2},${sy - ny * w / 2}" fill="${color}"/>`;
  }
  return out;
}

function crest(id, { glow = true } = {}) {
  return `<defs>
      <linearGradient id="${id}fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GRAPH2}"/><stop offset="1" stop-color="${INK}"/></linearGradient>
      <clipPath id="${id}clip"><polygon points="${pts(CREST, 0.9)}"/></clipPath>
    </defs>
    ${glow ? `<polygon points="${pts(CREST, 1.04)}" fill="${LIME}" opacity="0.18"/>` : ''}
    <polygon points="${pts(CREST)}" fill="${INK}" stroke="${INK}" stroke-width="30" stroke-linejoin="round"/>
    <polygon points="${pts(CREST)}" fill="${LIME}"/>
    <polygon points="${pts(CREST, 0.93)}" fill="${INK}"/>
    <polygon points="${pts(CREST, 0.9)}" fill="url(#${id}fill)"/>
    <g clip-path="url(#${id}clip)">
      <polygon points="140,700 884,330 884,420 140,790" fill="${WHITE}" opacity="0.05"/>
      ${slashes(612, 420, 152, { n: 3, len: 330, w: 40, gap: 62, color: LIME })}
    </g>
    <g transform="translate(468 536) rotate(-40) scale(0.9)">${racket(id)}</g>
    ${ball(668, 330, 102, { id: `${id}b`, rot: -30, outline: INK, ow: 20, base: ['#efffa8', '#c8ff2e', '#86b800'] })}`;
}

function icon() {
  return svg(1024, 1024, `<defs><radialGradient id="ibg" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#3a4a3c"/><stop offset="1" stop-color="#181d22"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#ibg)"/>
    ${[0, 1, 2, 3].map((i) => `<polygon points="${-200 + i * 330},1024 ${-40 + i * 330},1024 ${360 + i * 330},0 ${200 + i * 330},0" fill="${LIME}" opacity="0.035"/>`).join('')}
    <g transform="translate(512 528) scale(0.96) translate(-512 -512)">${crest('ic')}</g>`);
}

function logo() {
  const W = 1600, H = 820;
  const f = font('chakra-petch', 700, 'italic');
  const por = layout(f, 'POR', 168, { tracking: 0.02 }), tres = layout(f, 'TRES', 168, { tracking: 0.02 });
  const gap = 46, total = por.bbox.w + gap + tres.bbox.w;
  const bx = (W - total) / 2, by = 650;
  const tag = layout(font('chakra-petch', 700, 'normal'), 'PADEL CAREER', 44, { tracking: 0.34 });
  const bannerW = total + 150, bannerH = 196, bannerX = (W - bannerW) / 2, bannerY = by - 160;
  const sk = 0.2; // banner slant
  const banner = (x, y, w, h) => `${x + h * sk},${y} ${x + w + h * sk},${y} ${x + w},${y + h} ${x},${y + h}`;
  return svg(W, H, `<defs><radialGradient id="lbg" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="#232b25"/><stop offset="1" stop-color="${INK}"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#lbg)"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<polygon points="${-300 + i * 340},${H} ${-180 + i * 340},${H} ${220 + i * 340},0 ${100 + i * 340},0" fill="${LIME}" opacity="0.04"/>`).join('')}
    <polygon points="0,${bannerY + 60} ${W},${bannerY + 20} ${W},${bannerY + 34} 0,${bannerY + 74}" fill="${LIME}" opacity="0.5"/>
    <g transform="translate(${W / 2} 300) scale(0.5) translate(-512 -512)">${crest('lc', { glow: true })}</g>
    <polygon points="${banner(bannerX - 10, bannerY - 10, bannerW + 20, bannerH + 20)}" fill="${LIME}"/>
    <polygon points="${banner(bannerX, bannerY, bannerW, bannerH)}" fill="${INK}"/>
    <polygon points="${banner(bannerX + 14, bannerY + 14, bannerW - 28, 10)}" fill="${WHITE}" opacity="0.12"/>
    <path transform="translate(${bx - por.bbox.x1} ${by})" d="${joined(por)}" fill="${WHITE}"/>
    <path transform="translate(${bx + por.bbox.w + gap - tres.bbox.x1} ${by})" d="${joined(tres)}" fill="${LIME}"/>
    <g transform="translate(${(W - tag.bbox.w) / 2 - tag.bbox.x1} ${bannerY + bannerH + 78})"><path d="${joined(tag)}" fill="${WHITE}"/></g>
    <rect x="${(W - tag.bbox.w) / 2 - 90}" y="${bannerY + bannerH + 56}" width="60" height="8" fill="${LIME}"/>
    <rect x="${(W + tag.bbox.w) / 2 + 30}" y="${bannerY + bannerH + 56}" width="60" height="8" fill="${LIME}"/>`);
}

save('out/C2_icon.svg', icon());
save('out/C2_logo.svg', logo());
