import Phaser from 'phaser';

/** Smallest touch target in logical px (about 40 CSS px on a phone, the usual minimum). */
export const MIN_HIT = 40;

/**
 * Makes every interactive object at least MIN_HIT x MIN_HIT on screen: a small button keeps its look but gets a
 * bigger invisible hit area. Call once before the game starts. It only grows rectangular hit areas.
 */
export function enforceMinHitArea(): void {
  const proto = Phaser.GameObjects.GameObject.prototype;
  const original = proto.setInteractive;
  proto.setInteractive = function (this: Phaser.GameObjects.GameObject, hitArea?: unknown, callback?: unknown, dropZone?: boolean) {
    const result = original.call(this, hitArea as never, callback as never, dropZone);
    growHitArea(this);
    return result;
  };
}

export function growHitArea(obj: Phaser.GameObjects.GameObject): void {
  const area = obj.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  if (!area || !(area instanceof Phaser.Geom.Rectangle)) return;
  const t = obj as unknown as { scaleX?: number; scaleY?: number };
  const sx = Math.abs(t.scaleX ?? 1) || 1;
  const sy = Math.abs(t.scaleY ?? 1) || 1;
  const needW = MIN_HIT / sx;
  const needH = MIN_HIT / sy;
  if (area.width < needW) {
    const d = (needW - area.width) / 2;
    area.x -= d;
    area.width = needW;
  }
  if (area.height < needH) {
    const d = (needH - area.height) / 2;
    area.y -= d;
    area.height = needH;
  }
}
