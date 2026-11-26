import { project, type Projected } from '../camera';
import type { CourtTheme } from './courtThemes';

/**
 * The venue around the court, drawn into the arena picture (see arenaHd.ts): stands with a seated crowd on three sides, LED
 * boards along the barriers, the dark run-off floor around the raised court, and a few people and things beside it (umpire
 * chair, team benches, ball kids, a TV camera, a photographer). Everything is placed in court metres and projected with the
 * match camera, so it sits in the same perspective as the court.
 *
 * Readability rules (the court must stay the brightest, sharpest thing on screen):
 * - the stands are drawn on their own layer and softened (down- and up-sampled: a cheap depth of field without canvas filters);
 * - the crowd is darker and less saturated the higher it sits, and hazes into the theme's sky colour;
 * - nothing stands inside the walls, and the people beside the court are small, still and muted.
 *
 * `cheerGroup` draws the same crowd (same seats, same people) with one of `CHEER_GROUPS` random quarters of it celebrating:
 * standing, arms up, scarves and flags. The match fades in none, some or all of these groups for a moment after a point (see
 * hdTextures.ts), so the crowd reacts differently every time and nothing moves during a rally.
 */

type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];
type Pt = { x: number; y: number };

const W = 360;
const P = project;

/** Floor level around the court: the court is a slab raised 0.45 m above it (see arenaHd.ts). */
export const RUNOFF_H = -0.45;
/** The front face of the back stands (behind the far glass) and of the side stands. */
const BACK_Z = -2.6;
const SIDE_X = 7.4;
/** Rows: depth and rise of each step. */
const ROW_D = 0.85;
const ROW_RISE = 0.42;
const ROWS = 9;
/** The side stands run past the bottom of the screen. */
const Z_END = 27;
/** Height of the barrier (with its LED board) in front of the stands. */
const BARRIER = 0.95;
/** The crowd is split into this many random groups that cheer independently. */
export const CHEER_GROUPS = 4;

// ---------- colours ----------

function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const triple = (s: string): RGB => s.split(',').map((v) => Number(v)) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const grey = (c: RGB): RGB => {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  return [l, l, l];
};

const NEUTRAL_SHIRTS = ['#f1f1ec', '#dfe3ea', '#a3abba', '#59616f', '#2c313b', '#1f2c4c', '#cbb99e', '#8a5f45', '#3c5a8a', '#b04a3c'].map(rgb);
const SKIN = ['#f3d4bb', '#e7b590', '#cc916a', '#a26b4b', '#704631'].map(rgb);
const HAIR = ['#2a1d16', '#4a3020', '#7a5230', '#c9a466', '#161616', '#8d8d8d'].map(rgb);

interface Palette {
  dark: RGB;
  sky: RGB;
  light: RGB;
  accents: RGB[];
  seat: RGB;
  concrete: RGB;
  board: [RGB, RGB, RGB];
  carpet: RGB;
}

function paletteOf(theme: CourtTheme): Palette {
  const sky = rgb(theme.skyTop);
  return {
    sky,
    dark: mix(sky, [4, 8, 20], 0.55),
    light: triple(theme.spot),
    // The theme's crowd tones are bright: muted here so that shirts do not sparkle.
    accents: theme.crowd.map((c) => mix(rgb(c), grey(rgb(c)), 0.3)),
    seat: mix(rgb(theme.adMid), [20, 24, 40], 0.35),
    concrete: mix(rgb(theme.groundBottom), [30, 34, 44], 0.4),
    board: [rgb(theme.adTop), rgb(theme.adMid), rgb(theme.adBottom)],
    carpet: mix(rgb(theme.slabBottom), [6, 10, 24], 0.35),
  };
}

// ---------- small drawing helpers ----------

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function poly(g: Ctx, pts: Pt[]): void {
  g.beginPath();
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  g.closePath();
}

function fillPoly(g: Ctx, pts: Pt[], style: string | CanvasGradient): void {
  g.fillStyle = style;
  poly(g, pts);
  g.fill();
}

function line(g: Ctx, a: Pt, b: Pt): void {
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.stroke();
}

function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.lineTo(x + w - k, y);
  g.quadraticCurveTo(x + w, y, x + w, y + k);
  g.lineTo(x + w, y + h - k);
  g.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  g.lineTo(x + k, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - k);
  g.lineTo(x, y + k);
  g.quadraticCurveTo(x, y, x + k, y);
  g.closePath();
}

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, style: string): void {
  g.fillStyle = style;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  g.fill();
}

