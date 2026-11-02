# XenDirekt — Starter Commands

Run each block from the project root unless a `cd` says otherwise.

> **API** listens on `:3000` (all interfaces). After **any** change to `api/.env`, restart the backend — `nest --watch` reloads only on source changes, **not** `.env`.

Each target needs a **different `API_BASE_URL`** — that's the main gotcha.

| Target | `API_BASE_URL` | Why |
| --- | --- | --- |
| Chrome (web) | `http://localhost:3000` | web is served on `:8080`, allowed via CORS |
| Android emulator | `http://10.0.2.2:3000` | emulator's alias for the host PC |
| Real device (USB) | `http://localhost:3000` | mapped to the PC with `adb reverse` |

---

## 1. Setup + run the backend

```bash
cd "api"
npm install        # first time only (installs dependencies)
npm run start:dev  # nest start --watch, serves http://localhost:3000
```

**Prereqs:** local Postgres running (`DATABASE_URL` in `api/.env` uses the unix socket).
Swagger (local): <http://localhost:3000/docs> (controlled by `ENABLE_API_DOCS`).

---

## 2. Flutter app on Chrome (web, this PC)

Web is a separate origin, so the API must allow it via CORS. `CORS_ALLOWED_ORIGINS=http://localhost:8080` is set in `api/.env`, so pin the web port to `8080`.

```bash
cd "android-ios"
flutter run -d chrome --web-port=8080 --web-hostname=localhost \
  --dart-define=API_BASE_URL=http://localhost:3000
```

---

## 3. Flutter app on an Android emulator

From inside the emulator, the host PC is reached at `10.0.2.2` (not `localhost`, not the LAN IP). Make sure KVM is free and the emulator is stopped before heavy Gradle builds (7.5 GB RAM).

```bash
flutter emulators --launch Pixel_10_Pro   # starts the emulator; wait for it to boot
cd "android-ios"
flutter run -d emulator --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

If `-d emulator` is ambiguous, list devices and use the exact id:

```bash
flutter devices
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

---

## 4. Flutter app on a real device (USB, debugging enabled)

**Recommended:** `adb reverse` maps the phone's `localhost:3000` to this PC's `:3000` over USB, so you don't depend on Wi-Fi or a changing LAN IP.

```bash
adb devices                    # confirm the phone shows as "device" (authorize on phone if prompted)
adb reverse tcp:3000 tcp:3000  # phone localhost:3000 -> PC :3000
cd "android-ios"
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

**Alternative** (same Wi-Fi, no `adb reverse`): use this PC's current LAN IP instead. Re-check it with `ip -4 addr` — it was `192.168.1.97`, but DHCP can change it.

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.97:3000
```
