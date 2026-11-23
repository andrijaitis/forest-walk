import type { MapProps } from '@maplibre/maplibre-react-native';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';

type Style = Exclude<MapProps['mapStyle'], string>;

// Prefix for the extracted map files. The asset's content hash is added to each
// file name, so a changed map (e.g. the full aerial photo replacing the blank
// fallback) is picked up automatically.
const MAP_VERSION = 'sakaline';

/** Centre of the bundled map (Sakalinė, Tauragės r.), used before the first GPS fix. */
export const MAP_CENTER: [number, number] = [22.3823, 55.1894];

export type MapFiles = { ortho: string; vector: string };

/**
 * MapLibre cannot read files packed inside the APK, so the bundled maps are
 * extracted once into the app's documents folder (persistent, never cleared by
 * the OS) and loaded from there. Returns file:// URIs.
 */
export async function ensureMapFiles(): Promise<MapFiles> {
  const [ortho, vector] = await Promise.all([
    // Resolves to a tiny blank fallback if the photo file is missing (see metro.config.js).
    ensureFile('ortho', require('../assets/map/sakaline-ortho.pmtiles')),
    ensureFile('vector', require('../assets/map/sakaline.pmtiles')),
  ]);
  removeOldMaps([ortho, vector]);
  return { ortho, vector };
}

/** Delete any other extracted map files, so old maps don't fill up the phone. */
function removeOldMaps(keep: string[]) {
  try {
    for (const item of Paths.document.list()) {
      if (item instanceof File && item.name.endsWith('.pmtiles') && !keep.includes(item.uri)) {
        item.delete();
      }
    }
  } catch {
    // Not critical: worst case an old map file stays on the phone.
  }
}

async function ensureFile(name: string, moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  const target = new File(Paths.document, `${MAP_VERSION}-${name}-${asset.hash ?? 'nohash'}.pmtiles`);
  if (target.exists && (target.size ?? 0) > 0) return target.uri;

  await asset.downloadAsync();
  if (!asset.localUri) throw new Error(`Map asset "${name}" could not be loaded`);

  if (target.exists) target.delete();
  await new File(asset.localUri).copy(target);
  return target.uri;
}

/**
 * Drawn map, then the aerial photo over it, then forest paths and roads on top in
 * high-contrast colours. No text labels, so no fonts/sprites need bundling.
 */
export function buildStyle(files: MapFiles): Style {
  const v = 'vector';
  return {
    version: 8,
    sources: {
      ortho: {
        type: 'raster',
        url: `pmtiles://${files.ortho}`,
        tileSize: 256,
        attribution: 'ORT10LT © Nacionalinė žemės tarnyba prie AM',
      },
      [v]: {
        type: 'vector',
        url: `pmtiles://${files.vector}`,
        attribution: '© OpenStreetMap',
      },
    },
    layers: [
      // Drawn map underneath: hidden by the aerial photo where it exists, and
      // visible when the photo file is missing (blank fallback) or outside its area.
      { id: 'bg', type: 'background', paint: { 'background-color': '#f2efe6' } },
      {
        id: 'forest',
        type: 'fill',
        source: v,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['forest', 'wood', 'nature_reserve', 'national_park']]],
        paint: { 'fill-color': '#8fc47a' },
      },
      {
        id: 'fields',
        type: 'fill',
        source: v,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['farmland', 'grassland', 'meadow', 'grass', 'park']]],
        paint: { 'fill-color': '#e8edc9' },
      },
      {
        id: 'water',
        type: 'fill',
        source: v,
        'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#8cc4ea' },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: v,
        'source-layer': 'buildings',
        paint: { 'fill-color': '#c9bfb2' },
      },
      { id: 'ortho', type: 'raster', source: 'ortho' },
      {
        // Forest paths/tracks: dark outline + bright yellow dashes, visible on green forest.
        id: 'paths-casing',
        type: 'line',
        source: v,
        'source-layer': 'roads',
        minzoom: 13,
        filter: ['==', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': 'rgba(0,0,0,0.55)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 16, 5, 18, 8],
        },
      },
      {
        id: 'paths',
        type: 'line',
        source: v,
        'source-layer': 'roads',
        minzoom: 13,
        filter: ['==', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': '#ffe14d',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.2, 16, 2.5, 18, 4],
          'line-dasharray': [2, 1.2],
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: v,
        'source-layer': 'roads',
        filter: ['!=', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            ['highway', 'major_road'],
            'rgba(255,200,80,0.85)',
            'rgba(255,255,255,0.75)',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 4, 18, 8],
        },
      },
    ],
  };
}
