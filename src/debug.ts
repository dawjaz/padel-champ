import { getSave, type SaveData } from './save';

/**
 * Debug mode: the dev server (`npm run dev`) or any build opened with `?debug` in the address. It shows options that players do not
 * get (Settings: AIM, TIMING, SHOT MENU), kept for testing changes.
 */
export const DEBUG: boolean = (() => {
  try {
    return import.meta.env.DEV === true || new URLSearchParams(globalThis.location?.search ?? '').has('debug');
  } catch {
    return false;
  }
})();

type PlaySettings = Pick<SaveData['settings'], 'aim' | 'timing' | 'shotMenu'>;
/** What players get since v0.161 (these options left Settings): tap the spot, the timing ring, the plain shot list. */
export const PLAY_DEFAULTS: PlaySettings = { aim: 'point', timing: 'ring', shotMenu: 'list' };

/** Aim, timing and shot menu as the match uses them: the saved choice in debug mode, otherwise the defaults. */
export function playSettings(debug = DEBUG): PlaySettings {
  if (!debug) return PLAY_DEFAULTS;
  const s = getSave().settings;
  return { aim: s.aim, timing: s.timing, shotMenu: s.shotMenu };
}
