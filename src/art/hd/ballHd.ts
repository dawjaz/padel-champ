import { DOT_HI, DOT_LO, IDENTITY, surfacePoint, visibleRings, type Mat3 } from '../spin';

/** Smooth padel ball and its soft glow as canvases (pure Canvas2D). */
function canvasOf(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  return { c, g };
}

/**
 * Draws the ball for an orientation: the yellow sphere with a dark band, a white seam and two dots printed on it, so that
 * the way it turns (topspin, backspin, side spin) can be seen. Lighting stays fixed, as the light does.
 */
export function drawBall(g: CanvasRenderingContext2D, size: number, m: Mat3): void {
  g.clearRect(0, 0, size, size);
  const r = size / 2 - 3;
  const c = size / 2;
  const body = g.createRadialGradient(c - r * 0.4, c - r * 0.45, r * 0.05, c + r * 0.1, c + r * 0.1, r * 1.2);
  body.addColorStop(0, '#ffffd0');
  body.addColorStop(0.35, '#eee03a');
  body.addColorStop(0.8, '#a79a0c');
  body.addColorStop(1, '#5e5604');
  g.fillStyle = body;
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.clip();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const ring of visibleRings(m)) {
    for (const run of ring.runs) {
      if (run.length < 2) continue;
      g.strokeStyle = ring.kind === 'band' ? 'rgba(70,40,0,0.85)' : 'rgba(255,255,255,0.95)';
      g.lineWidth = size * (ring.kind === 'band' ? 0.1 : 0.07);
      g.beginPath();
      run.forEach((p, i) => (i === 0 ? g.moveTo(c + p.x * r, c + p.y * r) : g.lineTo(c + p.x * r, c + p.y * r)));
      g.stroke();
    }
  }
  for (const [dot, color] of [[DOT_HI, '#ffffff'], [DOT_LO, '#3a2200']] as const) {
    const d = surfacePoint(m, dot);
    if (!d) continue;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(c + d.x * r, c + d.y * r, r * 0.2 * Math.max(0.25, d.depth), r * 0.2, Math.atan2(d.y, d.x), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  g.strokeStyle = 'rgba(40,36,0,0.45)';
  g.lineWidth = size * 0.03;
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.stroke();
  // Specular highlight and cool rim light
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(c - r * 0.38, c - r * 0.44, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(140,210,255,0.55)';
  g.lineWidth = size * 0.03;
  g.beginPath();
  g.arc(c, c, r - size * 0.02, -0.2, 1.2);
  g.stroke();
}

export function renderBallCanvas(size = 96): HTMLCanvasElement {
  const { c, g } = canvasOf(size);
  drawBall(g, size, IDENTITY);
  return c;
}

export function renderGlowCanvas(size = 128): HTMLCanvasElement {
  const { c, g } = canvasOf(size);
  const m = size / 2;
  const glow = g.createRadialGradient(m, m, 0, m, m, m);
  glow.addColorStop(0, 'rgba(255,248,170,0.9)');
  glow.addColorStop(0.35, 'rgba(255,240,120,0.35)');
  glow.addColorStop(1, 'rgba(255,240,120,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  return c;
}
