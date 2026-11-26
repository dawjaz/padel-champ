// A: MODERN. Deep navy, neon lime ball, the por tres path as the mark.
import { font, layout, joined, svg, save, ball } from './lib.mjs';
const LIME = '#d9f53c', CYAN = '#5ce1ff', NAVY = '#0a1640', NAVY2 = '#1b3fa0', WHITE = '#ffffff';

/** The mark, drawn in a 1024 box. */
function mark(id, { bg = true } = {}) {
  const defs = `<defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient>
    <radialGradient id="${id}glow" cx="0.81" cy="0.29" r="0.45"><stop offset="0" stop-color="${LIME}" stop-opacity="0.35"/><stop offset="1" stop-color="${LIME}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}tail" gradientUnits="userSpaceOnUse" x1="148" y1="150" x2="380" y2="846"><stop offset="0" stop-color="${LIME}" stop-opacity="0"/><stop offset="0.7" stop-color="${LIME}" stop-opacity="1"/></linearGradient>
    <linearGradient id="${id}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${CYAN}" stop-opacity="0.38"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0.12"/></linearGradient>
  </defs>`;
  const back = bg ? `<rect width="1024" height="1024" fill="url(#${id}bg)"/><rect width="1024" height="1024" fill="url(#${id}glow)"/>` : '';
  const floor = `<rect x="80" y="866" width="864" height="10" rx="5" fill="${WHITE}" opacity="0.16"/>`;
  // a glass wall panel seen slightly from the side (top edge slanted), with a steel cap and two sheen lines
  const glass = `<polygon points="566,520 770,486 770,866 566,866" fill="url(#${id}glass)" stroke="${CYAN}" stroke-width="10" stroke-linejoin="round"/>
    <polygon points="566,520 770,486 770,506 566,540" fill="${CYAN}" opacity="0.85"/>
    <path d="M 600 610 L 690 560 M 600 668 L 650 640" stroke="${WHITE}" stroke-width="12" stroke-linecap="round" opacity="0.5"/>`;
  const path = `<path d="M 148 150 L 380 846" fill="none" stroke="url(#${id}tail)" stroke-width="46" stroke-linecap="round"/>
    <path d="M 380 846 Q 580 120 830 300" fill="none" stroke="${LIME}" stroke-width="46" stroke-linecap="round"/>`;
  const splash = `<g stroke="${WHITE}" stroke-width="14" stroke-linecap="round" opacity="0.9">
    <path d="M 380 846 m -70 -4 l -44 -8"/><path d="M 380 846 m -50 -46 l -32 -32"/><path d="M 380 846 m 66 4 l 44 -2"/></g>`;
  const motion = `<g stroke="${LIME}" stroke-width="12" stroke-linecap="round" opacity="0.55"><path d="M 900 196 l 50 -40"/><path d="M 946 262 l 56 -26"/></g>`;
  return defs + back + floor + glass + path + splash + motion + ball(830, 300, 112, { id: `${id}ball`, rot: -30 });
}

save('out/A_icon.svg', svg(1024, 1024, mark('ai')));

// Wordmark lockup: mark (rounded) + PorTres, two-tone, + tagline.
function lockup(dark) {
  const W = 1600, H = 560;
  const f = font('unbounded', 900);
  const por = layout(f, 'Por', 210), tres = layout(f, 'Tres', 210, { tracking: -0.01 });
  const tag = layout(font('unbounded', 600), 'PADEL CAREER', 46, { tracking: 0.32 });
  const x0 = 520, base = 330;
  const gap = -4;
  const body = `${dark ? `<rect width="${W}" height="${H}" fill="${NAVY}"/>` : `<rect width="${W}" height="${H}" fill="#f2f5fb"/>`}
  <g transform="translate(70 70) scale(0.41)"><clipPath id="lk${dark}"><rect width="1024" height="1024" rx="230"/></clipPath><g clip-path="url(#lk${dark})">${mark('lm' + dark)}</g></g>
  <path transform="translate(${x0} ${base})" d="${joined(por)}" fill="${dark ? WHITE : NAVY}"/>
  <path transform="translate(${x0 + por.advance + gap} ${base})" d="${joined(tres)}" fill="${dark ? LIME : '#3c55d8'}"/>
  <path transform="translate(${x0 + 8} ${base + 96})" d="${joined(tag)}" fill="${dark ? CYAN : '#5a6b8c'}"/>`;
  return svg(W, H, body);
}
save('out/A_logo_dark.svg', lockup(true));
save('out/A_logo_light.svg', lockup(false));
