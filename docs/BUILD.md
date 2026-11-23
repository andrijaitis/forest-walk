# Building the APK (Windows)

How to build and install Forest Path on Windows. Building on macOS or Linux skips step 1 of the setup.

## One-time setup

1. **Turn on Windows long paths.** The React Native C++ build creates file paths over 260 characters. Run this in PowerShell **as Administrator**, then restart your terminal or VS Code:
   ```powershell
   New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   ```
2. **Install Android Studio.** In **SDK Manager → SDK Tools**, tick **Show Package Details** and install a **CMake 4.x** (tested with 4.1.2). The default CMake 3.22.1 comes with ninja 1.10, which can't handle long paths even with step 1 done. You'll see `Filename longer than 260 characters`.
3. **Install dependencies:**
   ```bash
   cd app
   npm install
   ```

## Aerial photo map (not in git)

The aerial photo is **`app/assets/map/sakaline-ortho.pmtiles`** (about 70 MB). This file is **not in the repository** for two reasons: it is too large, and the imagery licence allows personal use only, so it must not be published in a public repo.

**Without it the app still builds.** `metro.config.js` then uses `sakaline-ortho-fallback.pmtiles` instead: a 593-byte blank, transparent layer that is in git. The build prints `⚠ … not found: building with the blank fallback`. The app then shows the drawn map (green forest, fields, water) with the paths, but no photo. Put the real file in place and rebuild to get the photo back. The phone picks up the new file automatically, because each map file's name includes its content hash.

You can get it in one of two ways:

**A. Copy it from a family member's PC or private storage.** This is the fastest way, if someone already has the file. Put it at `app/assets/map/sakaline-ortho.pmtiles`. Share it only privately (USB stick, a private Google Drive link to family), never publicly.

**B. Regenerate it from the official source (about 1 hour).**

- Imagery: **ORT10LT 2021–2023**, the Lithuanian national orthophoto, © Nacionalinė žemės tarnyba prie AM
- Service: https://www.geoportal.lt/arcgis/rest/services/NZT/ORT10LT_2021_2023/MapServer
- Viewer, to look at the imagery: https://www.geoportal.lt/map/

1. Install the **pmtiles CLI**: download `go-pmtiles_<version>_Windows_x86_64.zip` from https://github.com/protomaps/go-pmtiles/releases and unzip it (tested with v1.31.2).
2. Download the tiles. Node 22.5 or newer is needed for the built-in `node:sqlite`. The script fetches one tile at a time with a pause, to be gentle on the server. It is safe to stop and re-run, because finished tiles are skipped.
   ```bash
   node tools/fetch-ortho.mjs 22.224 55.099 22.540 55.279 10 16 ortho.mbtiles
   ```
   Wait for the last line, which should read `Done. fetched=… failed=0`. If any tiles failed, run the same command again.
3. Convert the tiles to the format the app reads:
   ```bash
   pmtiles convert ortho.mbtiles app/assets/map/sakaline-ortho.pmtiles
   ```
4. Check the result. It should report `tile type: jpg` and `max zoom: 16`:
   ```bash
   pmtiles show app/assets/map/sakaline-ortho.pmtiles
   ```

To cover a different area, change the four bbox numbers (minLon minLat maxLon maxLat) and regenerate the vector map with the same bbox (see D10 in [DECISIONS.md](DECISIONS.md)). Also update `MAP_CENTER` in `app/src/map.ts`.

## Generate the Android project

`app/android/` is generated and not in git. Create it with:
```bash
cd app
npx expo prebuild --platform android
```

Then create `app/android/local.properties` to point the build at the newer CMake:
```properties
sdk.dir=C\:/Users/<you>/AppData/Local/Android/Sdk
cmake.dir=C\:/Users/<you>/AppData/Local/Android/Sdk/cmake/4.1.2
```
Check that this file still exists **after every `npx expo prebuild`**, with or without `--clean`, because prebuild can delete it. Prebuild is needed whenever `app.json` changes, for example the app name or plugins.

## Environment for each build shell

Android Studio's bundled Java works. You don't need to install a separate JDK.
```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
```

## Release APK (for her phone)

Standalone: the app code and the map are inside the APK, so no PC or Wi-Fi is needed.
```bash
cd app/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
```
Output: `app/android/app/build/outputs/apk/release/app-release.apk` (about 113 MB)

- `arm64-v8a` covers modern phones, `armeabi-v7a` covers older 32-bit phones, and `x86_64` covers the Android Studio emulator. Leave out the ones you don't need to build faster and get a smaller APK.
- The APK is signed with the template's standard debug key. That works for installing it yourself. Keep using the same key so new versions install over the old one without losing her saved routes.

## Debug build (for development)

The debug build loads JavaScript from the dev server on your PC over Wi-Fi, so code changes show up on the phone straight away.
```bash
cd app/android
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
cd ..
npx expo start --dev-client --lan
```
Open the app on the phone and pick the server, or enter `http://<PC-IP>:8081`. The phone must be on the same Wi-Fi as the PC.

## Installing

- **USB:** `"$ANDROID_HOME/platform-tools/adb.exe" install -r <path-to-apk>`
- **Copying the file:** copy the APK to the phone, open it, and allow "Install unknown apps".

Then, on her phone:
1. Open the app, tap START, and choose **"Allow all the time"** for location.
2. Go to **Settings → Apps → Forest Path → Battery → Unrestricted**. Otherwise the phone's battery saver may stop recording when the screen is off.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Filename longer than 260 characters` | Long paths are off, or the build is using CMake 3.22.1. See the one-time setup, and check `local.properties`. |
| `couldn't find DSO to load: libreactnative.so` on the emulator | The APK was built without `x86_64`. Add it to `reactNativeArchitectures`. |
| Debug app shows a blank white screen | The dev server isn't running or the phone can't reach it. Check the Wi-Fi and the firewall prompt for Node.js. |
| Building from a `subst` drive doesn't help | Node resolves the drive back to the real path, so the paths stay long. Use the CMake 4.x fix instead. |

## Updating the map

See D10 in [DECISIONS.md](DECISIONS.md) for the commands that regenerate both map files (the aerial photo and the vector paths). No version bump is needed: each extracted file's name includes the asset's content hash, so the phone copies over changed files and deletes the old ones automatically.
