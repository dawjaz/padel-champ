import { NET_Z, NET_HEIGHT_M, project, type Projected } from '../camera';
import { BACK_WALL, sideWallSegments } from '../walls';

/**
 * The broadcast court as a smooth, lit, high-resolution picture (Canvas2D, pure and browser-testable).
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

function drawStands(g: Ctx, rnd: () => number): void {
  const sky = g.createLinearGradient(0, 0, 0, 110);
  sky.addColorStop(0, '#070a1c');
  sky.addColorStop(1, '#16204a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, 112);

  const shirts = ['#3b3f7a', '#7a3b5f', '#2f6f86', '#8a7a3a', '#7d3a3a', '#3a6a4a', '#9a9ab8', '#5a3a8a'];
  const skins = ['#f1c9a5', '#d9a273', '#b9774a', '#8a5530', '#5c3920', '#f4d6bd'];
  const blur = 'filter' in g;
  if (blur) g.filter = 'blur(0.45px)';
  for (let row = 0; row < 6; row++) {
    const y = 26 + row * 12;
    const r = 2 + row * 0.18;
    const dim = 0.55 + row * 0.08;
    for (let x = -4 + (row % 2) * 3; x < W + 4; x += 5.2 + row * 0.2) {
      const jx = x + (rnd() - 0.5) * 1.6;
      g.globalAlpha = dim;
      g.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
      g.beginPath();
      g.ellipse(jx, y + r * 2.1, r * 1.5, r * 1.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = skins[Math.floor(rnd() * skins.length)];
      g.beginPath();
      g.arc(jx, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  if (blur) g.filter = 'none';
  // Tier railings
  g.strokeStyle = 'rgba(160,175,215,0.25)';
  g.lineWidth = 1;
  for (let row = 0; row < 6; row++) line(g, { x: 0, y: 33 + row * 12 }, { x: W, y: 33 + row * 12 });
  // Push the crowd back into the dark
  const shade = g.createLinearGradient(0, 14, 0, 112);
  shade.addColorStop(0, 'rgba(4,6,20,0.62)');
  shade.addColorStop(1, 'rgba(4,6,20,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 14, W, 98);
  // Stadium lights
  for (const x of [28, W - 28]) {
    const glow = g.createRadialGradient(x, 0, 2, x, 0, 190);
    glow.addColorStop(0, 'rgba(255,246,220,0.55)');
    glow.addColorStop(0.25, 'rgba(255,240,200,0.18)');
    glow.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, 200);
  }
}

function drawFloor(g: Ctx, rnd: () => number): void {
  const P = project;
  // The area around the court
  const ground = g.createLinearGradient(0, 96, 0, 400);
  ground.addColorStop(0, '#16303a');
  ground.addColorStop(1, '#0c1a26');
  g.fillStyle = ground;
  g.fillRect(0, 96, W, 304);

  const floor = [P(-5, 0), P(5, 0), P(5, 20), P(-5, 20)];
  const far = floor[0].y;
  const near = floor[3].y;
  const body = g.createLinearGradient(0, far, 0, near);
  body.addColorStop(0, '#4585ea');
  body.addColorStop(1, '#2457b4');
  g.fillStyle = body;
  poly(g, floor);
  g.fill();

  g.save();
  poly(g, floor);
  g.clip();
  // Cut-turf stripes
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let z = 0; z < 20; z += 4) {
    poly(g, [P(-5, z), P(5, z), P(5, z + 2), P(-5, z + 2)]);
    g.fill();
  }
  // Turf grain
  for (let i = 0; i < 2600; i++) {
    const p = P(rnd() * 10 - 5, rnd() * 20);
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,10,40,0.09)' : 'rgba(255,255,255,0.06)';
    g.fillRect(p.x, p.y, 0.9, 0.6);
  }
  // Light pool under the stadium lights
  const c = P(0, 10);
  const pool = g.createRadialGradient(c.x, c.y, 8, c.x, c.y + 20, 230);
  pool.addColorStop(0, 'rgba(255,255,255,0.20)');
  pool.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = pool;
  g.fillRect(0, far, W, near - far);
  // Net shadow
  g.fillStyle = 'rgba(0,10,40,0.28)';
  poly(g, [P(-5, NET_Z), P(5, NET_Z), P(5, NET_Z - 0.9), P(-5, NET_Z - 0.9)]);
  g.fill();
  g.restore();

  // Court lines with a soft glow
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.96)';
  g.lineWidth = 1.7;
  g.shadowColor = 'rgba(255,255,255,0.7)';
  g.shadowBlur = 3;
  g.lineCap = 'round';
  line(g, P(-5, 0), P(5, 0));
  line(g, P(-5, 20), P(5, 20));
  line(g, P(-5, 0), P(-5, 20));
  line(g, P(5, 0), P(5, 20));
  line(g, P(-5, 3.05), P(5, 3.05));
  line(g, P(-5, 16.95), P(5, 16.95));
  line(g, P(0, 3.05), P(0, 16.95));
  g.restore();
}

function bounds(pts: Array<{ x: number; y: number }>): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A pane of glass: tinted, with reflections, panel joints and steel rails. */
function glassBand(g: Ctx, at: At, u0: number, u1: number, h0: number, h1: number, step: number, seed: number): void {
  const q = [at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)];
  const bb = bounds(q);
  g.save();
  poly(g, q);
  g.clip();
  const tint = g.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
  tint.addColorStop(0, 'rgba(200,236,255,0.20)');
  tint.addColorStop(1, 'rgba(110,175,240,0.08)');
  g.fillStyle = tint;
  g.fillRect(bb.x, bb.y, bb.w, bb.h);
  // Diagonal reflections
  const rnd = makeRng(seed);
  for (let k = 0; k < 3; k++) {
    const x0 = bb.x + (0.1 + 0.3 * k + rnd() * 0.15) * bb.w;
    const wd = bb.w * (0.04 + rnd() * 0.05);
    g.fillStyle = `rgba(255,255,255,${0.07 + rnd() * 0.06})`;
    g.beginPath();
    g.moveTo(x0, bb.y);
    g.lineTo(x0 + wd, bb.y);
    g.lineTo(x0 + wd - bb.h * 0.5, bb.y + bb.h);
    g.lineTo(x0 - bb.h * 0.5, bb.y + bb.h);
    g.closePath();
    g.fill();
  }
  g.restore();
  // Panel joints
  for (let u = u0; u <= u1 + 1e-6; u += step) {
    g.strokeStyle = 'rgba(15,35,80,0.6)';
    g.lineWidth = 1.5;
    line(g, at(u, h0), at(u, h1));
    g.strokeStyle = 'rgba(235,248,255,0.5)';
    g.lineWidth = 0.7;
    const a = at(u, h0);
    const b = at(u, h1);
    line(g, { x: a.x + 0.9, y: a.y }, { x: b.x + 0.9, y: b.y });
  }
  // Steel rails top and bottom
  g.strokeStyle = '#aab6cc';
  g.lineWidth = 1.8;
  line(g, at(u0, h1), at(u1, h1));
  g.strokeStyle = 'rgba(20,30,60,0.7)';
  line(g, at(u0, h0), at(u1, h0));
}

