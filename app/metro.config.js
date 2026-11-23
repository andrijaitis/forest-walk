const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The offline map ships inside the APK as a .pmtiles asset.
config.resolver.assetExts.push('pmtiles');

module.exports = config;
