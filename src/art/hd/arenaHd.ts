import { NET_Z, NET_HEIGHT_M, project, type Projected } from '../camera';
import { BACK_WALL, sideWallSegments } from '../walls';

/**
 * MODERN RETRO look: an 80s arcade/synthwave court (flat colours, neon lines, striped sun, scanlines) as a high-resolution picture (Canvas2D, pure and browser-testable).
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
  // Synthwave sky with a striped sun and a neon city skyline instead of a crowd.
  const sky = g.createLinearGradient(0, 0, 0, 112);
  sky.addColorStop(0, '#12062e');
  sky.addColorStop(0.45, '#5a1a8f');
  sky.addColorStop(0.8, '#e0307a');
  sky.addColorStop(1, '#ffa24a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, 112);
  // Sun
  g.save();
  g.beginPath();
  g.arc(W / 2, 62, 40, 0, Math.PI * 2);
  g.clip();
  const sun = g.createLinearGradient(0, 22, 0, 102);
  sun.addColorStop(0, '#fff07a');
  sun.addColorStop(0.55, '#ff9a3c');
  sun.addColorStop(1, '#ff2f8e');
  g.fillStyle = sun;
  g.fillRect(W / 2 - 41, 21, 82, 82);
  g.fillStyle = '#7a2290';
  for (let i = 0; i < 6; i++) g.fillRect(W / 2 - 41, 58 + i * 7, 82, 1 + i * 0.7);
  g.restore();
  // Skyline: flat silhouettes with lit windows
  let x = -4;
  while (x < W + 4) {
    const bw = 12 + rnd() * 18;
    const bh = 14 + rnd() * 40;
    g.fillStyle = rnd() < 0.5 ? '#1b0b3f' : '#260f52';
    g.fillRect(x, 112 - bh, bw, bh);
    g.fillStyle = rnd() < 0.5 ? '#ff5fd2' : '#4df0ff';
    for (let wy = 112 - bh + 4; wy < 108; wy += 6) {
      for (let wx = x + 2.5; wx < x + bw - 2; wx += 4.5) if (rnd() < 0.35) g.fillRect(wx, wy, 1.6, 2.2);
    }
    x += bw + 1 + rnd() * 3;
  }
  // Neon horizon line
  g.fillStyle = '#4df0ff';
  g.fillRect(0, 111, W, 1.4);
}

function drawFloor(g: Ctx, _rnd: () => number): void {
  const P = project;
  // Dark ground with a neon perspective grid running to the horizon
  const ground = g.createLinearGradient(0, 112, 0, 400);
  ground.addColorStop(0, '#2a0a52');
  ground.addColorStop(1, '#0c0524');
  g.fillStyle = ground;
  g.fillRect(0, 112, W, 288);
  g.strokeStyle = 'rgba(255,95,210,0.45)';
  g.lineWidth = 0.8;
  for (let i = -14; i <= 14; i++) line(g, { x: W / 2 + i * 8, y: 112 }, { x: W / 2 + i * 70, y: 400 });
  for (let k = 1; k < 12; k++) {
    const y = 112 + 288 * Math.pow(k / 12, 2.1);
    line(g, { x: 0, y }, { x: W, y });
  }

  const floor = [P(-5, 0), P(5, 0), P(5, 20), P(-5, 20)];
  const far = floor[0].y;
  const near = floor[3].y;
  g.fillStyle = '#157ac4';
  poly(g, floor);
  g.fill();
  g.save();
  poly(g, floor);
  g.clip();
  // Hard flat stripes
  g.fillStyle = '#1a8cdd';
  for (let z = 0; z < 20; z += 4) {
    poly(g, [P(-5, z), P(5, z), P(5, z + 2), P(-5, z + 2)]);
    g.fill();
  }
  // Net shadow, flat
  g.fillStyle = 'rgba(10,0,50,0.35)';
  poly(g, [P(-5, NET_Z), P(5, NET_Z), P(5, NET_Z - 0.9), P(-5, NET_Z - 0.9)]);
  g.fill();
  // Sunset tint on the far end
  const tint = g.createLinearGradient(0, far, 0, near);
  tint.addColorStop(0, 'rgba(255,90,170,0.22)');
  tint.addColorStop(0.5, 'rgba(255,90,170,0)');
  g.fillStyle = tint;
  g.fillRect(0, far, W, near - far);
  g.restore();

  // Neon court lines
  g.save();
  g.strokeStyle = '#eaffff';
  g.lineWidth = 1.8;
  g.shadowColor = '#4df0ff';
  g.shadowBlur = 5;
  g.lineCap = 'square';
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

function glassBand(g: Ctx, at: At, u0: number, u1: number, h0: number, h1: number, step: number, seed: number): void {
  const q = [at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)];
  const bb = bounds(q);
  g.save();
  poly(g, q);
  g.clip();
  g.fillStyle = 'rgba(90,230,255,0.13)';
  g.fillRect(bb.x, bb.y, bb.w, bb.h);
  // Two hard-edged diagonal highlights, like a 90s vector-art window
  const rnd = makeRng(seed);
  for (let k = 0; k < 2; k++) {
    const x0 = bb.x + (0.12 + 0.4 * k + rnd() * 0.12) * bb.w;
    const wd = bb.w * (0.05 + rnd() * 0.04);
    g.fillStyle = k === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,95,210,0.14)';
    g.beginPath();
    g.moveTo(x0, bb.y);
    g.lineTo(x0 + wd, bb.y);
    g.lineTo(x0 + wd - bb.h * 0.5, bb.y + bb.h);
    g.lineTo(x0 - bb.h * 0.5, bb.y + bb.h);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(255,95,210,0.7)';
  g.lineWidth = 0.9;
  for (let u = u0; u <= u1 + 1e-6; u += step) line(g, at(u, h0), at(u, h1));
  g.save();
  g.shadowColor = '#4df0ff';
  g.shadowBlur = 3;
  g.strokeStyle = '#4df0ff';
  g.lineWidth = 1.8;
  line(g, at(u0, h1), at(u1, h1));
  g.strokeStyle = 'rgba(77,240,255,0.55)';
  line(g, at(u0, h0), at(u1, h0));
  g.restore();
}

function meshBand(g: Ctx, at: At, u0: number, u1: number, h0: number, h1: number): void {
  const q = [at(u0, h0), at(u1, h0), at(u1, h1), at(u0, h1)];
  g.fillStyle = 'rgba(20,4,50,0.5)';
  poly(g, q);
  g.fill();
  g.strokeStyle = 'rgba(255,95,210,0.65)';
  g.lineWidth = 0.6;
  const step = 0.3;
  for (let u = u0; u <= u1 + 1e-6; u += step) line(g, at(u, h0), at(u, h1));
  for (let h = h0; h <= h1 + 1e-6; h += step) line(g, at(u0, h), at(u1, h));
  g.strokeStyle = '#ff5fd2';
  g.lineWidth = 2;
  line(g, at(u0, h1), at(u1, h1));
  line(g, at(u0, h0), at(u1, h0));
}

function post(g: Ctx, at: At, u: number, h1: number): void {
  const a = at(u, 0);
  const b = at(u, h1);
  g.save();
  g.shadowColor = '#ff5fd2';
  g.shadowBlur = 4;
  g.strokeStyle = '#ff8de0';
  g.lineWidth = 2.4;
  line(g, a, b);
  g.restore();
}

function drawAds(g: Ctx): void {
  const P = project;
  const strip = [P(-5, 0, 0), P(5, 0, 0), P(5, 0, 0.55), P(-5, 0, 0.55)];
  g.fillStyle = '#b01868';
  poly(g, strip);
  g.fill();
  g.fillStyle = '#4df0ff';
  g.fillRect(strip[0].x, strip[3].y, strip[1].x - strip[0].x, 1.2);
  const base = P(0, 0, 0.27);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 800 ${Math.round(base.scale * 0.34)}px "Courier New", Consolas, monospace`;
  for (const x of [-3.3, 0, 3.3]) {
    const p = P(x, 0, 0.27);
    g.fillStyle = '#12062e';
    g.fillText('PADEL CHAMP 26', p.x + 0.8, p.y + 0.8);
    g.fillStyle = '#fff07a';
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
  drawNearWall(g);
}

/**
 * The near back wall would hide the court, so it is only marked: a faint glass pane up to 3 m, a faint mesh strip
 * up to 4 m, a dashed gold line where the glass ends and the mesh begins, and two small labels.
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
  g.font = 'bold 8px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'bottom';
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(0,0,10,0.9)';
  const tag = (h: number, text: string, color: string): void => {
    const q = near(5, h);
    g.strokeText(text, q.x - 4, q.y - 1);
    g.fillStyle = color;
    g.fillText(text, q.x - 4, q.y - 1);
  };
  tag(G, 'GLASS to 3 m', '#bfe6ff');
  tag(T, 'MESH to 4 m', '#ffe066');
  g.restore();
}

function drawVignette(g: Ctx): void {
  const v = g.createRadialGradient(W / 2, 250, 140, W / 2, 250, 430);
  v.addColorStop(0, 'rgba(10,0,30,0)');
  v.addColorStop(1, 'rgba(10,0,30,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, 392);
  // CRT scanlines over the picture (not over the menu, so text stays crisp)
  g.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < 392; y += 2) g.fillRect(0, y, W, 0.8);
}

function drawMenuBackdrop(g: Ctx): void {
  g.fillStyle = '#12062b';
  g.fillRect(0, 392, W, H - 392);
  g.fillStyle = '#4df0ff';
  g.fillRect(0, 392, W, 1.6);
  g.fillStyle = '#ff5fd2';
  g.fillRect(0, 394, W, 0.8);
  g.fillStyle = 'rgba(255,95,210,0.06)';
  for (let y = 400; y < H; y += 4) g.fillRect(0, y, W, 1.5);
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
  g.strokeStyle = '#eaffff';
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  line(g, P(-5, NET_Z, NET_HEIGHT_M), P(5, NET_Z, NET_HEIGHT_M));
  g.restore();
  // Steel posts
  for (const x of [-5.05, 5.05]) {
    const a = P(x, NET_Z, 0);
    const b = P(x, NET_Z, NET_HEIGHT_M + 0.06);
    g.strokeStyle = '#ff8de0';
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
