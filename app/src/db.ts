import * as SQLite from 'expo-sqlite';

import type { Pt } from './geo';

export type Route = { id: number; started_at: number; ended_at: number | null };
export type Point = Pt & { id: number; ts: number; accuracy: number | null };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Shared DB handle. Also used from the background location task, which may run
 * in a fresh JS context after the app was killed, so it must be self-initialising.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('forestpath.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS routes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          route_id INTEGER NOT NULL REFERENCES routes(id),
          ts INTEGER NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          accuracy REAL
        );
        CREATE INDEX IF NOT EXISTS points_route ON points(route_id, id);
      `);
      return db;
    })();
  }
  return dbPromise;
}

/** The route currently being recorded, if any. */
export async function getActiveRoute(): Promise<Route | null> {
  const db = await getDb();
  return db.getFirstAsync<Route>(
    'SELECT * FROM routes WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1',
  );
}

/** The most recent route, active or finished (shown on the map after STOP). */
export async function getLatestRoute(): Promise<Route | null> {
  const db = await getDb();
  return db.getFirstAsync<Route>('SELECT * FROM routes ORDER BY id DESC LIMIT 1');
}

export async function startRoute(): Promise<number> {
  const db = await getDb();
  // Close any route left open by a crash before starting a new one.
  await db.runAsync('UPDATE routes SET ended_at = ? WHERE ended_at IS NULL', Date.now());
  const res = await db.runAsync('INSERT INTO routes (started_at) VALUES (?)', Date.now());
  return res.lastInsertRowId;
}

export async function endActiveRoute(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE routes SET ended_at = ? WHERE ended_at IS NULL', Date.now());
}

export async function getLastPoint(routeId: number): Promise<Point | null> {
  const db = await getDb();
  return db.getFirstAsync<Point>(
    'SELECT * FROM points WHERE route_id = ? ORDER BY id DESC LIMIT 1',
    routeId,
  );
}

export async function insertPoint(
  routeId: number,
  p: { ts: number; lat: number; lon: number; accuracy: number | null },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO points (route_id, ts, lat, lon, accuracy) VALUES (?, ?, ?, ?, ?)',
    routeId,
    p.ts,
    p.lat,
    p.lon,
    p.accuracy,
  );
}

/** Points of a route with id greater than `afterId` (for incremental refresh). */
export async function getPoints(routeId: number, afterId = 0): Promise<Point[]> {
  const db = await getDb();
  return db.getAllAsync<Point>(
    'SELECT * FROM points WHERE route_id = ? AND id > ? ORDER BY id',
    routeId,
    afterId,
  );
}
