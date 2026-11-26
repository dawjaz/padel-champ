import { NET_Z, NET_HEIGHT_M, project, type Projected } from '../camera';
import { BACK_WALL, OPENING_HEIGHT, openingsIn, sideWallSegments } from '../walls';
import { COURT_THEMES, DEFAULT_THEME_ID, type CourtTheme } from './courtThemes';
import { drawBackdrop, drawBarriers, drawCourtside, drawRunoff, drawStands } from './venueHd';

/**
 * STYLIZED 2D/3D look: a faux-3D court (raised slab with visible thickness, ambient occlusion, cast shadows, specular sheen, thick glass, cylindrical posts) drawn as a high-resolution picture (Canvas2D, pure and browser-testable).
 * `back` is everything behind the players (stands, floor, glass and mesh walls); `net` is a separate
 * strip that the scene draws between the far and the near players. Coordinates are the 360x640 logical
 * screen of art/camera.ts, multiplied by `scale` (2 = 720x1280 pixels).
 */
export interface HdArena {
  back: HTMLCanvasElement;
  net: HTMLCanvasElement;
  /** Logical y of the top of the net strip. */
  netY: number;
  scale: number;
}

const W = 360;
const H = 640;
type Ctx = CanvasRenderingContext2D;
type At = (u: number, h: number) => Projected;

function canvasOf(w: number, h: number): { c: HTMLCanvasElement; g: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  return { c, g };
}

function poly(g: Ctx, pts: Array<{ x: number; y: number }>): void {
  g.beginPath();
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  g.closePath();
}

function line(g: Ctx, a: { x: number; y: number }, b: { x: number; y: number }): void {
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.stroke();
}

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Soft light from the lamps above the picture: two wide, faint cones over the stands. */
function drawLightShafts(g: Ctx, theme: CourtTheme): void {
  for (const x of [40, W - 40]) {
    const cone = g.createRadialGradient(x, -10, 2, x, -10, 200);
    cone.addColorStop(0, `rgba(${theme.spot},0.2)`);
    cone.addColorStop(0.35, `rgba(${theme.spot},0.06)`);
    cone.addColorStop(1, `rgba(${theme.spot},0)`);
    g.fillStyle = cone;
    g.fillRect(0, 0, W, 210);
  }
}