/** Wire mesh: a dark backing, a fine bright grid and a top rail. */
function meshBand(g: Ctx, at: At, u0: number, u1: number, h0: number, h1: number): void {
  const q = [at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)];
  g.fillStyle = 'rgba(6,10,28,0.38)';
  poly(g, q);
  g.fill();
  g.strokeStyle = 'rgba(205,216,238,0.55)';
  g.lineWidth = 0.55;
  const step = 0.25;
  for (let u = u0; u <= u1 + 1e-6; u += step) line(g, at(u, h0), at(u, h1));
  for (let h = h0; h <= h1 + 1e-6; h += step) line(g, at(u0, h), at(u1, h));
  g.strokeStyle = '#8f9ab2';
  g.lineWidth = 2.2;
  line(g, at(u0, h1), at(u1, h1));
  line(g, at(u0, h0), at(u1, h0));
}

function post(g: Ctx, at: At, u: number, h1: number): void {
  const a = at(u, 0);
  const b = at(u, h1);
  g.strokeStyle = '#6f7a94';
  g.lineWidth = 2.6;
  line(g, a, b);
  g.strokeStyle = 'rgba(225,232,248,0.75)';
  g.lineWidth = 0.9;
  line(g, { x: a.x - 0.6, y: a.y }, { x: b.x - 0.6, y: b.y });
}

