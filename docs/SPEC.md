# Forest Path — Spec

A very simple Android app for an elderly user who walks deep into the forest. It records the route she walks and draws it on a map, so she can follow the same line back.

## Users & context

- **Primary user:** an elderly person who is not tech-savvy. Large text, few buttons, nothing to configure.
- **Setup person:** a family member (the developer), who installs the app, downloads maps, and grants permissions.
- **Environment:** forest, **no or unreliable mobile signal**, walks of up to several hours, phone often in a pocket with the screen off.
- **Device:** Android phone.

## Core user flow

1. She opens the app. A map shows her current position (a blue dot).
2. She presses the big **START** button. The app begins recording.
3. She walks. The phone can be locked or in a pocket, and recording continues.
4. When she wants to go home, she opens the app. Her route so far is drawn as a thick line, and the blue dot shows where she is. She follows the line back.
5. At home she presses **STOP**, and the route is cleared or archived.

That's the whole app.

## Screens

### Main screen (the only screen she uses)

```
┌──────────────────────────────┐
│                              │
│        MAP (offline)         │
│   ━━━━━━━ thick red line ━━━ │
│              ● blue dot      │
│                       [ ◎ ]  │  ← re-center button
├──────────────────────────────┤
│   ████  START  ████          │  ← huge button, green
│   (when recording: STOP, red,│
│    needs a long press)       │
│   Recording · 2.4 km · 1h12m │  ← big status text
└──────────────────────────────┘
```

- The map follows her position automatically. If she pans away, it snaps back after about 10 s, or when she taps ◎.
- The map is **north-up** (it doesn't rotate). The start point has a clear 🏠 marker.
- **STOP needs a long press (about 2 s)** or a confirmation, so the route can't be lost by accident.
- Status text says plainly whether it's recording ("Recording" / "Not recording").

### Settings (hidden, for the family member)

Opened with a long press on the title or a similar hidden gesture:
- View or export past routes (GPX)
- Check the permission and battery-optimization status

## Functional requirements

| ID | Requirement |
|----|-------------|
| F1 | Record GPS points while recording is on, **including with the screen off and the app in the background**. |
| F2 | Show a persistent notification while recording (Android requires a foreground service). |
| F3 | Draw the recorded path as a thick, high-contrast line, plus her live position. |
| F4 | Work fully **offline**: the map for her area ships inside the APK, and the app makes no network calls at all. |
| F5 | Survive the app being killed or the phone restarting mid-walk. Points are saved as they arrive, and reopening the app shows the route still recording or resumes it. |
| F6 | Filter out GPS noise. Drop fixes with accuracy worse than about 30 m and points less than about 5 m from the previous point. |
| F7 | Keep the last N routes (for example 20) in an archive that can be exported as GPX. |
| F8 | Battery: one walk of 4–6 h should use no more than about 25% of the battery. |

## Non-goals (v1)

- Turn-by-turn navigation, routing, or search
- Accounts, cloud sync, sharing location with family
- Off-path alerts, compass arrow, or audio guidance (possible v2)
- iOS

## Open questions

- How large an area does she walk in (a radius in km)? This sets the bounding box and size of the bundled map file.
- Does she want the screen to stay on while the app is open? (This costs battery.)
- ~~Should the language be English or her native language?~~ Decided: **Lithuanian**. All text is in `app/src/strings.ts`, and the app is named "Miško takas".
