// Hybrids of C (fireball, skewed speed-cut lettering) and C2 (esports crest, banner, racket).
import { font, layout, joined, svg, save, ball } from './lib.mjs';
import { flame, cracks, shards } from './c.mjs';
import { racket, CREST, pts } from './e.mjs';

const V = {
  H1: { bg: ['#25307a', '#0a0f2e'], crestFill: ['#1f2b78', '#0a0f2e'], rim: '#ff5a1f', rim2: '#ffd23f', ink: '#0a0f2e', face: '#1a2470', grip: ['#ff5a1f', '#0a0f2e'],
        word: ['#ffffff', '#fff3b0', '#ffd23f'], shadow: '#e8261c', por: '#ff5a1f', porText: '#ffffff', banner: '#0a0f2e', tag: '#ffffff', glow: '#ff5a1f' },
  H2: { bg: ['#34423a', '#121619'], crestFill: ['#2c333d', '#0b0d10'], rim: '#c8ff2e', rim2: '#c8ff2e', ink: '#0b0d10', face: '#2c333d', grip: ['#c8ff2e', '#0b0d10'],
        word: ['#ffffff', '#f2ffc4', '#c8ff2e'], shadow: '#ff5a1f', por: '#c8ff2e', porText: '#0b0d10', banner: '#0b0d10', tag: '#ffffff', glow: '#c8ff2e' },
};

function crest(id, c) {
  return `<defs>
      <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.crestFill[0]}"/><stop offset="1" stop-color="${c.crestFill[1]}"/></linearGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.rim2}"/><stop offset="1" stop-color="${c.rim}"/></linearGradient>
      <linearGradient id="shardg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/><stop offset="0.35" stop-color="#7fe8ff" stop-opacity="0.55"/><stop offset="1" stop-color="#7fe8ff" stop-opacity="0.15"/></linearGradient>
      <clipPath id="${id}c"><polygon points="${pts(CREST, 0.9)}"/></clipPath></defs>
    <polygon points="${pts(CREST, 1.05)}" fill="${c.glow}" opacity="0.2"/>
    <polygon points="${pts(CREST)}" fill="${c.ink}" stroke="${c.ink}" stroke-width="30" stroke-linejoin="round"/>
    <polygon points="${pts(CREST)}" fill="url(#${id}r)"/>
    <polygon points="${pts(CREST, 0.93)}" fill="${c.ink}"/>
    <polygon points="${pts(CREST, 0.9)}" fill="url(#${id}f)"/>
    <g clip-path="url(#${id}c)">${cracks(640, 330, 4, { n: 12, rMin: 250, rMax: 520, w: 9, color: '#d8f6ff' }).replace(/opacity="0.85"/g, 'opacity="0.38"')}</g>`;
}

function icon(k) {
  const c = V[k], bx = 690, by = 300, r = 118;
  return svg(1024, 1024, `<defs><radialGradient id="bg" cx="0.55" cy="0.4" r="0.8"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <g transform="translate(512 540) scale(0.94) translate(-512 -512)">
      ${crest('ic', c)}
      ${flame('if', bx, by, 420, 600, r * 2.0, 3)}
      <g transform="translate(420 590) rotate(-40) scale(0.86)">${racket('ic', { face: c.face, hole: c.ink, grip: c.grip })}</g>
      ${shards(bx, by, 7, { n: 6, r0: 190, r1: 320, s0: 50, s1: 90 })}
      ${ball(bx, by, r, { id: 'ib', rot: -40, outline: c.ink, ow: 18 })}
    </g>`);
}

/** C-style lettering: skewed Anton, red/orange hard shadow, dark outline, gradient face with speed cuts. */
function word(id, lay, x, y, c, { skew = -13, stroke = 22, sh = 14, cuts = true } = {}) {
  const d = joined(lay), T = (dx, dy) => `translate(${x + dx} ${y + dy}) skewX(${skew})`;
  const h = lay.bbox.h;
  return `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.word[0]}"/><stop offset="0.55" stop-color="${c.word[1]}"/><stop offset="1" stop-color="${c.word[2]}"/></linearGradient>
    <mask id="${id}m" maskUnits="userSpaceOnUse" x="-400" y="-900" width="3000" height="1200"><rect x="-400" y="-900" width="3000" height="1200" fill="white"/>
    ${cuts ? [0, 1, 2].map((i) => `<rect x="-400" y="${-h * 0.34 + i * h * 0.11}" width="3000" height="${(h * 0.03 * (1 - i * 0.25)).toFixed(1)}" fill="black"/>`).join('') : ''}</mask></defs>
    <g transform="${T(sh, sh)}"><path d="${d}" fill="${c.shadow}" stroke="${c.shadow}" stroke-width="${stroke}" stroke-linejoin="round"/></g>
    <g transform="${T(0, 0)}"><path d="${d}" fill="none" stroke="${c.ink}" stroke-width="${stroke}" stroke-linejoin="round"/></g>
    <g transform="${T(0, 0)}" mask="url(#${id}m)"><path d="${d}" fill="url(#${id}g)"/></g>`;
}

