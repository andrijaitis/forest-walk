// Downloads Lithuanian ORT10LT aerial imagery for a bounding box as Web Mercator
// (EPSG:3857) 256px JPEG tiles and writes them to an MBTiles file.
// Convert afterwards with: pmtiles convert <out>.mbtiles <out>.pmtiles
//
// Usage: node tools/fetch-ortho.mjs <minLon> <minLat> <maxLon> <maxLat> <minZ> <maxZ> <out.mbtiles>
//
// Imagery © Nacionalinė žemės tarnyba prie Aplinkos ministerijos (ORT10LT).
// Personal, non-commercial use only. Requests are made one at a time with a pause,
// to be gentle on geoportal.lt. Re-running resumes (existing tiles are skipped).

import { DatabaseSync } from 'node:sqlite';

const SERVICE =
  'https://www.geoportal.lt/arcgis/rest/services/NZT/ORT10LT_2021_2023/MapServer/export';
const PAUSE_MS = 150;

const [minLon, minLat, maxLon, maxLat, minZ, maxZ] = process.argv.slice(2, 8).map(Number);
const out = process.argv[8];
if (!out || [minLon, minLat, maxLon, maxLat, minZ, maxZ].some(Number.isNaN)) {
  console.error('Usage: node fetch-ortho.mjs minLon minLat maxLon maxLat minZ maxZ out.mbtiles');
  process.exit(1);
}

const R = 6378137;
const HALF = Math.PI * R;
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
/** Web Mercator bounds of XYZ tile. */
function tileBounds(x, y, z) {
  const size = (2 * HALF) / 2 ** z;
  const minx = -HALF + x * size;
  const maxy = HALF - y * size;
  return [minx, maxy - size, minx + size, maxy];
}

const db = new DatabaseSync(out);
db.exec(`
  CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB,
    PRIMARY KEY (zoom_level, tile_column, tile_row));
`);
const meta = db.prepare('INSERT OR REPLACE INTO metadata (name, value) VALUES (?, ?)');
for (const [k, v] of Object.entries({
  name: 'ORT10LT orthophoto',
  format: 'jpg',
  type: 'baselayer',
  bounds: `${minLon},${minLat},${maxLon},${maxLat}`,
  center: `${(minLon + maxLon) / 2},${(minLat + maxLat) / 2},${maxZ - 2}`,
  minzoom: String(minZ),
  maxzoom: String(maxZ),
  attribution: 'ORT10LT © Nacionalinė žemės tarnyba prie AM',
})) meta.run(k, v);

const has = db.prepare('SELECT 1 FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?');
const put = db.prepare('INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)');

const jobs = [];
for (let z = minZ; z <= maxZ; z++) {
  for (let x = lon2x(minLon, z); x <= lon2x(maxLon, z); x++)
    for (let y = lat2y(maxLat, z); y <= lat2y(minLat, z); y++) jobs.push([x, y, z]);
}
console.log(`${jobs.length} tiles for z${minZ}-${maxZ}`);

let done = 0, fetched = 0, failed = 0, bytes = 0;
for (const [x, y, z] of jobs) {
  const tmsY = 2 ** z - 1 - y;
  done++;
  if (has.get(z, x, tmsY)) continue;
  const bbox = tileBounds(x, y, z).map((v) => v.toFixed(2)).join(',');
  const url = `${SERVICE}?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=256,256&format=jpg&f=image`;
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'forest-path-personal/1.0' } });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.startsWith('image/')) {
        const buf = new Uint8Array(await res.arrayBuffer());
        put.run(z, x, tmsY, buf);
        bytes += buf.length;
        fetched++;
        ok = true;
      } else {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (!ok) failed++;
  if (done % 100 === 0 || done === jobs.length)
    console.log(`${done}/${jobs.length}  fetched=${fetched} failed=${failed} ${(bytes / 1e6).toFixed(1)} MB`);
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}
db.close();
console.log(`Done. fetched=${fetched} failed=${failed}${failed ? ' (re-run to retry)' : ''}`);
