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
  if (!isNative()) return;
  void SplashScreen.hide();
  void App.addListener('backButton', () => {
    const s = currentScene();
    if (s === 'StartScene' || s === 'TitleScene') void App.exitApp();
  });
}
