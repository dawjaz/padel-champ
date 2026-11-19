/**
 * Asset manifest. Files live in `public/assets/` and are loaded once by BootScene.
 * To swap a placeholder rectangle for a sprite: drop the PNG into public/assets/sprites/,
 * add it to `images` below, then use `this.add.image(x, y, key)` in the scene.
 * See docs/ASSETS.md.
 */
export interface AssetEntry {
  key: string;
  /** Path relative to public/assets/ */
  path: string;
}

export const ASSETS: { images: AssetEntry[]; audio: AssetEntry[] } = {
  images: [],
  audio: [],
};

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
