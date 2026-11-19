import type Phaser from 'phaser';
import { renderArena } from './hd/arenaHd';
import { renderBallCanvas, renderGlowCanvas } from './hd/ballHd';
import { HD_SCALE } from '../config';

export const BALL_KEY = 'hd:ball';
export const GLOW_KEY = 'hd:glow';
export const ARENA_BACK_KEY = 'hd:arena-back';
export const ARENA_NET_KEY = 'hd:arena-net';

/** Logical y (in the 360x640 screen) of the top of the net strip, filled in by `ensureArenaTextures`. */
let netTopY = 0;

export function ensureBallTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BALL_KEY)) scene.textures.addCanvas(BALL_KEY, renderBallCanvas());
  if (!scene.textures.exists(GLOW_KEY)) scene.textures.addCanvas(GLOW_KEY, renderGlowCanvas());
}

/** Renders the arena once (about a quarter of a second) and keeps it as two textures. */
export function ensureArenaTextures(scene: Phaser.Scene): { netY: number } {
  if (!scene.textures.exists(ARENA_BACK_KEY)) {
    const arena = renderArena(HD_SCALE);
    scene.textures.addCanvas(ARENA_BACK_KEY, arena.back);
    scene.textures.addCanvas(ARENA_NET_KEY, arena.net);
    netTopY = arena.netY;
  }
  return { netY: netTopY };
}
