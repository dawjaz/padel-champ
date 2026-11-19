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
  const body = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r * 1.05);
  body.addColorStop(0, '#fffbb0');
  body.addColorStop(0.55, '#e8dc2a');
  body.addColorStop(1, '#a89a10');
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
  g.strokeStyle = 'rgba(40,36,0,0.55)';
  g.lineWidth = size * 0.035;
  g.beginPath();
  g.arc(m, m, r, 0, Math.PI * 2);
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
