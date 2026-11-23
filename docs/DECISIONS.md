# Decisions

Format: one entry per decision, newest at the bottom.

---

## D1 — Android only

**Decision:** Target Android only. Install by sideloading an APK, with no Play Store.
**Why:** Her phone is Android. Sideloading avoids store review and the cost of an Apple developer account.

## D2 — Native app, not a web app (PWA)

**Decision:** Build a native app.
**Why:** A browser stops delivering GPS once the screen locks or the tab is in the background. Background recording is the core feature (F1), so a PWA doesn't work.

## D3 — React Native + Expo (development build)

**Decision:** Use React Native with Expo and TypeScript, built as a **development build or EAS build**, not Expo Go.
**Why:** The developer knows JS/TS. Expo provides `expo-location` together with `expo-task-manager` for background location through an Android foreground service. Expo Go doesn't support the background-location setup, so a custom build is required.
**Alternatives considered:** Capacitor (its background-GPS plugins are less mature) and native Kotlin (unfamiliar stack).

## D4 — MapLibre with the map bundled inside the APK

**Decision:** Use `@maplibre/maplibre-react-native`. The map for her area is a single **PMTiles** file that ships **inside the APK**. The style, fonts (glyphs) and icons (sprites) are bundled too, so the app never touches the network.
**Why:** There's no signal in the forest (F4). With the map bundled, she never has to download anything. The forest barely changes, so an old map is fine. To refresh the map, rebuild the APK.

**How the map file is made (one time, on the dev PC):**
1. Pick her walking area as a bounding box, with a margin (for example 15–20 km around home).
2. `pmtiles extract https://build.protomaps.com/<date>.pmtiles forest.pmtiles --bbox=<minLon,minLat,maxLon,maxLat> --maxzoom=15`
   Zoom 15 is enough because MapLibre over-zooms beyond it. Expected size is about 10–60 MB, depending on the area.
3. Check that forest tracks and paths are visible. If they aren't detailed enough, consider raising maxzoom or adding a trails layer.

**How it's shipped:**
- `forest.pmtiles` and the style JSON, glyphs and sprites go in the app's assets.
- Files inside an APK can't be read by MapLibre as normal files. So on first launch the app **copies the assets to the app's documents folder** (`expo-asset` + `expo-file-system`), and the style points to `pmtiles://file://…`.
- Labels need glyphs. Bundle only the one or two font ranges the style uses, or use a style without labels to keep things small.

**Done (2026-11-23):** `app/assets/map/nemencine.pmtiles`. It covers Nemenčinė and about 20 km around it, bbox `25.17,54.67,25.79,55.03`, zoom 0–15, 24.5 MB, from Protomaps build `20261122`. A sample forest tile contains `path` and `track` roads and `forest` land cover.
To regenerate: `pmtiles extract https://build.protomaps.com/20261122.pmtiles app/assets/map/nemencine.pmtiles --bbox=25.17,54.67,25.79,55.03 --maxzoom=15` (pmtiles CLI v1.31.2)

**Fallback:** If PMTiles doesn't work in the RN wrapper version we choose, convert the extract to **MBTiles** and serve it with `mbtiles://`, or use a MapTiler offline pack downloaded once by the family member.
**To verify during the spike:** PMTiles or MBTiles loading from a local file, and that the map renders with flight mode on.
**Note:** Don't bulk-download from openstreetmap.org tile servers, because their usage policy forbids it.

## D5 — Store points in SQLite, write each point as it arrives

**Decision:** Use `expo-sqlite`, with `routes(id, started_at, ended_at)` and `points(route_id, ts, lat, lon, accuracy)` tables. The background task inserts each point immediately.
**Why:** Points must survive the app being killed or the phone rebooting (F5). Holding them in memory and saving on STOP would lose the walk.

## D6 — Guidance is only the drawn path plus her live position

**Decision:** v1 has no off-path alerts, compass arrow, or sharing.
**Why:** Keep it as simple as possible for her. These can be added in v2 if needed.

## D7 — Accidental-STOP protection

**Decision:** STOP needs a long press of about 2 s. A stopped route goes to the archive and is never deleted.
**Why:** Losing the path deep in the forest is the worst failure the app can have.

## D8 — Location settings

**Decision:** High accuracy, `distanceInterval` of about 5 m, `timeInterval` of about 5 s. Drop fixes with accuracy worse than 30 m.
**Why:** This balances path detail against battery use (F8). Tune these numbers after the first real test walk.

## D9 — Setup checklist done by the family member

Grandma isn't expected to handle any of these:
- Location permission set to **"Allow all the time"**
- **Battery optimization disabled** for the app (otherwise OEM power managers like Samsung's or Xiaomi's kill the service)
- Notifications allowed (required for the foreground service)
- Open the app once at home, so the bundled map gets copied into place
- An app shortcut placed on the home screen

---

## Build plan (milestones)

1. **Spike:** make a small PMTiles extract of her area and bundle it into an Expo dev build. Check that the map renders with flight mode on. *(This removes the biggest risk, D4.)*
2. **Background tracking:** a START/STOP foreground service writing to SQLite. Test with the screen off for 30 min.
3. **Draw the path:** the route as a polyline, the live dot, the 🏠 start marker, and auto-follow.
4. **Robustness:** resume after the app is killed or the phone reboots, GPS-noise filtering, and the long-press STOP.
5. **Hidden settings:** archive, GPX export, and a permission-status check.
6. **Field test:** a real walk with her, then adjust font sizes, line thickness, and the interval settings.
