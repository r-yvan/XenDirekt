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
cd "/run/media/r-yvan/Personal Disk/Skills & Knowledge/Coding/Projects/Business Oriented/Pending/XenDirekt/android-ios"
flutter run -d chrome --web-port=8080 --web-hostname=localhost \
  --dart-define=API_BASE_URL=http://localhost:3000
```

---

## 3. Flutter app on an Android emulator

From inside the emulator, the host PC is reached at `10.0.2.2` (not `localhost`, not the LAN IP). Make sure KVM is free and the emulator is stopped before heavy Gradle builds (7.5 GB RAM).

```bash
# 1. Launch the emulator and WAIT until it is fully booted (getprop returns 1).
flutter emulators --launch Pixel_10_Pro
adb wait-for-device
until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

# 2. Run the app (the device id is emulator-5554, NOT "emulator").
cd "/run/media/r-yvan/Personal Disk/Skills & Knowledge/Coding/Projects/Business Oriented/Pending/XenDirekt/android-ios"
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Notes if it fails:
- **"No supported devices … matching 'emulator'"** → the emulator hadn't finished booting yet, or you used `-d emulator`. Wait for boot (step 1) and use the exact id `emulator-5554`.
- **"cd: android-ios: No such file or directory"** → you weren't at the project root. The absolute `cd` above avoids that.
- Confirm the id any time with `flutter devices` or `adb devices`.

---

## 4. Flutter app on a real device (USB, debugging enabled)

**Recommended:** `adb reverse` maps the phone's `localhost:3000` to this PC's `:3000` over USB, so you don't depend on Wi-Fi or a changing LAN IP.

```bash
adb devices                    # confirm the phone shows as "device" (authorize on phone if prompted)
adb reverse tcp:3000 tcp:3000  # phone localhost:3000 -> PC :3000
cd "/run/media/r-yvan/Personal Disk/Skills & Knowledge/Coding/Projects/Business Oriented/Pending/XenDirekt/android-ios"
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

**Alternative** (same Wi-Fi, no `adb reverse`): use this PC's current LAN IP instead. Re-check it with `ip -4 addr` — it was `192.168.1.97`, but DHCP can change it.

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.97:3000
```

---

## 5. Website + web portal (Next.js, this PC)

The browser only talks to the web server, which proxies the API, so no CORS is needed. Run the
backend first, then:

```bash
cd "/run/media/r-yvan/Personal Disk/Skills & Knowledge/Coding/Projects/Business Oriented/Pending/XenDirekt/web"
npm install          # first time only
npm run dev          # http://localhost:3100  (website at /, portal at /sign-in)
```

`web/.env.local` sets `API_BASE_URL=http://localhost:3000`. The API's `WEB_APP_BASE_URL` defaults
to `http://localhost:3100` (card setup and 3-D Secure return there). Recommended in `api/.env`
when using the web: `TRUST_PROXY=true`, so rate limits see each visitor's IP.
