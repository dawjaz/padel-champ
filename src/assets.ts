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
  images: [
    // Brand (PorTres, direction C, see design/brand-proposals): the logo layers share one frame, so they stack for the intro.
    ...['all', 'word', 'por', 'tag', 'flame', 'shards', 'ball'].map((k) => ({ key: `logo_${k}`, path: `brand/logo_${k}.png` })),
    { key: 'logo_bar', path: 'brand/logo_bar.png' },
    { key: 'brand_cracks', path: 'brand/cracks.png' },
    { key: 'start_bg', path: 'brand/start_bg.jpg' },
  ],
  audio: [],
};

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
