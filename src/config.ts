export const WIDTH = 360;
export const HEIGHT = 640;
/**
 * The game's name (decided 2026-11-26): PorTres, in the store "PorTres: Padel Career". Two words: in the all-capitals UI it is
 * written POR TRES (with a space), in the logo and the store PorTres (capital T keeps the split).
 */
export const GAME_TITLE = 'POR TRES';
export const GAME_SUBTITLE = 'PADEL CAREER';
export const GAME_VERSION = '0.156';
declare const __BUILD__: string;
/** Short git hash of the deployed build (set by vite.config.ts), or 'dev' when running locally. */
/** Free Practice (a tuning tool) is hidden from the title menu; set to true to show it again. */
export const SHOW_FREE_PRACTICE = false;

export const BUILD_ID: string = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

/**
 * The game is laid out on a 360x640 logical screen, but drawn on a canvas HD_SCALE times bigger
 * (every scene zooms its camera by this factor), so text and shapes stay sharp on phone screens.
 */
export const HD_SCALE = 2;

export const FONT = '"Trebuchet MS", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

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
