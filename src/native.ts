import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SplashScreen } from '@capacitor/splash-screen';

/** True inside the Android / iOS app (Capacitor), false in a normal browser. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Opens a web page: in the system browser inside the app, in a new tab in a browser. */
export function openUrl(url: string): void {
  if (isNative()) void Browser.open({ url });
  else window.open(url, '_blank', 'noopener');
}

/**
 * App-only setup, a no-op in a browser: hides the native splash once the game draws, and handles the Android back button
 * (it does nothing in a match or a menu, so a tap cannot throw the player out; it closes the app only from the start screens).
 */
export function initNative(currentScene: () => string | undefined): void {
  lockPortrait();
  if (!isNative()) return;
  void SplashScreen.hide();
  void App.addListener('backButton', () => {
    const s = currentScene();
    if (s === 'StartScene' || s === 'TitleScene') void App.exitApp();
  });
}

/**
 * Portrait only. The app locks it in its manifests (AndroidManifest screenOrientation, iOS Info.plist);
 * on the web the Screen Orientation API works only for an installed web app or in fullscreen, so this is
 * best effort and index.html covers landscape with a rotate hint.
 */
function lockPortrait(): void {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> };
    void o?.lock?.('portrait')?.catch(() => undefined);
  } catch {
    /* not supported: the rotate hint in index.html is the fallback */
  }
}
