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

**Done (2026-11-23):** a first map of Nemenčinė worked on the emulator. It was replaced by Sakalinė the same day (see D10).

**Fallback:** If PMTiles doesn't work in the RN wrapper version we choose, convert the extract to **MBTiles** and serve it with `mbtiles://`, or use a MapTiler offline pack downloaded once by the family member.
**To verify during the spike:** PMTiles or MBTiles loading from a local file, and that the map renders with flight mode on.
**Note:** Don't bulk-download from openstreetmap.org tile servers, because their usage policy forbids it.

## D10 — Sakalinė, with aerial imagery under the drawn paths

**Decision:** The map covers **Sakalinė (Gaurės sen., Tauragės r.), 55.1894°N 22.3823°E**, about 10 km in each direction. It shows an **aerial photo** as the background, with OSM forest paths (yellow dashes) and roads drawn on top.
**Why:** On the drawn map it was hard to see where the forest actually is. The photo shows forest, clearings and fields as they really look, and the paths drawn on top are still easy to follow.

Two files are bundled in `app/assets/map/`:
- **`sakaline-ortho.pmtiles`:** the aerial photo. It is Lithuania's **ORT10LT 2021–2023** orthophoto, requested from the geoportal.lt ArcGIS `export` endpoint already converted to EPSG:3857 (the service itself uses LKS94). Zoom 10–16, 256 px JPEG tiles, about 1.4 m per pixel at z16, about 70 MB.
  To regenerate:
  ```
  node tools/fetch-ortho.mjs 22.224 55.099 22.540 55.279 10 16 ortho.mbtiles
  pmtiles convert ortho.mbtiles app/assets/map/sakaline-ortho.pmtiles
  ```
- **`sakaline.pmtiles`:** the vector paths and roads. It is a Protomaps extract with bbox `22.224,55.099,22.540,55.279`, zoom 0–15, 4.9 MB.
  To regenerate: `pmtiles extract https://build.protomaps.com/20261122.pmtiles app/assets/map/sakaline.pmtiles --bbox=22.224,55.099,22.540,55.279 --maxzoom=15`

**Not in git:** `sakaline-ortho.pmtiles` is git-ignored, because the repo is public and the imagery is for personal use only. It is also large. [BUILD.md](BUILD.md) ("Aerial photo map") explains how to get it or regenerate it. If it is missing, the build automatically uses a 593-byte transparent fallback, which is in git. The drawn forest, field and water colours under the photo layer then show through, so the app still works without the photo.

**Licence:** ORT10LT © Nacionalinė žemės tarnyba prie AM. The geoportal.lt terms give a free, personal licence to use the service, but say nothing explicit about saving tiles offline. The family decided to use it for **personal, family-only use**: the APK is not published, the attribution is kept in the map style, and the download is done once, gently (one request at a time, with pauses). Ask the land agency (NŽT) before any wider distribution.
**Options considered:** Sentinel-2 cloudless (only 10 m per pixel, too blurry for paths; the licence is NC). Esri and Mapbox imagery (their terms forbid offline bulk use).
**Next time:** A newer ORT10LT edition (`ORT10LT_2024_2026`) exists but didn't cover Sakalinė yet (it returned HTTP 500 in Nov 2026). Switch to it once it does.

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
