// Jest-Konfiguration NUR fuer Tests gegen das lokale Supabase (*.integration.test.ts).
// Ohne das jest-expo-Preset: dessen Setup ersetzt fetch durch einen Platzhalter, echte Netzaufrufe
// waeren dann nicht moeglich. Aufruf: npm run test:integration (Anleitung im Testkopf).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
