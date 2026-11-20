// Expo-Konfiguration (ersetzt app.json).
// Die app-spezifischen Werte kommen aus src/config/app-identity.json,
// damit ein Klon nur an einer Stelle angepasst werden muss.
import type { ExpoConfig } from 'expo/config';

import appIdentity from './src/config/app-identity.json';

const config: ExpoConfig = {
  name: appIdentity.name,
  slug: appIdentity.slug,
  version: appIdentity.version,
  scheme: appIdentity.scheme,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  // Grundlage fuer EAS Update: Updates nur an Builds mit gleicher App-Version
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: appIdentity.iosBundleIdentifier,
    supportsTablet: true,
  },
  android: {
    package: appIdentity.androidPackage,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // single = klassische Single-Page-App, als statische Dateien auslieferbar
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: appIdentity.primaryColor,
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
