import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { getLatestRoute, getPoints, type Point } from './src/db';
import { pathLengthM } from './src/geo';
import { buildStyle, ensureMapFiles, MAP_CENTER, type MapFiles } from './src/map';
import { t } from './src/strings';
import { isRecording, resumeIfNeeded, startRecording, stopRecording } from './src/tracking';

const REFRESH_MS = 3000;
const REFOLLOW_MS = 10000;

export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

function MainScreen() {
  const [mapFiles, setMapFiles] = useState<MapFiles | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [now, setNow] = useState(Date.now());
  const routeIdRef = useRef<number | null>(null);
  const lastIdRef = useRef(0);
  const refollowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<CameraRef>(null);

  // One-time setup: extract the map, ask for location, resume an interrupted walk.
  useEffect(() => {
    ensureMapFiles().then(setMapFiles, (e) => setMapError(String(e)));
    Location.requestForegroundPermissionsAsync().catch(() => {});
    resumeIfNeeded()
      .catch(() => {})
      .finally(() => refresh());
  }, []);

  // Pull new points from the DB (written by the background task).
  const refresh = useCallback(async () => {
    const route = await getLatestRoute();
    setRecording(await isRecording());
    if (!route) {
      routeIdRef.current = null;
      setPoints([]);
      setStartedAt(null);
      return;
    }
    setStartedAt(route.started_at);
    if (routeIdRef.current !== route.id) {
      routeIdRef.current = route.id;
      const all = await getPoints(route.id);
      lastIdRef.current = all.at(-1)?.id ?? 0;
      setPoints(all);
    } else {
      const fresh = await getPoints(route.id, lastIdRef.current);
      if (fresh.length) {
        lastIdRef.current = fresh[fresh.length - 1].id;
        setPoints((prev) => [...prev, ...fresh]);
      }
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (AppState.currentState === 'active') {
        refresh().catch(() => {});
        setNow(Date.now());
      }
    }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh().catch(() => {}));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [refresh]);

  const onStart = async () => {
    setBusy(true);
    try {
      const res = await startRecording();
      if (!res.ok) Alert.alert('', res.message);
      routeIdRef.current = null;
      setFollow(true);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    try {
      await stopRecording();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  // If she pans the map away, snap back to her position after a while.
  const onTrackChange = (mode: string | null) => {
    if (mode) return;
    setFollow(false);
    if (refollowTimer.current) clearTimeout(refollowTimer.current);
    refollowTimer.current = setTimeout(() => setFollow(true), REFOLLOW_MS);
  };

  const recenter = () => {
    if (refollowTimer.current) clearTimeout(refollowTimer.current);
    setFollow(true);
  };

  const style = useMemo(() => (mapFiles ? buildStyle(mapFiles) : null), [mapFiles]);

  const line = useMemo<GeoJSON.Feature>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) },
    }),
    [points],
  );
  const home = points[0];
  const km = (pathLengthM(points) / 1000).toFixed(1);
  const mins = startedAt ? Math.floor(((recording ? now : points.at(-1)?.ts ?? now) - startedAt) / 60000) : 0;
  const duration = t.duration(Math.floor(mins / 60), mins % 60);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        {style ? (
          <Map style={StyleSheet.absoluteFill} mapStyle={style} attribution={false} logo={false} compass={false} touchRotate={false} touchPitch={false}>
            <Camera
              ref={cameraRef}
              initialViewState={{ center: MAP_CENTER, zoom: 15 }}
              maxZoom={18}
              trackUserLocation={follow ? 'default' : undefined}
              onTrackUserLocationChange={(e) => onTrackChange(e.nativeEvent.trackUserLocation)}
            />
            {points.length > 1 && (
              <GeoJSONSource id="route" data={line}>
                <Layer
                  id="route-casing"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': '#ffffff', 'line-width': 12 }}
                />
                <Layer
                  id="route-line"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': '#d32f2f', 'line-width': 8 }}
                />
              </GeoJSONSource>
            )}
            {home && (
              <GeoJSONSource
                id="home"
                data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [home.lon, home.lat] } }}
              >
                <Layer
                  id="home-dot"
                  type="circle"
                  paint={{
                    'circle-radius': 14,
                    'circle-color': '#2e7d32',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 4,
                  }}
                />
              </GeoJSONSource>
            )}
            <UserLocation accuracy={false} heading />
          </Map>
        ) : (
          <View style={styles.center}>
            {mapError ? <Text style={styles.error}>{mapError}</Text> : <ActivityIndicator size="large" />}
            {!mapError && <Text style={styles.status}>{t.loadingMap}</Text>}
          </View>
        )}
        {!follow && (
          <Pressable style={styles.recenter} onPress={recenter} accessibilityLabel={t.centerOnMe}>
            <Text style={styles.recenterText}>◎</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.panel}>
        {recording ? (
          <Pressable
            style={({ pressed }) => [styles.button, styles.stop, pressed && styles.pressed]}
            onLongPress={onStop}
            delayLongPress={2000}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{t.stop}</Text>
            <Text style={styles.hint}>{t.holdToStop}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.button, styles.start, pressed && styles.pressed]}
            onPress={onStart}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{t.start}</Text>
          </Pressable>
        )}
        <Text style={[styles.status, recording && styles.statusOn]}>
          {recording ? `● ${t.recording}` : t.notRecording}
          {points.length > 1 ? `  ·  ${km} km  ·  ${duration}` : ''}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  mapWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  error: { color: '#b00020', fontSize: 18, padding: 24, textAlign: 'center' },
  recenter: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  recenterText: { fontSize: 40, color: '#1565c0' },
  panel: { padding: 16, gap: 12, backgroundColor: '#ffffff' },
  button: { height: 110, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  start: { backgroundColor: '#2e7d32' },
  stop: { backgroundColor: '#c62828' },
  pressed: { opacity: 0.75 },
  buttonText: { color: '#ffffff', fontSize: 44, fontWeight: '800', letterSpacing: 2 },
  hint: { color: '#ffffff', fontSize: 16, marginTop: 4 },
  status: { fontSize: 22, textAlign: 'center', color: '#444444' },
  statusOn: { color: '#c62828', fontWeight: '700' },
});
