import type { MapProps } from '@maplibre/maplibre-react-native';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';

type Style = Exclude<MapProps['mapStyle'], string>;

// Bump this when the bundled map file changes, so the new one is copied over the old.
const MAP_VERSION = 'nemencine-20261122';

/** Centre of the bundled map (Nemenčinė), used before the first GPS fix. */
export const MAP_CENTER: [number, number] = [25.48, 54.85];
export const MAP_BOUNDS: [number, number, number, number] = [25.17, 54.67, 25.79, 55.03];

/**
 * MapLibre cannot read files packed inside the APK, so the bundled map is
 * extracted once into the app's documents folder (persistent, never cleared by
 * the OS) and loaded from there. Returns a file:// URI.
 */
export async function ensureMapFile(): Promise<string> {
  const target = new File(Paths.document, `${MAP_VERSION}.pmtiles`);
  if (target.exists && (target.size ?? 0) > 0) return target.uri;

  const asset = Asset.fromModule(require('../assets/map/nemencine.pmtiles'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Map asset could not be loaded');

  const src = new File(asset.localUri);
  if (target.exists) target.delete();
  await src.copy(target);
  return target.uri;
}

/**
 * A deliberately simple, high-contrast style with no text labels, so no fonts
 * or sprites need to be bundled. Forest paths/tracks are drawn prominently.
 */
export function buildStyle(mapFileUri: string): Style {
  const src = 'base';
  return {
    version: 8,
    sources: {
      [src]: {
        type: 'vector',
        url: `pmtiles://${mapFileUri}`,
        attribution: '© OpenStreetMap',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#f2efe6' } },
      {
        id: 'earth',
        type: 'fill',
        source: src,
        'source-layer': 'earth',
        paint: { 'fill-color': '#f2efe6' },
      },
      {
        id: 'forest',
        type: 'fill',
        source: src,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['forest', 'wood', 'nature_reserve', 'national_park']]],
        paint: { 'fill-color': '#b5d9a3' },
      },
      {
        id: 'fields',
        type: 'fill',
        source: src,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['farmland', 'grassland', 'meadow', 'grass', 'park']]],
        paint: { 'fill-color': '#e8edc9' },
      },
      {
        id: 'residential',
        type: 'fill',
        source: src,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['residential', 'industrial', 'commercial']]],
        paint: { 'fill-color': '#e3dcd2' },
      },
      {
        id: 'water',
        type: 'fill',
        source: src,
        'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#8cc4ea' },
      },
      {
        id: 'waterway',
        type: 'line',
        source: src,
        'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#5aa5d6', 'line-width': 2 },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: src,
        'source-layer': 'buildings',
        paint: { 'fill-color': '#c9bfb2' },
      },
      {
        // Forest paths and tracks: the important ones for her.
        id: 'paths',
        type: 'line',
        source: src,
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#7a4b1e',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3, 18, 5],
          'line-dasharray': [2, 1],
        },
      },
      {
        id: 'roads-casing',
        type: 'line',
        source: src,
        'source-layer': 'roads',
        filter: ['!=', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#8a8a8a',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 8, 18, 14],
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: src,
        'source-layer': 'roads',
        filter: ['!=', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            ['highway', 'major_road'],
            '#f7d774',
            '#ffffff',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 6, 18, 11],
        },
      },
    ],
  };
}
