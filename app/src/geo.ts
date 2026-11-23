export type Pt = { lat: number; lon: number };

/** Distance between two points in metres (haversine). */
export function distanceM(a: Pt, b: Pt): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLengthM(pts: Pt[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += distanceM(pts[i - 1], pts[i]);
  return sum;
}