function logo(k) {
  const c = V[k], W = 1600, H = 820;
  const anton = font('anton', 400);
  const tres = layout(anton, 'TRES', 250, { tracking: 0.02 }), por = layout(anton, 'POR', 120, { tracking: 0.04 });
  const tag = layout(font('big-shoulders-display', 900), 'PADEL CAREER', 50, { tracking: 0.3 });
  const porPad = 30, total = por.bbox.w + porPad * 2 + 40 + tres.bbox.w;
  const x0 = (W - total) / 2, by = 660;
  const bannerX = x0 - 70, bannerW = total + 150, bannerY = by - tres.bbox.h - 40, bannerH = tres.bbox.h + 80;
  const sk = 0.22, poly = (x, y, w, h) => `${x + h * sk},${y} ${x + w + h * sk},${y} ${x + w},${y + h} ${x},${y + h}`;
  const tx = x0 + por.bbox.w + porPad * 2 + 40;
  const porY = by - (tres.bbox.h - por.bbox.h) / 2 - 10;
  return svg(W, H, `<defs><radialGradient id="lbg" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#lbg)"/>
    <polygon points="0,${bannerY + 70} ${W},${bannerY - 10} ${W},${bannerY + 6} 0,${bannerY + 86}" fill="${c.rim}" opacity="0.8"/>
    <polygon points="0,${bannerY + 96} ${W},${bannerY + 16} ${W},${bannerY + 22} 0,${bannerY + 102}" fill="${c.rim2}" opacity="0.6"/>
    <g transform="translate(${W / 2} 250) scale(0.44) translate(-512 -512)">
      ${crest('lc', c)}
      ${flame('lf', 690, 300, 420, 600, 236, 3)}
      <g transform="translate(420 590) rotate(-40) scale(0.86)">${racket('lc', { face: c.face, hole: c.ink, grip: c.grip })}</g>
      ${shards(690, 300, 7, { n: 6, r0: 190, r1: 320, s0: 50, s1: 90 })}
      ${ball(690, 300, 118, { id: 'lball', rot: -40, outline: c.ink, ow: 18 })}
    </g>
    <polygon points="${poly(bannerX - 12, bannerY - 12, bannerW + 24, bannerH + 24)}" fill="${c.rim}"/>
    <polygon points="${poly(bannerX, bannerY, bannerW, bannerH)}" fill="${c.banner}"/>
    <g transform="translate(${x0} ${porY}) skewX(-13)"><rect x="0" y="${-por.bbox.h - porPad + 4}" width="${por.bbox.w + porPad * 2}" height="${por.bbox.h + porPad * 2 - 8}" fill="${c.por}"/>
      <path transform="translate(${porPad - por.bbox.x1} 0)" d="${joined(por)}" fill="${c.porText}"/></g>
    ${word('w' + k, tres, tx - tres.bbox.x1, by, c)}
    <path transform="translate(${(W - tag.bbox.w) / 2 - tag.bbox.x1} ${bannerY + bannerH + 84})" d="${joined(tag)}" fill="${c.tag}"/>
    <rect x="${(W - tag.bbox.w) / 2 - 90}" y="${bannerY + bannerH + 58}" width="60" height="8" fill="${c.rim}"/>
    <rect x="${(W + tag.bbox.w) / 2 + 30}" y="${bannerY + bannerH + 58}" width="60" height="8" fill="${c.rim}"/>`);
}

for (const k of ['H1', 'H2']) { save(`out/${k}_icon.svg`, icon(k)); save(`out/${k}_logo.svg`, logo(k)); }
