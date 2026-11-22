import type Phaser from 'phaser';
import type { Appearance } from '../game/types';
import { buildToon, FIG, type ToonPose, type ToonView } from './toon/character';
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

/**
 * Adds the head and shoulders of a toon character as a portrait: `width` logical pixels wide, top edge at `top`,
 * centred on `cx`. The picture is cropped from the same texture as the full figure.
 */
export function addToonHead(scene: Phaser.Scene, cx: number, top: number, width: number, appearance: Appearance, view: ToonView = 'front', heightFrac = 1): Phaser.GameObjects.Image {
  const u0 = 28; // region in character units: x 28..172, y -8..122
  const v0 = -32;
  const wu = 144;
  const hu = 150;
  const k = width / (wu * TEXTURE_UNIT);
  const img = scene.add.image(cx - width / 2 - (u0 - VIEW.x) * TEXTURE_UNIT * k, top - (v0 - VIEW.y) * TEXTURE_UNIT * k, ensureToonTexture(scene, appearance, view));
  img.setOrigin(0, 0).setScale(k);
  img.setCrop((u0 - VIEW.x) * TEXTURE_UNIT, (v0 - VIEW.y) * TEXTURE_UNIT, wu * TEXTURE_UNIT, hu * heightFrac * TEXTURE_UNIT);
  return img;
}

/** Pixels per character unit of the match textures (many are kept: 4 players x 12 poses x 2 views). */
const MATCH_UNIT = 0.55;

/** Texture of one pose of a player in the match (no shadow: the scene draws it under the feet). */
export function ensureToonPoseTexture(scene: Phaser.Scene, appearance: Appearance, view: ToonView, pose: ToonPose): string {
  const key = `toonm:${view}:${pose}:${JSON.stringify(appearance)}`;
  if (scene.textures.exists(key)) return key;
  scene.textures.addCanvas(key, renderOpsCanvas(buildToon(appearance, view, pose, false), MATCH_UNIT));
  return key;
}

/**
 * Places a match sprite (origin at the soles) so that the figure, head to soles, is `height` logical pixels tall. The picture is
 * larger than the figure (room for the racket), so it is sized by the whole frame.
 */
export function placeToonSprite(img: Phaser.GameObjects.Image, x: number, feetY: number, height: number): void {
  const k = height / (FIG.feet - FIG.top);
  img.setOrigin((FIG.cx - VIEW.x) / VIEW.w, (FIG.feet + 2 - VIEW.y) / VIEW.h);
  img.setDisplaySize(VIEW.w * k, VIEW.h * k);
  img.setPosition(x, feetY);
}
