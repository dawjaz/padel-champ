export const WIDTH = 360;
export const HEIGHT = 640;
export const GAME_TITLE = 'PADEL CHAMP 26';
export const GAME_VERSION = '0.7';
declare const __BUILD__: string;
/** Short git hash of the deployed build (set by vite.config.ts), or 'dev' when running locally. */
export const BUILD_ID: string = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

export const FONT = '"Courier New", monospace';

/** NES-flavoured palette. Keep all colours here so the look can be changed in one place. */
export const COLORS = {
  black: 0x000000,
  white: 0xfcfcfc,
  gray: 0xbcbcbc,
  bg: 0x0b0b1a,
  panel: 0x2b2b5e,
  panelHover: 0x4040a0,
  yellow: 0xf8b800,
  red: 0xd82800,
  blue: 0x0058f8,
  sky: 0x3cbcfc,
  green: 0x00a800,
  court: 0x1e5fa8,
  courtLine: 0xfcfcfc,
  glass: 0x9fd8ff,
} as const;

/** Converts 0xRRGGBB to a CSS colour string for Phaser text styles. */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
