import type Phaser from 'phaser';
import type { Appearance } from '../game/types';
import type { Facing } from './character';
import { renderCharacterCanvas } from './hd/characterHd';

/**
 * Builds (once) a smooth, shaded character texture for this look and returns its key.
 * The picture is HD_CHARACTER_SCALE times bigger than the old pixel grid, so scenes scale it down by that factor.
 */
export function ensureCharacterTexture(scene: Phaser.Scene, appearance: Appearance, facing: Facing): string {
  const key = `char:hd:${facing}:${JSON.stringify(appearance)}`;
  if (scene.textures.exists(key)) return key;
  scene.textures.addCanvas(key, renderCharacterCanvas(appearance, facing));
  return key;
}