function drawFloor(g: Ctx, rnd: () => number, theme: CourtTheme): void {
  const P = project;
  // Slab: the court is a raised block. Front and side faces first.
  const T = -0.45;
  const slabFront = [P(-5, 20, 0), P(5, 20, 0), P(5, 20, T), P(-5, 20, T)];
  const front = g.createLinearGradient(0, slabFront[0].y, 0, slabFront[3].y);
  front.addColorStop(0, theme.slabTop);
  front.addColorStop(1, theme.slabBottom);
  g.fillStyle = front;
  poly(g, slabFront);
  g.fill();
  for (const sg of [-1, 1]) {
    g.fillStyle = sg < 0 ? theme.slabLeft : theme.slabRight;
    poly(g, [P(sg * 5, 0, 0), P(sg * 5, 20, 0), P(sg * 5, 20, T), P(sg * 5, 0, T)]);
    g.fill();
  }
  // Contact shadow under the slab
  const sh = P(0, 20, T);
  const under = g.createRadialGradient(sh.x, sh.y + 3, 10, sh.x, sh.y + 3, 230);
  under.addColorStop(0, 'rgba(11,31,58,0.35)');
  under.addColorStop(1, 'rgba(11,31,58,0)');
  g.fillStyle = under;
  g.fillRect(0, sh.y - 6, W, 60);

  const floor = [P(-5, 0), P(5, 0), P(5, 20), P(-5, 20)];
  const far = floor[0].y;
  const near = floor[3].y;
  const body = g.createLinearGradient(0, far, 0, near);
  body.addColorStop(0, theme.top);
  body.addColorStop(1, theme.bottom);
  g.fillStyle = body;
  poly(g, floor);
  g.fill();

  g.save();
  poly(g, floor);
  g.clip();
  // Soft stripes (mowing pattern)
  g.fillStyle = 'rgba(255,255,255,0.045)';
  for (let z = 0; z < 20; z += 4) {
    poly(g, [P(-5, z), P(5, z), P(5, z + 2), P(-5, z + 2)]);
    g.fill();
  }
  // Ambient occlusion: the floor darkens where it meets the walls
  const ao = (a: Projected, b: Projected, dx: number, dy: number): void => {
    const gr = g.createLinearGradient(a.x, a.y, a.x + dx, a.y + dy);
    gr.addColorStop(0, 'rgba(0,8,40,0.38)');
    gr.addColorStop(1, 'rgba(0,8,40,0)');
    g.fillStyle = gr;
    g.fillRect(Math.min(a.x, b.x) - 40, far - 4, Math.abs(b.x - a.x) + 80, near - far + 8);
  };
  ao(P(-5, 10), P(-5, 10), 34, 0);
  ao(P(5, 10), P(5, 10), -34, 0);
  const aoBack = g.createLinearGradient(0, far, 0, far + 26);
  aoBack.addColorStop(0, 'rgba(0,8,40,0.4)');
  aoBack.addColorStop(1, 'rgba(0,8,40,0)');
  g.fillStyle = aoBack;
  g.fillRect(0, far, W, 30);
  // Cast shadows of the side glass panels (long soft parallelograms)
  g.fillStyle = 'rgba(0,10,50,0.14)';
  for (const sg of [-1, 1]) {
    poly(g, [P(sg * 5, 0), P(sg * 5, 20), P(sg * 4.1, 20), P(sg * 4.1, 0)]);
    g.fill();
  }
  // Specular sheen: a broad diagonal highlight on the glossy surface
  const sheen = g.createLinearGradient(40, far, W - 40, near);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.13)');
  sheen.addColorStop(0.58, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, far, W, near - far);
  // Light pool
  const c = P(0, 10);
  const pool = g.createRadialGradient(c.x, c.y, 8, c.x, c.y + 20, 230);
  pool.addColorStop(0, 'rgba(255,245,225,0.24)');
  pool.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = pool;
  g.fillRect(0, far, W, near - far);
  // Net shadow, soft
  const ns = P(0, NET_Z - 0.4);
  const nsg = g.createLinearGradient(0, ns.y - 7, 0, ns.y + 7);
  nsg.addColorStop(0, 'rgba(0,10,50,0)');
  nsg.addColorStop(0.5, 'rgba(0,10,50,0.34)');
  nsg.addColorStop(1, 'rgba(0,10,50,0)');
  g.fillStyle = nsg;
  g.fillRect(0, ns.y - 7, W, 14);
  for (let i = 0; i < 900; i++) {
    const q = P(rnd() * 10 - 5, rnd() * 20);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(q.x, q.y, 0.8, 0.5);
  }
  g.restore();

  // Court lines: painted on, slightly raised (soft shadow below, highlight above)
  g.save();
  g.lineCap = 'round';
  const lines: Array<[Projected, Projected]> = [
    [P(-5, 0), P(5, 0)],
    [P(-5, 20), P(5, 20)],
    [P(-5, 0), P(-5, 20)],
    [P(5, 0), P(5, 20)],
    [P(-5, 3.05), P(5, 3.05)],
    [P(-5, 16.95), P(5, 16.95)],
    [P(0, 3.05), P(0, 16.95)],
  ];
  g.strokeStyle = 'rgba(0,12,50,0.35)';
  g.lineWidth = 2.4;
  for (const [a, b] of lines) line(g, { x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 });
  g.strokeStyle = '#fbfdff';
  g.lineWidth = 1.7;
  for (const [a, b] of lines) line(g, a, b);
  g.restore();
}