/** Text laid on a flat panel seen in perspective: an affine map of a w x h box onto three corners (fine for short boards). */
function panelText(g: Ctx, tl: Pt, tr: Pt, bl: Pt, text: string, color: string, weight = 800, italic = true, fill = 0.62): void {
  const w = 100;
  const h = 20;
  g.save();
  g.setTransform(
    ((tr.x - tl.x) / w) * g.getTransform().a,
    ((tr.y - tl.y) / w) * g.getTransform().a,
    ((bl.x - tl.x) / h) * g.getTransform().a,
    ((bl.y - tl.y) / h) * g.getTransform().a,
    tl.x * g.getTransform().a,
    tl.y * g.getTransform().a,
  );
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${italic ? 'italic ' : ''}${weight} ${Math.round(h * fill)}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
  let size = Math.round(h * fill);
  while (g.measureText(text).width > w * 0.86 && size > 4) {
    size -= 1;
    g.font = `${italic ? 'italic ' : ''}${weight} ${size}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
  }
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + 0.5);
  g.restore();
}

// ---------- geometry of the stands ----------

const rowFrontZ = (i: number): number => BACK_Z - 0.3 - i * ROW_D;
const rowFrontX = (i: number): number => SIDE_X + 0.3 + i * ROW_D;
const rowH = (i: number): number => (i < 0 ? RUNOFF_H : RUNOFF_H + 0.75 + i * ROW_RISE);

/** Aisles (stairs, no seats): across the back stands at these x, along the side stands at these z. */
const BACK_AISLES = [-3.6, 3.6];
const SIDE_AISLES = [5.2, 13.5, 21.5];

interface Person {
  x: number;
  z: number;
  h: number;
  row: number;
  shirt: RGB;
  skin: RGB;
  hair: RGB;
  hairTop: number;
  empty: boolean;
  size: number;
  /** Cheer pose: 0 seated clapping, 1 standing arms up, 2 standing one arm up, 3 scarf over the head, 4 flag. */
  pose: number;
  flag: RGB;
  /** True for the side stands (false: the stands behind the far glass). */
  onSide: boolean;
  cap: boolean;
  /** Cheer group (0 .. CHEER_GROUPS - 1). */
  group: number;
}

function crowd(pal: Palette, rnd: () => number): Person[][] {
  // rows[i] holds row i of the back stands followed by row i of both side stands, so the caller can draw row by row.
  const rows: Person[][] = [];
  const person = (x: number, z: number, row: number, onSide: boolean): Person => {
    const accent = rnd() < 0.3;
    const shirt = accent ? pal.accents[Math.floor(rnd() * pal.accents.length)] : NEUTRAL_SHIRTS[Math.floor(rnd() * NEUTRAL_SHIRTS.length)];
    const r = rnd();
    return {
      x,
      z,
      h: rowH(row),
      row,
      shirt,
      skin: SKIN[Math.floor(rnd() * SKIN.length)],
      hair: HAIR[Math.floor(rnd() * HAIR.length)],
      hairTop: 0.35 + rnd() * 0.5,
      empty: rnd() < 0.06,
      size: 0.92 + rnd() * 0.16,
      pose: r < 0.15 ? 0 : r < 0.55 ? 1 : r < 0.8 ? 2 : r < 0.94 ? 3 : 4,
      flag: pal.accents[Math.floor(rnd() * pal.accents.length)],
      onSide,
      cap: rnd() < 0.12,
      group: Math.floor(rnd() * CHEER_GROUPS),
    };
  };
  const seatStep = 0.56;
  for (let i = 0; i < ROWS; i++) {
    const list: Person[] = [];
    const zSeat = rowFrontZ(i) - ROW_D / 2;
    const xMax = rowFrontX(i) + ROW_D / 2;
    for (let x = -xMax; x <= xMax + 1e-6; x += seatStep) {
      const jx = x + (rnd() - 0.5) * 0.06;
      if (BACK_AISLES.some((a) => Math.abs(jx - a) < 0.5)) continue;
      list.push(person(jx, zSeat + (rnd() - 0.5) * 0.05, i, false));
    }
    for (const sign of [-1, 1]) {
      const xSeat = sign * (rowFrontX(i) + ROW_D / 2);
      for (let z = rowFrontZ(i) + 0.3; z <= Z_END; z += seatStep) {
        if (SIDE_AISLES.some((a) => Math.abs(z - a) < 0.5)) continue;
        list.push(person(xSeat + (rnd() - 0.5) * 0.05, z + (rnd() - 0.5) * 0.06, i, true));
      }
    }
    rows.push(list);
  }
  return rows;
}

const onScreen = (p: Projected, margin = 12): boolean => p.x > -margin && p.x < W + margin && p.y > -margin * 2 && p.y < 330;

// ---------- the stands layer ----------

function drawRowStructure(g: Ctx, pal: Palette, i: number): void {
  const zf = rowFrontZ(i);
  const xf = rowFrontX(i);
  const h0 = rowH(i - 1);
  const h1 = rowH(i);
  const xo = xf + ROW_D;
  const shade = 1 - i * 0.07;
  const riser = css(mix(pal.dark, pal.concrete, 0.55 * shade));
  const tread = css(mix(pal.dark, pal.seat, 0.75 * shade));
  // Back stands: riser (faces the court) and tread.
  const xr = i === 0 ? SIDE_X : rowFrontX(i - 1) + ROW_D;
  fillPoly(g, [P(-xr, zf, h0), P(xr, zf, h0), P(xr, zf, h1), P(-xr, zf, h1)], riser);
  fillPoly(g, [P(-xo, zf, h1), P(xo, zf, h1), P(xo, zf - ROW_D, h1), P(-xo, zf - ROW_D, h1)], tread);
  // Side stands, both sides.
  for (const sg of [-1, 1]) {
    fillPoly(g, [P(sg * xf, zf, h0), P(sg * xf, Z_END, h0), P(sg * xf, Z_END, h1), P(sg * xf, zf, h1)], riser);
    fillPoly(g, [P(sg * xf, zf, h1), P(sg * xf, Z_END, h1), P(sg * xo, Z_END, h1), P(sg * xo, zf, h1)], tread);
  }
  // Aisle steps: lighter edges on the stairs.
  g.strokeStyle = css(mix(pal.concrete, pal.light, 0.25), 0.55 * shade);
  g.lineWidth = 0.6;
  for (const a of BACK_AISLES) {
    for (const f of [0, 0.5]) line(g, P(a - 0.45, zf - f * ROW_D, h1 - f * ROW_RISE * 0), P(a + 0.45, zf - f * ROW_D, h1));
  }
  for (const a of SIDE_AISLES) {
    for (const sg of [-1, 1]) line(g, P(sg * xf, a - 0.45, h1), P(sg * xf, a + 0.45, h1));
  }
}

function drawPerson(g: Ctx, pal: Palette, m: Person, cheer: boolean): void {
  const base = P(m.x, m.z, m.h);
  if (!onScreen(base)) return;
  const s = base.scale * m.size;
  // Light falls off up the stands and away from the court; up there people also haze into the sky colour.
  const lit = Math.max(0.2, 0.8 - m.row * 0.075);
  const shadeC = (c: RGB): string => css(mix(mix(c, pal.dark, 1 - lit), pal.sky, m.row * 0.035));
  const seatC = shadeC(pal.seat);
  const x = base.x;
  if (m.empty) {
    g.fillStyle = seatC;
    rrect(g, x - 0.21 * s, base.y - 0.86 * s, 0.42 * s, 0.4 * s, 0.06 * s);
    g.fill();
    g.fillStyle = css(mix(mix(pal.seat, pal.light, 0.15), pal.dark, 1 - lit));
    g.fillRect(x - 0.21 * s, base.y - 0.5 * s, 0.42 * s, 0.07 * s);
    return;
  }
  const standing = cheer && m.pose !== 0;
  const lift = standing ? 0.32 : 0;
  const y = (dh: number): number => base.y - (dh + lift) * base.scale;
  if (!standing) {
    g.fillStyle = seatC;
    rrect(g, x - 0.22 * s, y(0.9), 0.44 * s, 0.46 * s, 0.07 * s);
    g.fill();
  }
  const shirt = shadeC(m.shirt);
  const skin = shadeC(m.skin);
  const armW = Math.max(0.6, 0.1 * s);
  g.lineCap = 'round';
  // Arms behind the head first (cheer).
  if (cheer && (m.pose === 1 || m.pose === 3 || m.pose === 4)) {
    g.strokeStyle = shirt;
    g.lineWidth = armW;
    const reach = m.pose === 3 ? 0.18 : 0.28;
    for (const side of m.pose === 4 ? [1] : [-1, 1]) line(g, { x: x + side * 0.17 * s, y: y(0.95) }, { x: x + side * reach * s, y: y(1.62) });
    g.fillStyle = skin;
    for (const side of m.pose === 4 ? [1] : [-1, 1]) ellipse(g, x + side * reach * s, y(1.64), 0.06 * s, 0.06 * s, skin);
    if (m.pose === 3) {
      // A scarf held up over the head, in a team colour.
      g.fillStyle = css(mix(mix(m.flag, pal.dark, 1 - lit), pal.sky, m.row * 0.035));
      g.fillRect(x - reach * s, y(1.7), 2 * reach * s, 0.12 * s);
    }
    if (m.pose === 4) {
      // A small flag on a stick.
      g.strokeStyle = shadeC([200, 200, 200]);
      g.lineWidth = Math.max(0.4, 0.04 * s);
      line(g, { x: x + reach * s, y: y(1.55) }, { x: x + reach * s, y: y(2.3) });
      g.fillStyle = css(mix(mix(m.flag, pal.dark, 1 - lit), pal.sky, m.row * 0.035));
      poly(g, [
        { x: x + reach * s, y: y(2.3) },
        { x: x + (reach + 0.55) * s, y: y(2.22) },
        { x: x + (reach + 0.5) * s, y: y(1.98) },
        { x: x + reach * s, y: y(2.0) },
      ]);
      g.fill();
    }
  }
  // Body: rounded shoulders (the row in front hides the rest), a big round head (the game's comic proportions), hair or a cap.
  g.fillStyle = shirt;
  g.beginPath();
  g.moveTo(x - 0.25 * s, y(0.5));
  g.lineTo(x - 0.25 * s, y(0.86));
  g.quadraticCurveTo(x - 0.25 * s, y(1.04), x - 0.08 * s, y(1.05));
  g.lineTo(x + 0.08 * s, y(1.05));
  g.quadraticCurveTo(x + 0.25 * s, y(1.04), x + 0.25 * s, y(0.86));
  g.lineTo(x + 0.25 * s, y(0.5));
  g.closePath();
  g.fill();
  if (cheer && m.pose === 2) {
    g.strokeStyle = shirt;
    g.lineWidth = armW;
    line(g, { x: x - 0.19 * s, y: y(0.95) }, { x: x - 0.32 * s, y: y(1.62) });
    ellipse(g, x - 0.32 * s, y(1.64), 0.065 * s, 0.065 * s, skin);
  }
  if (!cheer || m.pose === 0) {
    // Hands together in the lap / clapping: a small skin dot on the chest.
    ellipse(g, x, y(0.68), 0.075 * s, 0.055 * s, skin);
  }
  const hr = 0.15 * s;
  const hy = y(1.25);
  ellipse(g, x, hy, hr, hr * 1.04, skin);
  const hairC = shadeC(m.hair);
  if (m.cap) {
    g.fillStyle = shadeC(m.flag);
    g.beginPath();
    g.ellipse(x, hy - hr * 0.2, hr * 1.04, hr * 0.85, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(x - hr * 1.25, hy - hr * 0.26, hr * 2.5, hr * 0.22);
  } else {
    g.fillStyle = hairC;
    g.beginPath();
    g.ellipse(x, hy - hr * 0.12, hr * 1.07, hr * (0.7 + m.hairTop * 0.35), 0, Math.PI, Math.PI * 2);
    g.fill();
    if (m.hairTop > 0.7) {
      // Longer hair down the sides.
      g.fillRect(x - hr * 1.07, hy - hr * 0.15, hr * 0.32, hr * 1.1);
      g.fillRect(x + hr * 0.75, hy - hr * 0.15, hr * 0.32, hr * 1.1);
    }
  }
}

function drawStandsLayer(g: Ctx, pal: Palette, cheerGroup: number | undefined): void {
  const people = crowd(pal, makeRng(20261126));
  for (let i = ROWS - 1; i >= 0; i--) {
    drawRowStructure(g, pal, i);
    // Back row first (it is farthest), then the side rows from the far end to the near end.
    for (const m of people[i]) if (!m.onSide) drawPerson(g, pal, m, m.group === cheerGroup);
    for (const m of people[i].filter((p) => p.onSide).sort((a, b) => a.z - b.z)) drawPerson(g, pal, m, m.group === cheerGroup);
  }
  // Haze: the upper stands fade into the dark sky colour; the lower ones catch some spill light from the court.
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const haze = g.createLinearGradient(0, 0, 0, 120);
  haze.addColorStop(0, css(pal.dark, 0.62));
  haze.addColorStop(0.6, css(pal.dark, 0.3));
  haze.addColorStop(1, css(pal.dark, 0.08));
  g.fillStyle = haze;
  g.fillRect(0, 0, W, 330);
  const spill = g.createRadialGradient(W / 2, 140, 20, W / 2, 140, 260);
  spill.addColorStop(0, css(pal.light, 0.1));
  spill.addColorStop(1, css(pal.light, 0));
  g.fillStyle = spill;
  g.fillRect(0, 0, W, 330);
  g.restore();
}

/**
 * The stands, softened. Drawn at full size on a canvas of their own, then scaled down and back up (a light blur that works the
 * same in every browser), then laid onto the picture.
 */
export function drawStands(g: Ctx, theme: CourtTheme, scale: number, cheerGroup?: number): void {
  const pal = paletteOf(theme);
  const hgt = 330;
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(W * scale);
  layer.height = Math.ceil(hgt * scale);
  const lg = layer.getContext('2d');
  if (!lg) return;
  lg.scale(scale, scale);
  drawStandsLayer(lg, pal, cheerGroup);
  const soft = document.createElement('canvas');
  const k = 0.5;
  soft.width = Math.ceil(layer.width * k);
  soft.height = Math.ceil(layer.height * k);
  const sg = soft.getContext('2d');
  if (!sg) return;
  sg.imageSmoothingEnabled = true;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(layer, 0, 0, soft.width, soft.height);
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(soft, 0, 0, W, hgt);
  g.restore();
}

// ---------- backdrop, floor, barriers ----------

/** The dark hall behind everything, with two soft light shafts from lamps above the picture. */
export function drawBackdrop(g: Ctx, theme: CourtTheme): void {
  const pal = paletteOf(theme);
  const bg = g.createLinearGradient(0, 0, 0, 400);
  bg.addColorStop(0, css(pal.dark));
  bg.addColorStop(1, css(mix(pal.dark, pal.carpet, 0.6)));
  g.fillStyle = bg;
  g.fillRect(0, 0, W, 400);
}

/** The run-off floor around the raised court: dark carpet, lit near the court. */
export function drawRunoff(g: Ctx, theme: CourtTheme, rnd: () => number): void {
  const pal = paletteOf(theme);
  const h = RUNOFF_H;
  const floor = [P(-SIDE_X, BACK_Z, h), P(SIDE_X, BACK_Z, h), P(SIDE_X, Z_END, h), P(-SIDE_X, Z_END, h)];
  fillPoly(g, floor, css(pal.carpet));
  g.save();
  poly(g, floor);
  g.clip();
  const c = P(0, 9, h);
  const pool = g.createRadialGradient(c.x, c.y, 30, c.x, c.y, 260);
  pool.addColorStop(0, css(mix(pal.carpet, pal.light, 0.22)));
  pool.addColorStop(0.55, css(mix(pal.carpet, pal.light, 0.08)));
  pool.addColorStop(1, css(pal.carpet, 0));
  g.fillStyle = pool;
  g.fillRect(0, 0, W, 420);
  // Carpet weave: a faint grain, and seams across the floor.
  for (let i = 0; i < 700; i++) {
    const q = P((rnd() * 2 - 1) * SIDE_X, BACK_Z + rnd() * (Z_END - BACK_Z), h);
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    g.fillRect(q.x, q.y, 0.9, 0.5);
  }
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 0.6;
  for (let z = BACK_Z + 2; z < Z_END; z += 4) line(g, P(-SIDE_X, z, h), P(SIDE_X, z, h));
  // Shadow under the barriers.
  const ao = g.createLinearGradient(0, P(0, BACK_Z, h).y, 0, P(0, BACK_Z + 1.2, h).y);
  ao.addColorStop(0, 'rgba(0,4,16,0.5)');
  ao.addColorStop(1, 'rgba(0,4,16,0)');
  g.fillStyle = ao;
  g.fillRect(0, P(0, BACK_Z, h).y, W, P(0, BACK_Z + 1.2, h).y - P(0, BACK_Z, h).y);
  g.restore();
}

const BOARD_TEXTS = ['POR TRES', 'PADEL CAREER', 'POR TRES', 'WORLD TOUR'];

function boardFace(g: Ctx, pal: Palette, q: Pt[], dim: number): void {
  const top = q[3];
  const bot = q[0];
  const gr = g.createLinearGradient(0, Math.min(top.y, q[2].y), 0, Math.max(bot.y, q[1].y));
  gr.addColorStop(0, css(mix(pal.board[0], pal.dark, dim)));
  gr.addColorStop(0.55, css(mix(pal.board[1], pal.dark, dim)));
  gr.addColorStop(1, css(mix(pal.board[2], pal.dark, dim)));
  fillPoly(g, q, gr);
}

/** Barriers with LED boards in front of the stands: behind the far glass and along both sides. */
export function drawBarriers(g: Ctx, theme: CourtTheme): void {
  const pal = paletteOf(theme);
  const h0 = RUNOFF_H;
  const h1 = RUNOFF_H + BARRIER;
  const text = (i: number, dim: number): string => (i % 2 === 0 ? css(mix([255, 214, 90], pal.dark, dim)) : css(mix([240, 246, 255], pal.dark, dim)));
  // Back barrier, in panels of 3 m.
  for (let x = -SIDE_X, i = 0; x < SIDE_X - 1e-6; x += 2.96, i++) {
    const x1 = Math.min(SIDE_X, x + 2.96);
    const q = [P(x, BACK_Z, h0), P(x1, BACK_Z, h0), P(x1, BACK_Z, h1), P(x, BACK_Z, h1)];
    boardFace(g, pal, q, 0.25);
    const m = 0.12;
    panelText(g, P(x + m, BACK_Z, h1 - 0.2), P(x1 - m, BACK_Z, h1 - 0.2), P(x + m, BACK_Z, h0 + 0.2), BOARD_TEXTS[i % BOARD_TEXTS.length], text(i, 0.3));
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 0.6;
    line(g, P(x1, BACK_Z, h0), P(x1, BACK_Z, h1));
  }
  // Side barriers (they face the court), from the far end towards the camera; panels of 3 m.
  for (const sg of [-1, 1]) {
    for (let z = BACK_Z, i = sg > 0 ? 1 : 0; z < 16; z += 3, i++) {
      const q = [P(sg * SIDE_X, z, h0), P(sg * SIDE_X, z + 3, h0), P(sg * SIDE_X, z + 3, h1), P(sg * SIDE_X, z, h1)];
      if (Math.max(...q.map((p) => (sg < 0 ? p.x : W - p.x))) < -4) continue;
      boardFace(g, pal, q, 0.15);
      const a = sg < 0 ? P(sg * SIDE_X, z + 0.15, h1 - 0.2) : P(sg * SIDE_X, z + 2.85, h1 - 0.2);
      const b = sg < 0 ? P(sg * SIDE_X, z + 2.85, h1 - 0.2) : P(sg * SIDE_X, z + 0.15, h1 - 0.2);
      const c = sg < 0 ? P(sg * SIDE_X, z + 0.15, h0 + 0.2) : P(sg * SIDE_X, z + 2.85, h0 + 0.2);
      // Text reads from the far end to the near end on the left board; mirrored placement on the right keeps it readable.
      if (sg < 0) panelText(g, a, b, c, BOARD_TEXTS[i % BOARD_TEXTS.length], text(i, 0.2));
      else panelText(g, b, a, P(sg * SIDE_X, z + 0.15, h0 + 0.2), BOARD_TEXTS[i % BOARD_TEXTS.length], text(i, 0.2));
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 0.6;
      line(g, P(sg * SIDE_X, z + 3, h0), P(sg * SIDE_X, z + 3, h1));
    }
  }
  // Top caps: a lit edge along every barrier.
  g.strokeStyle = css(mix(pal.board[0], [255, 255, 255], 0.55), 0.8);
  g.lineWidth = 0.9;
  line(g, P(-SIDE_X, BACK_Z, h1), P(SIDE_X, BACK_Z, h1));
  for (const sg of [-1, 1]) line(g, P(sg * SIDE_X, BACK_Z, h1), P(sg * SIDE_X, Z_END, h1));
  // Contact shadow along the foot of the boards.
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 1.2;
  line(g, P(-SIDE_X, BACK_Z, h0), P(SIDE_X, BACK_Z, h0));
  for (const sg of [-1, 1]) line(g, P(sg * SIDE_X, BACK_Z, h0), P(sg * SIDE_X, Z_END, h0));
}

// ---------- people and things beside the court ----------

/** A person drawn from simple shapes, standing (h = feet) or seated; `face` -1/1 turns the side view, 0 is front/back. */
function figure(
  g: Ctx,
  x: number,
  z: number,
  feet: number,
  opts: { shirt: RGB; legs: RGB; skin: RGB; hair: RGB; crouch?: boolean; seatedAt?: number },
): void {
  const base = P(x, z, feet);
  const s = base.scale;
  const y = (dh: number): number => base.y - dh * s;
  const shirt = css(opts.shirt);
  const legs = css(opts.legs);
  g.lineCap = 'round';
  if (opts.seatedAt !== undefined) {
    const hip = opts.seatedAt - feet;
    // Lower legs hanging, thighs forward (towards the court), torso up.
    g.strokeStyle = legs;
    g.lineWidth = 0.15 * s;
    line(g, { x: base.x, y: y(hip) }, { x: base.x, y: y(0.1) });
    g.fillStyle = shirt;
    rrect(g, base.x - 0.2 * s, y(hip + 0.62), 0.4 * s, 0.66 * s, 0.12 * s);
    g.fill();
    ellipse(g, base.x, y(hip + 0.8), 0.12 * s, 0.125 * s, css(opts.skin));
    g.fillStyle = css(opts.hair);
    g.beginPath();
    g.ellipse(base.x, y(hip + 0.84), 0.125 * s, 0.1 * s, 0, Math.PI, Math.PI * 2);
    g.fill();
    return;
  }
  if (opts.crouch) {
    ellipse(g, base.x, base.y, 0.32 * s, 0.07 * s, 'rgba(0,0,0,0.3)');
    g.fillStyle = legs;
    rrect(g, base.x - 0.2 * s, y(0.5), 0.4 * s, 0.5 * s, 0.14 * s);
    g.fill();
    g.fillStyle = shirt;
    rrect(g, base.x - 0.19 * s, y(0.98), 0.38 * s, 0.56 * s, 0.13 * s);
    g.fill();
    ellipse(g, base.x, y(1.12), 0.12 * s, 0.125 * s, css(opts.skin));
    g.fillStyle = css(opts.hair);
    g.beginPath();
    g.ellipse(base.x, y(1.15), 0.125 * s, 0.1 * s, 0, Math.PI, Math.PI * 2);
    g.fill();
    return;
  }
  ellipse(g, base.x, base.y, 0.3 * s, 0.07 * s, 'rgba(0,0,0,0.32)');
  g.strokeStyle = legs;
  g.lineWidth = 0.15 * s;
  line(g, { x: base.x - 0.08 * s, y: y(0.85) }, { x: base.x - 0.09 * s, y: y(0.05) });
  line(g, { x: base.x + 0.08 * s, y: y(0.85) }, { x: base.x + 0.09 * s, y: y(0.05) });
  g.fillStyle = shirt;
  rrect(g, base.x - 0.21 * s, y(1.5), 0.42 * s, 0.7 * s, 0.13 * s);
  g.fill();
  ellipse(g, base.x, y(1.66), 0.12 * s, 0.125 * s, css(opts.skin));
  g.fillStyle = css(opts.hair);
  g.beginPath();
  g.ellipse(base.x, y(1.7), 0.125 * s, 0.1 * s, 0, Math.PI, Math.PI * 2);
  g.fill();
}

function box(g: Ctx, x0: number, x1: number, z0: number, z1: number, h0: number, h1: number, top: string, front: string, side: string): void {
  // Faces the camera can see: top, front (towards the camera, z1) and the side towards the court.
  const inner = Math.abs(x0) < Math.abs(x1) ? x0 : x1;
  fillPoly(g, [P(inner, z0, h0), P(inner, z1, h0), P(inner, z1, h1), P(inner, z0, h1)], side);
  fillPoly(g, [P(x0, z1, h0), P(x1, z1, h0), P(x1, z1, h1), P(x0, z1, h1)], front);
  fillPoly(g, [P(x0, z0, h1), P(x1, z0, h1), P(x1, z1, h1), P(x0, z1, h1)], top);
}

function umpireChair(g: Ctx, pal: Palette, x: number, z: number): void {
  const f = RUNOFF_H;
  const seat = f + 1.45;
  const steel = css(mix([120, 130, 150], pal.dark, 0.35));
  const steelHi = css(mix([200, 210, 230], pal.dark, 0.2));
  ellipse(g, P(x, z, f).x, P(x, z, f).y, 0.55 * P(x, z, f).scale, 0.12 * P(x, z, f).scale, 'rgba(0,0,0,0.35)');
  g.lineCap = 'round';
  // Legs (back pair first), cross bars, a ladder towards the camera.
  g.strokeStyle = steel;
  g.lineWidth = 0.07 * P(x, z, f).scale;
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) line(g, P(x + dx, z + dz, f), P(x + dx * 0.8, z + dz * 0.8, seat));
  g.lineWidth = 0.045 * P(x, z, f).scale;
  for (const hh of [0.5, 1.0]) {
    line(g, P(x - 0.29, z + 0.29, f + hh), P(x + 0.29, z + 0.29, f + hh));
    line(g, P(x + 0.29, z - 0.29, f + hh), P(x + 0.29, z + 0.29, f + hh));
  }
  g.strokeStyle = steelHi;
  g.lineWidth = 0.025 * P(x, z, f).scale;
  for (const [dx, dz] of [[-0.3, 0.3], [0.3, 0.3]]) line(g, P(x + dx - 0.02, z + dz, f), P(x + dx * 0.8 - 0.02, z + dz * 0.8, seat));
  // Seat platform and back rest.
  box(g, x - 0.3, x + 0.3, z - 0.3, z + 0.3, seat - 0.08, seat, css(mix(pal.board[1], pal.dark, 0.2)), css(mix(pal.board[2], pal.dark, 0.3)), css(mix(pal.board[2], pal.dark, 0.1)));
  figure(g, x + 0.02, z, f + 0.75, { shirt: mix([28, 32, 44], pal.dark, 0.1), legs: [30, 34, 46], skin: SKIN[1], hair: HAIR[0], seatedAt: seat });
  // A light collar and a tablet in the lap.
  const nk = P(x + 0.02, z, seat + 0.6);
  g.fillStyle = 'rgba(235,240,250,0.85)';
  g.fillRect(nk.x - 0.1 * nk.scale, nk.y, 0.2 * nk.scale, 0.05 * nk.scale);
  const tb = P(x + 0.12, z + 0.05, seat + 0.25);
  g.fillStyle = css(mix([140, 200, 255], pal.dark, 0.2));
  g.fillRect(tb.x - 0.1 * tb.scale, tb.y - 0.06 * tb.scale, 0.2 * tb.scale, 0.12 * tb.scale);
}

/** A padel racket leaning on something: oval head in a team colour, short handle. */
function racket(g: Ctx, base: Pt, s: number, tilt: number, color: string): void {
  g.save();
  g.translate(base.x, base.y);
  g.rotate(tilt);
  g.fillStyle = 'rgba(25,25,30,1)';
  g.fillRect(-0.03 * s, -0.2 * s, 0.06 * s, 0.2 * s);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, -0.36 * s, 0.13 * s, 0.17 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.ellipse(-0.03 * s, -0.4 * s, 0.05 * s, 0.08 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A team bench beside the court: padded seat with a back rest, a towel over it, bottles, a bag and a racket. */
function bench(g: Ctx, pal: Palette, x: number, z0: number, z1: number, rnd: () => number): void {
  const f = RUNOFF_H;
  const top = f + 0.45;
  const sg = Math.sign(x);
  const xi = x - sg * 0.2;
  const xo = x + sg * 0.2;
  const a = P(x, (z0 + z1) / 2, f);
  ellipse(g, a.x, a.y + 1, 0.5 * a.scale, (z1 - z0) * 0.13 * a.scale, 'rgba(0,0,0,0.35)');
  const padTop = css(mix(pal.board[0], pal.dark, 0.1));
  const padFront = css(mix(pal.board[2], pal.dark, 0.2));
  const padSide = css(mix(pal.board[1], pal.dark, 0.15));
  // Back rest along the outer edge (it faces the court), then legs and the seat.
  box(g, Math.min(xo - sg * 0.07, xo), Math.max(xo - sg * 0.07, xo), z0, z1, top, top + 0.5, padTop, padFront, padSide);
  g.strokeStyle = css(mix([90, 100, 120], pal.dark, 0.3));
  g.lineWidth = 0.05 * a.scale;
  for (const zz of [z0 + 0.1, z1 - 0.1]) line(g, P(xi, zz, f), P(xi, zz, top - 0.1));
  box(g, Math.min(xi, xo), Math.max(xi, xo), z0, z1, top - 0.12, top, padTop, padFront, padSide);
  // A white towel hung over the back rest.
  const tz = z0 + 0.25 + rnd() * 0.3;
  fillPoly(g, [P(xo, tz, top + 0.52), P(xo, tz + 0.4, top + 0.52), P(xo - sg * 0.02, tz + 0.42, top + 0.12), P(xo - sg * 0.02, tz - 0.02, top + 0.1)], 'rgba(238,242,248,0.95)');
  g.strokeStyle = 'rgba(180,190,210,0.9)';
  g.lineWidth = 0.6;
  line(g, P(xo - sg * 0.01, tz, top + 0.3), P(xo - sg * 0.01, tz + 0.4, top + 0.3));
  // Two bottles on the seat.
  for (const [dz, col] of [[0.0, [80, 170, 255]], [0.14, [235, 238, 245]]] as Array<[number, RGB]>) {
    const b = P(x - sg * 0.02, z1 - 0.25 - dz, top);
    g.fillStyle = css(mix(col, pal.dark, 0.1));
    rrect(g, b.x - 0.045 * b.scale, b.y - 0.27 * b.scale, 0.09 * b.scale, 0.27 * b.scale, 0.03 * b.scale);
    g.fill();
    g.fillStyle = 'rgba(20,30,50,0.85)';
    g.fillRect(b.x - 0.03 * b.scale, b.y - 0.32 * b.scale, 0.06 * b.scale, 0.05 * b.scale);
  }
  // A long sports bag on the floor in front of the bench, with a coloured stripe.
  const bz = (z0 + z1) / 2 - 0.4;
  const bx0 = xi - sg * 0.38;
  box(g, Math.min(bx0, bx0 + sg * 0.3), Math.max(bx0, bx0 + sg * 0.3), bz, bz + 0.8, f, f + 0.3, css(mix([62, 64, 74], pal.dark, 0.15)), css(mix([34, 36, 44], pal.dark, 0.15)), css(mix([48, 50, 60], pal.dark, 0.15)));
  const st = [P(bx0 + sg * 0.15, bz, f + 0.305), P(bx0 + sg * 0.15, bz + 0.8, f + 0.305)];
  g.strokeStyle = css(mix(pal.accents[1 % pal.accents.length], pal.dark, 0.1));
  g.lineWidth = 0.05 * st[1].scale;
  line(g, st[0], st[1]);
  // A racket leaning on the seat, towards the camera end.
  const rb = P(xi - sg * 0.12, z1 + 0.05, f);
  racket(g, rb, rb.scale, sg * -0.25, css(mix(pal.accents[0], pal.dark, 0.05)));
}

function tvCamera(g: Ctx, pal: Palette, x: number, z: number): void {
  const f = RUNOFF_H;
  const b = P(x, z, f);
  ellipse(g, b.x, b.y, 0.5 * b.scale, 0.1 * b.scale, 'rgba(0,0,0,0.35)');
  g.strokeStyle = css(mix([70, 76, 90], pal.dark, 0.2));
  g.lineWidth = 0.04 * b.scale;
  for (const [dx, dz] of [[-0.35, 0.25], [0.3, 0.25], [0, -0.35]]) line(g, P(x + dx, z + dz, f), P(x, z, f + 1.25));
  // Camera body pointing at the court (towards the centre).
  const dir = -Math.sign(x);
  box(g, Math.min(x - 0.14, x + 0.14), Math.max(x - 0.14, x + 0.14), z - 0.3, z + 0.25, f + 1.25, f + 1.55, css(mix([60, 64, 74], pal.dark, 0.1)), css(mix([28, 30, 36], pal.dark, 0.1)), css(mix([44, 47, 56], pal.dark, 0.1)));
  const lens = P(x + dir * 0.22, z - 0.1, f + 1.4);
  ellipse(g, lens.x, lens.y, 0.09 * lens.scale, 0.09 * lens.scale, 'rgba(20,22,28,1)');
  ellipse(g, lens.x - dir * 0.02 * lens.scale, lens.y - 0.02 * lens.scale, 0.03 * lens.scale, 0.03 * lens.scale, 'rgba(140,190,255,0.7)');
  // A small red tally light: the camera is live.
  const tally = P(x, z + 0.2, f + 1.6);
  ellipse(g, tally.x, tally.y, 0.03 * tally.scale, 0.03 * tally.scale, 'rgba(255,70,60,0.95)');
  figure(g, x + 0.05, z + 0.55, f, { shirt: [34, 36, 44], legs: [26, 28, 34], skin: SKIN[2], hair: HAIR[1] });
  // Headphones.
  const hp = P(x + 0.05, z + 0.55, f + 1.72);
  g.strokeStyle = 'rgba(20,20,24,1)';
  g.lineWidth = 0.035 * hp.scale;
  g.beginPath();
  g.arc(hp.x, hp.y, 0.13 * hp.scale, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
}

function photographer(g: Ctx, pal: Palette, x: number, z: number): void {
  const f = RUNOFF_H;
  figure(g, x, z, f, { shirt: mix([40, 44, 56], pal.dark, 0.15), legs: [38, 40, 50], skin: SKIN[0], hair: HAIR[2], crouch: true });
  // Camera with a long lens at the eye.
  const c = P(x + 0.12, z + 0.1, f + 1.08);
  g.fillStyle = 'rgba(18,20,26,1)';
  g.fillRect(c.x - 0.1 * c.scale, c.y - 0.07 * c.scale, 0.2 * c.scale, 0.14 * c.scale);
  g.fillStyle = 'rgba(230,232,236,0.95)';
  g.fillRect(c.x + 0.08 * c.scale, c.y - 0.05 * c.scale, 0.32 * c.scale, 0.1 * c.scale);
}

function ballKid(g: Ctx, pal: Palette, x: number, z: number): void {
  figure(g, x, z, RUNOFF_H, { shirt: mix(pal.board[0], [255, 255, 255], 0.25), legs: [30, 34, 46], skin: SKIN[3], hair: HAIR[0], crouch: true });
}

/** Ball basket on a stand (padel balls in a wire basket). */
function ballBasket(g: Ctx, pal: Palette, x: number, z: number): void {
  const f = RUNOFF_H;
  const b = P(x, z, f);
  ellipse(g, b.x, b.y, 0.25 * b.scale, 0.06 * b.scale, 'rgba(0,0,0,0.3)');
  g.strokeStyle = css(mix([150, 158, 175], pal.dark, 0.3));
  g.lineWidth = 0.035 * b.scale;
  line(g, P(x - 0.15, z, f), P(x - 0.12, z, f + 0.7));
  line(g, P(x + 0.15, z, f), P(x + 0.12, z, f + 0.7));
  const t = P(x, z, f + 0.85);
  for (let i = 0; i < 9; i++) {
    const bx = t.x + ((i % 3) - 1) * 0.09 * t.scale;
    const by = t.y + Math.floor(i / 3) * 0.06 * t.scale - 0.04 * t.scale;
    ellipse(g, bx, by, 0.05 * t.scale, 0.05 * t.scale, 'rgba(220,240,90,0.95)');
  }
  g.strokeStyle = css(mix([180, 188, 205], pal.dark, 0.25));
  g.lineWidth = 0.02 * t.scale;
  rrect(g, t.x - 0.16 * t.scale, t.y - 0.12 * t.scale, 0.32 * t.scale, 0.26 * t.scale, 0.04 * t.scale);
  g.stroke();
}

/**
 * Logical screen points of the heads in the stands that are on screen (no jitter: for effects such as camera flashes).
 * Same seats as the drawn crowd.
 */
export function standHeads(): Pt[] {
  const out: Pt[] = [];
  const keep = (p: Projected): void => {
    if (p.x > 2 && p.x < W - 2 && p.y > 2 && p.y < 300) out.push({ x: p.x, y: p.y });
  };
  for (let i = 0; i < ROWS; i++) {
    const hh = rowH(i) + 1.25;
    const zSeat = rowFrontZ(i) - ROW_D / 2;
    const xMax = rowFrontX(i) + ROW_D / 2;
    for (let x = -xMax; x <= xMax + 1e-6; x += 0.56) if (!BACK_AISLES.some((a) => Math.abs(x - a) < 0.5)) keep(P(x, zSeat, hh));
    for (const sign of [-1, 1]) {
      for (let z = rowFrontZ(i) + 0.3; z <= Z_END; z += 0.56) if (!SIDE_AISLES.some((a) => Math.abs(z - a) < 0.5)) keep(P(sign * xMax, z, hh));
    }
  }
  return out;
}

/** People and things beside the court. Left: the umpire's chair at the net; right: the two team benches. */
export function drawCourtside(g: Ctx, theme: CourtTheme): void {
  const pal = paletteOf(theme);
  const rnd = makeRng(7);
  // Far corners first (they are farthest), then towards the camera.
  photographer(g, pal, -4.3, -1.7);
  tvCamera(g, pal, 6.6, -1.9);
  ballKid(g, pal, -6.1, -0.6);
  ballKid(g, pal, 6.0, 1.0);
  ballBasket(g, pal, -6.2, 6.4);
  umpireChair(g, pal, -6.45, 10);
  bench(g, pal, 6.35, 7.3, 8.8, rnd);
  bench(g, pal, 6.35, 11.2, 12.7, rnd);
}
