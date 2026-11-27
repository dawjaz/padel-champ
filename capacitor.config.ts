import type { CapacitorConfig } from '@capacitor/cli';

/** Capacitor wraps the Vite build (`dist/`) for Android and iOS. The appId cannot be changed after the first store release. */
const config: CapacitorConfig = {
  appId: 'studio.davj.portres',
  appName: 'PorTres',
  webDir: 'dist',
  backgroundColor: '#080818',
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#080818', androidScaleType: 'CENTER_INSIDE' },
  },
};

export default config;
