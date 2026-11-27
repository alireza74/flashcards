// Metro-Konfiguration (Bundler).
// Ergaenzt fuer expo-sqlite im Browser (Anleitung: node_modules/expo-sqlite/skills/expo-sqlite/references/web-and-config.md):
// - .wasm-Dateien mitbundeln (SQLite laeuft im Browser als WebAssembly)
// - Header COOP/COEP setzen, damit der Browser SharedArrayBuffer erlaubt.
//   Gilt nur fuer den Dev-Server; der Webserver der fertigen Web-App muss dieselben Header senden.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhancedMiddleware = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhancedMiddleware(req, res, next);
  };
};

module.exports = config;
