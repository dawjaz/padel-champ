/**
 * The studio mark ("Turbo"): a heavy, forward-leaning D with a small j cut out of it (the dot is a square pixel). White on a
 * transparent canvas. Same geometry as the proposal sheet (200 x 200 units, the D skewed by -12 degrees).
 */
const D = 'M36 22 H104 A78 78 0 0 1 104 178 H36 Z';
const J_STEM = 'M107 78 V128 A24 24 0 0 1 83 152 H66';

/** Draws the mark into a new square canvas of `px` pixels. */
export function drawStudioMark(px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  const k = px / 200;
  g.scale(k, k);
  // the D, leaning forward
  g.save();
  g.translate(17, 0);
  g.transform(1, 0, -Math.tan((12 * Math.PI) / 180), 1, 0, 0);
  g.fillStyle = '#ffffff';
  g.fill(new Path2D(D));
  // the j, cut out: a square dot and a hooked stem
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(96, 44, 22, 22);
  g.lineWidth = 22;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.stroke(new Path2D(J_STEM));
  g.restore();
  return c;
}
