# XenDirekt web

One Next.js 16 app with two faces:

- **The website** (`/`): the pre-launch site. Hero with a live portal preview over a monochrome
  “thousand hills” video, the Hustle Check (an anonymous five-tap survey that declassifies the
  feature files), the moderated Wall of Hustle, FAQ and the waitlist with referral links.
- **The portal** (`/sign-in` → `/app`): the web version of the mobile app. Email code sign-in,
  profile and PIN onboarding with animated illustrations, Send to MoMo (verified name, exact
  quote, PIN step-up, 3-D Secure), Activity with live status and receipts, Cards, Inbox, Help and
  Settings.

Everything is integrated with the API in `/api`; nothing is mocked in the browser.

## Run it

```bash
# API first (see ../starter-cmds.md), then:
cd web
cp .env.example .env.local   # API_BASE_URL=http://localhost:3000
npm install
npm run dev                  # http://localhost:3100
```

The API must know where the web lives (`WEB_APP_BASE_URL`, default `http://localhost:3100`) so
card setup and 3-D Secure return here. No CORS is needed: the browser only talks to this origin.

## How it talks to the API

`app/api/xd/[...path]` is a same-origin proxy (backend-for-frontend):

- Tokens never reach JavaScript. `/api/session/verify` exchanges the one-time code and keeps the
  access and refresh tokens in httpOnly, SameSite=Lax cookies; the proxy adds the bearer token.
- Only tourist-facing routes are forwarded (an allowlist); admin, webhook and dev routes are not.
- Mutating requests must be same-origin (`Sec-Fetch-Site`/`Origin` check).
- Refresh is serialised across tabs with the Web Locks API, because the API revokes a session
  when a rotated refresh token is reused.
- The client IP is forwarded in `X-Forwarded-For`. Set `TRUST_PROXY=true` on the API when it sits
  behind this proxy, or per-IP rate limits count every web visitor as one client.
- Sessions are created with `platform: "web"` and a per-browser device ID cookie.

## Design system

- Tokens in `app/globals.css` mirror the mobile `XdColors` (light and dark); `#FF640A` is the only
  accent and orange surfaces carry near-black text.
- Satoshi (converted to WOFF2 from the app's font files) with tight tracking everywhere; Geist
  Mono for small labels.
- Theme follows the system by default; the toggle stores the choice (`xd-theme`).
- Motion uses `motion/react`; everything respects `prefers-reduced-motion`.

## Hero video

`public/media/hero-{dark,light}.{av1.mp4,mp4}` are rendered by `scripts/render-hero-video.py`
(procedural, no stock footage, seamless 20 s loop). Re-render with `npm run render:hero`
(`--preview` writes stills to `qa-output/`). Phones, reduced motion and Save-Data get the poster.

## Checks

```bash
npm run lint && npm run typecheck && npm run format:check && npm run build
# Against a running API + `npm run dev`:
npm run qa:launch                    # Hustle Check, waitlist, wall (website)
QA_API=http://localhost:3005 npm run qa:portal -- dark   # full portal flow; needs EMAIL_TRANSPORT=dev-inbox
npm run qa:screens -- / home dark 1440
```

The QA scripts use the installed Google Chrome through Playwright and write to `qa-output/`.
