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
Recreate this file whenever `android/` is regenerated, for example after `prebuild --clean`.

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

See D4 in [DECISIONS.md](DECISIONS.md). Regenerate `app/assets/map/nemencine.pmtiles` with the `pmtiles extract` command there, and bump `MAP_VERSION` in `app/src/map.ts` so the phone copies over the new map file.
