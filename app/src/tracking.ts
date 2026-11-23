import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getActiveRoute, getLastPoint, insertPoint, startRoute, endActiveRoute } from './db';
import { distanceM } from './geo';
import { t } from './strings';

export const LOCATION_TASK = 'forest-path-location';

// Filtering of GPS noise (see DECISIONS.md D8).
const MAX_ACCURACY_M = 30;
const MIN_STEP_M = 5;

/**
 * Must be called at module load time (imported from index.ts), so the task is
 * defined even when Android starts the JS runtime headless in the background.
 */
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const route = await getActiveRoute();
    if (!route) return;

    let last = await getLastPoint(route.id);
    for (const loc of data.locations) {
      const { latitude: lat, longitude: lon, accuracy } = loc.coords;
      if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;
      if (last && distanceM(last, { lat, lon }) < MIN_STEP_M) continue;
      const p = { ts: loc.timestamp, lat, lon, accuracy: accuracy ?? null };
      await insertPoint(route.id, p);
      last = { ...p, id: 0 };
    }
  },
);

export type PermissionResult = { ok: true } | { ok: false; message: string };

export async function ensurePermissions(): Promise<PermissionResult> {
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, message: t.gpsOff };
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, message: t.needLocation };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return { ok: false, message: t.needBackground };
  return { ok: true };
}

async function startUpdates() {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000,
    distanceInterval: 5,
    foregroundService: {
      notificationTitle: t.notificationTitle,
      notificationBody: t.notificationBody,
      notificationColor: '#2e7d32',
      killServiceOnDestroy: false,
    },
  });
}

export async function isRecording(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

export async function startRecording(): Promise<PermissionResult> {
  const perm = await ensurePermissions();
  if (!perm.ok) return perm;
  await startRoute();
  await startUpdates();
  return { ok: true };
}

export async function stopRecording(): Promise<void> {
  if (await isRecording()) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await endActiveRoute();
}

/**
 * If a route is still open in the DB but location updates are not running
 * (phone rebooted, app force-stopped), restart them so the walk continues.
 */
export async function resumeIfNeeded(): Promise<void> {
  const route = await getActiveRoute();
  if (!route || (await isRecording())) return;
  const perm = await ensurePermissions();
  if (perm.ok) await startUpdates();
}
