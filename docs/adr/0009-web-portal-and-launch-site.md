# ADR 0009: Web portal and pre-launch website

**Status:** accepted (2026-11-06). Supersedes the earlier scope note that `/web` stays empty.

## Context

The owner asked for a public website with a waitlist and a web version of the app, fully wired
to the existing API.

## Decisions

1. **One Next.js app in `/web`** for both the website and the portal, sharing one design system
   that mirrors the mobile tokens.
2. **Backend-for-frontend.** The browser never holds API tokens. A same-origin proxy keeps them in
   httpOnly cookies and forwards an allowlist of tourist routes. This avoids CORS and token theft
   by XSS.
3. **Web as a third client.** Sessions accept `platform = 'web'`. Card setup and payments take an
   optional `returnTo: 'WEB'`; the API then sends the hosted card page and 3-D Secure back to
   `WEB_APP_BASE_URL` instead of the app deep link (`payments.return_channel`). The API CSP allows
   that origin in `form-action`, because browsers apply it to the redirect after a form post.
4. **Launch module** (`/v1/launch`): waitlist with referral codes (each referral moves you up
   5 places), anonymous Hustle Check scored on the server, moderated Wall of Hustle stories,
   live counters. No IP addresses are stored; abuse control is rate limits. Leaving the waitlist
   deletes the entry, using an HMAC-derived token sent only by email.
5. **Admin:** `launch:read` (all roles) and `launch:moderate` (Support Agent, Admin) cover the
   waitlist list, survey summary and story moderation (audited). No admin UI yet.

## Consequences

- Behind the proxy, the API needs `TRUST_PROXY=true` for per-IP limits to see real clients.
- Real partner pages (when integrated) must accept both return URLs.
- Satoshi on the web is covered by the same licence check as the app (OQ-23).
