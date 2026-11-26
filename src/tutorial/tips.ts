import type Phaser from 'phaser';
import { getSave } from '../save';
import { tipDue } from './lessons';

/**
 * Shows the tip `id` over `scene` the first time (the scene is paused until the player closes it) unless tips are off or it has been
 * seen. Returns whether it opened; `done` runs after the scene is resumed. Call it a moment after the scene has been created.
 */
export function showTip(scene: Phaser.Scene, id: string, done?: () => void): boolean {
  if (!tipDue(getSave().tips, id) || scene.scene.manager.isActive('TipScene')) return false;
  scene.scene.pause();
  scene.scene.launch('TipScene', { queue: [id], under: scene.scene.key, done, tip: true });
  return true;
}

/** Opens a lesson (or several in a row) whether seen or not: from the list, or the first run. */
export function openLessons(scene: Phaser.Scene, queue: string[], done?: () => void): void {
  scene.scene.pause();
  scene.scene.launch('TipScene', { queue, under: scene.scene.key, done });
}
