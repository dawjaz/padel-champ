import type Phaser from 'phaser';
import type { Appearance } from '../game/types';
import { buildToon, FIG, type ToonView } from './toon/character';
import { renderOpsCanvas, VIEW } from './toon/ops';

/** Pixels per character unit of the stored texture (the figure is ~340 units tall, so ~510 px). */
const TEXTURE_UNIT = 1.5;

/** Builds (once) the texture of a toon character for this look and view and returns its key. */
export function ensureToonTexture(scene: Phaser.Scene, appearance: Appearance, view: ToonView = 'front'): string {
  const key = `toon:${view}:${JSON.stringify(appearance)}`;
  if (scene.textures.exists(key)) return key;
  scene.textures.addCanvas(key, renderOpsCanvas(buildToon(appearance, view), TEXTURE_UNIT));
  return key;
}

/**
 * Adds a toon character whose soles are at (x, feetY) and whose body (head top to soles) is `height` logical pixels tall.
 * The image is larger than the figure (room for the racket and the shadow), so it is positioned by its origin.
 */
export function addToon(
  scene: Phaser.Scene,
  x: number,
  feetY: number,
  height: number,
  appearance: Appearance,
  view: ToonView = 'front',
): Phaser.GameObjects.Image {
  const k = height / (FIG.feet - FIG.top);
  const img = scene.add.image(x, feetY, ensureToonTexture(scene, appearance, view));
  img.setOrigin((FIG.cx - VIEW.x) / VIEW.w, (FIG.feet + 2 - VIEW.y) / VIEW.h);
  img.setDisplaySize(VIEW.w * k, VIEW.h * k);
  return img;
}