function drawAds(g: Ctx): void {
  const P = project;
  const strip = [P(-5, 0, 0), P(5, 0, 0), P(5, 0, 0.55), P(-5, 0, 0.55)];
  const grad = g.createLinearGradient(0, strip[3].y, 0, strip[0].y);
  grad.addColorStop(0, '#173a8f');
  grad.addColorStop(1, '#0c2258');
  g.fillStyle = grad;
  poly(g, strip);
  g.fill();
  const base = P(0, 0, 0.27);
  g.fillStyle = '#ffe066';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 800 ${Math.round(base.scale * 0.34)}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
  for (const x of [-3.3, 0, 3.3]) {
    const p = P(x, 0, 0.27);
    g.fillText('PADEL CHAMP 26', p.x, p.y);
  }
}

function drawWalls(g: Ctx): void {
  const P = project;
  const back: At = (x, h) => P(x, 0, h);
  const BW = BACK_WALL;
  drawAds(g);
  glassBand(g, back, -5, 5, 0, BW.glass, 2, 11);
  meshBand(g, back, -5, 5, BW.glass, BW.glass + BW.mesh);
  for (let x = -5; x <= 5; x += 2.5) post(g, back, x, BW.glass + BW.mesh);

  // Side walls: far end first, so that nearer panels overlap them correctly.
  const segs = sideWallSegments();
  for (const sign of [-1, 1]) {
    const at: At = (z, h) => P(sign * 5, z, h);
    segs.forEach((seg, i) => {
      if (seg.glass > 0) glassBand(g, at, seg.z0, seg.z1, 0, seg.glass, 2, 31 + i * 7 + (sign > 0 ? 3 : 0));
      if (seg.mesh > 0) meshBand(g, at, seg.z0, seg.z1, seg.glass, seg.glass + seg.mesh);
    });
    for (const z of [0, 2, 4, 6.5, 10, 13.5, 16, 18, 20]) post(g, at, z, z <= 2 || z >= 18 ? 4 : z <= 4 || z >= 16 ? 3 : 3);
  }
}

function drawVignette(g: Ctx): void {
  const v = g.createRadialGradient(W / 2, 250, 120, W / 2, 250, 420);
  v.addColorStop(0, 'rgba(0,0,10,0)');
  v.addColorStop(1, 'rgba(0,0,10,0.5)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, 400);
}

function drawMenuBackdrop(g: Ctx): void {
  const m = g.createLinearGradient(0, 392, 0, H);
  m.addColorStop(0, '#15163a');
  m.addColorStop(1, '#090a1a');
  g.fillStyle = m;
  g.fillRect(0, 392, W, H - 392);
  g.fillStyle = 'rgba(120,150,255,0.35)';
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

export function renderArena(scale = 2): HdArena {
  const { c: back, g } = canvasOf(W * scale, H * scale);
  g.scale(scale, scale);
  const rnd = makeRng(20261119);
  drawStands(g, rnd);
  drawFloor(g, rnd);
  drawWalls(g);
  drawVignette(g);
  drawMenuBackdrop(g);
  const net = drawNet(scale);
  return { back, net: net.c, netY: net.y, scale };
}
