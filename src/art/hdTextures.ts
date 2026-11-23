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
