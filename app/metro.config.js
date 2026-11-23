const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The offline maps ship inside the APK as .pmtiles assets.
config.resolver.assetExts.push('pmtiles');

// The aerial photo map is large and not in git (see docs/BUILD.md, "Aerial photo map").
// If it is missing, build with a tiny blank fallback instead: the app then shows
// the drawn map (forest/fields/water colours) under the paths, without the photo.
const ORTHO = 'sakaline-ortho.pmtiles';
const FALLBACK = 'sakaline-ortho-fallback.pmtiles';
const orthoMissing = !fs.existsSync(path.join(__dirname, 'assets/map', ORTHO));
if (orthoMissing) {
  console.warn(`\n⚠ assets/map/${ORTHO} not found: building with the blank fallback (no aerial photo).\n`);
}
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (orthoMissing && moduleName.endsWith(`/${ORTHO}`)) {
    moduleName = moduleName.slice(0, -ORTHO.length) + FALLBACK;
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
