/** Smooth padel ball and its soft glow as canvases (pure Canvas2D). */
function canvasOf(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  return { c, g };
}

export function renderBallCanvas(size = 96): HTMLCanvasElement {
  const { c, g } = canvasOf(size);
  const r = size / 2 - 3;
  const m = size / 2;
  const body = g.createRadialGradient(m - r * 0.4, m - r * 0.45, r * 0.05, m + r * 0.1, m + r * 0.1, r * 1.2);
  body.addColorStop(0, '#ffffd0');
  body.addColorStop(0.35, '#eee03a');
  body.addColorStop(0.8, '#a79a0c');
  body.addColorStop(1, '#5e5604');
  g.fillStyle = body;
  g.beginPath();
  g.arc(m, m, r, 0, Math.PI * 2);
  g.fill();
  // The white seam of a tennis-style ball
  g.save();
  g.beginPath();
  g.arc(m, m, r, 0, Math.PI * 2);
  g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = size * 0.05;
  g.beginPath();
  g.arc(m - r * 1.15, m, r * 0.95, -0.9, 0.9);
  g.stroke();
  g.beginPath();
  g.arc(m + r * 1.15, m, r * 0.95, Math.PI - 0.9, Math.PI + 0.9);
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(40,36,0,0.45)';
  g.lineWidth = size * 0.03;
  g.beginPath();
  g.arc(m, m, r, 0, Math.PI * 2);
  g.stroke();
  // Specular highlight and cool rim light
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(m - r * 0.38, m - r * 0.44, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(140,210,255,0.55)';
  g.lineWidth = size * 0.03;
  g.beginPath();
  g.arc(m, m, r - size * 0.02, -0.2, 1.2);
  g.stroke();
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