function bounds(pts: Array<{ x: number; y: number }>): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function glassBand(g: Ctx, at: At, u0: number, u1: number, h0: number, h1: number, step: number, seed: number): void {
  const q = [at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)];
  const bb = bounds(q);
  g.save();
  poly(g, q);
  g.clip();
  const tint = g.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
  tint.addColorStop(0, 'rgba(190,235,255,0.30)');
  tint.addColorStop(0.7, 'rgba(120,190,255,0.12)');
  tint.addColorStop(1, 'rgba(60,130,230,0.2)');
  g.fillStyle = tint;
  g.fillRect(bb.x, bb.y, bb.w, bb.h);
  // Strong specular streaks
  const rnd = makeRng(seed);
  for (let k = 0; k < 3; k++) {
    const x0 = bb.x + (0.08 + 0.32 * k + rnd() * 0.12) * bb.w;
    const wd = bb.w * (0.05 + rnd() * 0.07);
    const sg = g.createLinearGradient(x0, bb.y, x0 + wd, bb.y);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, `rgba(255,255,255,${0.22 + rnd() * 0.12})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(x0, bb.y);
    g.lineTo(x0 + wd, bb.y);
    g.lineTo(x0 + wd - bb.h * 0.55, bb.y + bb.h);
    g.lineTo(x0 - bb.h * 0.55, bb.y + bb.h);
    g.closePath();
    g.fill();
  }
  // Bottom glow where the glass meets the lit floor
  const low = g.createLinearGradient(0, bb.y + bb.h * 0.75, 0, bb.y + bb.h);
  low.addColorStop(0, 'rgba(120,200,255,0)');
  low.addColorStop(1, 'rgba(120,200,255,0.22)');
  g.fillStyle = low;
  g.fillRect(bb.x, bb.y + bb.h * 0.75, bb.w, bb.h * 0.25);
  g.restore();
  // Panel edges with thickness: dark inner line, bright edge highlight
  for (let u = u0; u <= u1 + 1e-6; u += step) {
    const a = at(u, h0);
    const b = at(u, h1);
    g.strokeStyle = 'rgba(10,30,80,0.55)';
    g.lineWidth = 2;
    line(g, a, b);
    g.strokeStyle = 'rgba(240,250,255,0.85)';
    g.lineWidth = 0.9;
    line(g, { x: a.x + 1.1, y: a.y }, { x: b.x + 1.1, y: b.y });
  }
  // Metal frame (top rail with a lit upper edge)
  g.strokeStyle = '#7e8aa6';
  g.lineWidth = 3;
  line(g, at(u0, h1), at(u1, h1));
  g.strokeStyle = 'rgba(245,250,255,0.9)';
  g.lineWidth = 1;
  const t0 = at(u0, h1);
  const t1 = at(u1, h1);
  line(g, { x: t0.x, y: t0.y - 1 }, { x: t1.x, y: t1.y - 1 });
  g.strokeStyle = 'rgba(15,25,60,0.8)';
  g.lineWidth = 1.8;
  line(g, at(u0, h0), at(u1, h0));
}

function meshBand(g: Ctx, at: At, u0: number, u1: number, h0: number, h1: number): void {
  const q = [at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)];
  g.fillStyle = 'rgba(8,14,40,0.3)';
  poly(g, q);
  g.fill();
  g.strokeStyle = 'rgba(215,226,246,0.5)';
  g.lineWidth = 0.5;
  const step = 0.22;
  for (let u = u0; u <= u1 + 1e-6; u += step) line(g, at(u, h0), at(u, h1));
  for (let h = h0; h <= h1 + 1e-6; h += step) line(g, at(u0, h), at(u1, h));
  g.strokeStyle = '#7e8aa6';
  g.lineWidth = 2.6;
  line(g, at(u0, h1), at(u1, h1));
  line(g, at(u0, h0), at(u1, h0));
  g.strokeStyle = 'rgba(245,250,255,0.8)';
  g.lineWidth = 0.8;
  const a = at(u0, h1);
  const b = at(u1, h1);
  line(g, { x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 });
}

function post(g: Ctx, at: At, u: number, h1: number): void {
  const a = at(u, 0);
  const b = at(u, h1);
  // A steel cylinder: dark edge, mid body, light stripe, shadow on the floor
  g.strokeStyle = 'rgba(0,10,40,0.3)';
  g.lineWidth = 4;
  line(g, { x: a.x + 1.2, y: a.y + 0.6 }, { x: a.x + 5, y: a.y + 1.4 });
  g.lineCap = 'round';
  g.strokeStyle = '#4b546e';
  g.lineWidth = 3.4;
  line(g, a, b);
  g.strokeStyle = '#9aa6c0';
  g.lineWidth = 2;
  line(g, { x: a.x - 0.3, y: a.y }, { x: b.x - 0.3, y: b.y });
  g.strokeStyle = '#f2f6ff';
  g.lineWidth = 0.8;
  line(g, { x: a.x - 0.8, y: a.y }, { x: b.x - 0.8, y: b.y });
  g.lineCap = 'butt';
}

/** The opening in the mesh fence: open space, a beam on the floor, padded posts at its sides (the mesh goes on above it). */
function opening(g: Ctx, at: At, z0: number, z1: number): void {
  // A shadow on the court where the light comes through, then the floor beam.
  const beam = [at(z0, 0), at(z1, 0), at(z1, 0.1), at(z0, 0.1)];
  g.fillStyle = '#6a7690';
  poly(g, beam);
  g.fill();
  g.strokeStyle = 'rgba(235,242,255,0.85)';
  g.lineWidth = 1;
  line(g, at(z0, 0.1), at(z1, 0.1));
  g.strokeStyle = 'rgba(8,18,50,0.7)';
  g.lineWidth = 1.2;
  poly(g, beam);
  g.stroke();
  // Padded door posts (foam sleeves, dark blue) up to the top of the opening.
  for (const u of [z0, z1]) padPost(g, at, u, OPENING_HEIGHT);
  // The lintel: the frame bar over the opening.
  g.strokeStyle = '#7e8aa6';
  g.lineWidth = 3;
  line(g, at(z0, OPENING_HEIGHT), at(z1, OPENING_HEIGHT));
}

/** A steel post with a padded foam sleeve. */
function padPost(g: Ctx, at: At, u: number, h1: number): void {
  const a = at(u, 0);
  const b = at(u, h1);
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,10,40,0.85)';
  g.lineWidth = 6;
  line(g, a, b);
  g.strokeStyle = '#27407a';
  g.lineWidth = 4.2;
  line(g, a, b);
  g.strokeStyle = '#6f8fd6';
  g.lineWidth = 1.2;
  line(g, { x: a.x - 0.9, y: a.y }, { x: b.x - 0.9, y: b.y });
  g.lineCap = 'butt';
}

function drawWalls(g: Ctx): void {
  const P = project;
  const back: At = (x, h) => P(x, 0, h);
  const BW = BACK_WALL;
  glassBand(g, back, -5, 5, 0, BW.glass, 2, 11);
  meshBand(g, back, -5, 5, BW.glass, BW.glass + BW.mesh);
  for (let x = -5; x <= 5; x += 2.5) post(g, back, x, BW.glass + BW.mesh);

  // Side walls: far end first, so that nearer panels overlap them correctly.
  const segs = sideWallSegments();
  for (const sign of [-1, 1]) {
    const at: At = (z, h) => P(sign * 5, z, h);
    segs.forEach((seg, i) => {
      if (seg.glass > 0) glassBand(g, at, seg.z0, seg.z1, 0, seg.glass, 2, 31 + i * 7 + (sign > 0 ? 3 : 0));
      if (seg.mesh > 0) {
        // The mesh goes on in front of and between the openings, and over them; the openings themselves are open space.
        const holes = seg.glass === 0 ? openingsIn(seg.z0, seg.z1) : [];
        let from = seg.z0;
        for (const o of holes) {
          if (o.z0 > from) meshBand(g, at, from, o.z0, seg.glass, seg.glass + seg.mesh);
          meshBand(g, at, o.z0, o.z1, OPENING_HEIGHT, seg.glass + seg.mesh);
          from = o.z1;
        }
        if (seg.z1 > from) meshBand(g, at, from, seg.z1, seg.glass, seg.glass + seg.mesh);
        for (const o of holes) opening(g, at, o.z0, o.z1);
      }
    });
    for (const z of [0, 2, 4, 6.5, 10, 13.5, 16, 18, 20]) post(g, at, z, z <= 2 || z >= 18 ? 4 : z <= 4 || z >= 16 ? 3 : 3);
  }
  drawNearWall(g);
}

/**
 * The near back wall would hide the court, so it is only marked: a faint glass pane up to 3 m, a faint mesh strip
 * up to 4 m, and a dashed gold line where the glass ends and the mesh begins.
 */
function drawNearWall(g: Ctx): void {
  const near: At = (x, h) => project(x, 20, h);
  const G = BACK_WALL.glass;
  const T = BACK_WALL.glass + BACK_WALL.mesh;
  g.save();
  const pane = (h0: number, h1: number): Array<{ x: number; y: number }> => [near(-5, h0), near(5, h0), near(5, h1), near(-5, h1)];
  g.fillStyle = 'rgba(159,216,255,0.07)';
  poly(g, pane(0, G));
  g.fill();
  g.fillStyle = 'rgba(8,10,28,0.14)';
  poly(g, pane(G, T));
  g.fill();
  g.strokeStyle = 'rgba(201,211,230,0.22)';
  g.lineWidth = 0.6;
  for (let x = -5; x <= 5.001; x += 0.5) line(g, near(x, G), near(x, T));
  for (let h = G; h <= T + 1e-6; h += 0.5) line(g, near(-5, h), near(5, h));
  g.strokeStyle = 'rgba(223,243,255,0.5)';
  g.lineWidth = 1.2;
  line(g, near(-5, 0), near(5, 0));
  line(g, near(-5, T), near(5, T));
  g.strokeStyle = 'rgba(255,224,102,0.9)';
  g.lineWidth = 1.6;
  g.setLineDash([5, 4]);
  line(g, near(-5, G), near(5, G));
  g.setLineDash([]);
  g.restore();
}

function drawVignette(g: Ctx): void {
  const v = g.createRadialGradient(W / 2, 250, 130, W / 2, 250, 430);
  v.addColorStop(0, 'rgba(0,0,10,0)');
  v.addColorStop(1, 'rgba(5,14,36,0.4)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, 400);
}

function drawMenuBackdrop(g: Ctx): void {
  const m = g.createLinearGradient(0, 392, 0, H);
  m.addColorStop(0, '#0b2a5b');
  m.addColorStop(1, '#0b2a5b');
  g.fillStyle = m;
  g.fillRect(0, 392, W, H - 392);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(0, 392, W, 1.5);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 400; y < H; y += 6) g.fillRect(0, y, W, 1);
}

function drawNet(scale: number): { c: HTMLCanvasElement; y: number } {
  const P = project;
  const left = P(-5, NET_Z, NET_HEIGHT_M);
  const base = P(-5, NET_Z, 0);
  const y0 = Math.floor(left.y - 8);
  const y1 = Math.ceil(base.y + 6);
  const { c, g } = canvasOf(W * scale, (y1 - y0) * scale);
  g.scale(scale, scale);
  g.translate(0, -y0);

  const q = [P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, 0), P(-5, NET_Z, 0)];
  const body = g.createLinearGradient(0, q[0].y, 0, q[3].y);
  body.addColorStop(0, 'rgba(10,14,34,0.55)');
  body.addColorStop(1, 'rgba(10,14,34,0.28)');
  g.fillStyle = body;
  poly(g, q);
  g.fill();
  g.strokeStyle = 'rgba(225,232,246,0.5)';
  g.lineWidth = 0.5;
  for (let x = -5; x <= 5.001; x += 0.25) line(g, P(x, NET_Z, 0), P(x, NET_Z, NET_HEIGHT_M));
  for (let h = 0; h <= NET_HEIGHT_M + 1e-6; h += 0.12) line(g, P(-5, NET_Z, h), P(5, NET_Z, h));
  // Centre strap
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.4;
  line(g, P(0, NET_Z, 0), P(0, NET_Z, NET_HEIGHT_M));
  // White tape on top, with a soft shadow
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 3;
  g.shadowOffsetY = 1.5;
  g.strokeStyle = '#fbfbff';
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  line(g, P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M));
  g.restore();
  // Steel posts
  for (const x of [-5.05, 5.05]) {
    const a = P(x, NET_Z, 0);
    const b = P(x, NET_Z, NET_HEIGHT_M + 0.06);
    g.strokeStyle = '#6f7a94';
    g.lineWidth = 3;
    line(g, a, b);
    g.strokeStyle = 'rgba(230,236,250,0.8)';
    g.lineWidth = 1;
    line(g, { x: a.x - 0.7, y: a.y }, { x: b.x - 0.7, y: b.y });
  }
  return { c, y: y0 };
}

export function renderArena(scale = 2, theme: CourtTheme = COURT_THEMES[DEFAULT_THEME_ID], opts: { cheerGroup?: number } = {}): HdArena {
  const { c: back, g } = canvasOf(W * scale, H * scale);
  g.scale(scale, scale);
  const rnd = makeRng(20261119);
  drawBackdrop(g, theme);
  drawRunoff(g, theme, rnd);
  drawStands(g, theme, scale, opts.cheerGroup);
  drawLightShafts(g, theme);
  drawBarriers(g, theme);
  drawFloor(g, rnd, theme);
  drawCourtside(g, theme);
  drawWalls(g);
  drawVignette(g);
  drawMenuBackdrop(g);
  const net = drawNet(scale);
  return { back, net: net.c, netY: net.y, scale };
}
