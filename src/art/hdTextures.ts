import type Phaser from 'phaser';
import { renderArena } from './hd/arenaHd';
import { themeById } from './hd/courtThemes';
import { drawBall, renderBallCanvas, renderGlowCanvas } from './hd/ballHd';
import type { Mat3 } from './spin';
import { HD_SCALE } from '../config';

export const BALL_KEY = 'hd:ball';
export const GLOW_KEY = 'hd:glow';
export const ARENA_BACK_PREFIX = 'hd:arena-back:';
export const ARENA_NET_KEY = 'hd:arena-net';
export const ARENA_CHEER_PREFIX = 'hd:arena-cheer:';
/** Logical height of the top strip of the arena picture that holds the crowd (the cheering crowd only changes this strip). */
export const CHEER_STRIP_H = 160;

/** Logical y (in the 360x640 screen) of the top of the net strip, filled in by `ensureArenaTextures`. */
let netTopY = 0;

/** The live ball: a canvas texture that is drawn again for every orientation of the ball. */
export function ensureBallTextures(scene: Phaser.Scene): { redrawBall: (m: Mat3) => void } {
  if (!scene.textures.exists(BALL_KEY)) scene.textures.addCanvas(BALL_KEY, renderBallCanvas());
  if (!scene.textures.exists(GLOW_KEY)) scene.textures.addCanvas(GLOW_KEY, renderGlowCanvas());
  const tex = scene.textures.get(BALL_KEY) as Phaser.Textures.CanvasTexture;
  return {
    redrawBall: (m: Mat3): void => {
      const canvas = tex.getSourceImage() as HTMLCanvasElement;
      const g = canvas.getContext('2d');
      if (!g) return;
      drawBall(g, canvas.width, m);
      tex.refresh();
    },
  };
}

/**
 * Renders the arena once per court theme (about a quarter of a second) and keeps it as two textures: the back picture of
 * the theme (older themes are dropped) and the net strip, which is the same for every theme.
 */
export function ensureArenaTextures(scene: Phaser.Scene, themeId = 'blue'): { netY: number; backKey: string } {
  const backKey = ARENA_BACK_PREFIX + themeId;
  if (!scene.textures.exists(backKey) || !scene.textures.exists(ARENA_NET_KEY)) {
    const arena = renderArena(HD_SCALE, themeById(themeId));
    for (const key of scene.textures.getTextureKeys()) {
      if (key.startsWith(ARENA_BACK_PREFIX)) scene.textures.remove(key);
    }
    if (scene.textures.exists(ARENA_NET_KEY)) scene.textures.remove(ARENA_NET_KEY);
    scene.textures.addCanvas(backKey, arena.back);
    scene.textures.addCanvas(ARENA_NET_KEY, arena.net);
    netTopY = arena.netY;
  }
  return { netY: netTopY, backKey };
}

/**
 * The crowd celebrating: the same arena picture with the cheering crowd, cut down to the strip that holds the stands. The match fades
 * it in over the picture after a point. Rendered on demand (a second arena render), so call it after the match has started.
 */
export function ensureCheerTexture(scene: Phaser.Scene, themeId = 'blue'): string {
  const key = ARENA_CHEER_PREFIX + themeId;
  if (scene.textures.exists(key)) return key;
  for (const k of scene.textures.getTextureKeys()) if (k.startsWith(ARENA_CHEER_PREFIX)) scene.textures.remove(k);
  const full = renderArena(HD_SCALE, themeById(themeId), { cheer: true }).back;
  const strip = document.createElement('canvas');
  strip.width = full.width;
  strip.height = Math.ceil(CHEER_STRIP_H * HD_SCALE);
  strip.getContext('2d')?.drawImage(full, 0, 0);
  scene.textures.addCanvas(key, strip);
  return key;
}

export const SHADOW_KEY = 'flat:shadow';
export const RING_KEY = 'flat:ring';
export const DOT_KEY = 'flat:dot';

/** Flat white-on-clear pictures (a filled ellipse, an ellipse outline, a dot) that the match tints and scales instead of redrawing vector shapes every frame. */
export function ensureFlatTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void => {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (g) draw(g);
    scene.textures.addCanvas(key, c);
  };
  make(SHADOW_KEY, 64, 24, (g) => {
    g.fillStyle = '#000000';
    g.beginPath();
    g.ellipse(32, 12, 32, 12, 0, 0, Math.PI * 2);
    g.fill();
  });
  make(RING_KEY, 96, 40, (g) => {
    g.strokeStyle = '#ffe066';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(48, 20, 45, 17, 0, 0, Math.PI * 2);
    g.stroke();
  });
  make(DOT_KEY, 32, 32, (g) => {
    g.fillStyle = '#fff4a0';
    g.beginPath();
    g.arc(16, 16, 16, 0, Math.PI * 2);
    g.fill();
  });
}

/** A coin face for the coin toss ('H' or 'T'), painted once: a shape drawn every frame is triangulated every frame. */
export function ensureCoinTexture(scene: Phaser.Scene, face: 'H' | 'T'): string {
  const key = `hd:coin:${face}`;
  if (scene.textures.exists(key)) return key;
  const S = HD_SCALE * 2;
  const size = 60;
  const canvas = document.createElement('canvas');
  canvas.width = size * S;
  canvas.height = size * S;
  const g = canvas.getContext('2d');
  if (g) {
    g.scale(S, S);
    const disc = (r: number, fill: string, stroke: string, line: number): void => {
      g.beginPath();
      g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
      g.lineWidth = line;
      g.strokeStyle = stroke;
      g.stroke();
    };
    disc(26, '#b8860b', '#5a3d00', 3);
    disc(21, '#ffd447', '#fff2a8', 2);
    g.fillStyle = '#7a5200';
    g.font = '800 28px "Baloo 2", "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(face, size / 2, size / 2 + 2);
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}
