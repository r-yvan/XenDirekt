# Testing

## Running the suites

API (`cd api`). The integration and e2e suites need PostgreSQL. They use a database whose name
must end in `_test` (default `xendirekt_test`; override with `TEST_DATABASE_URL`). They refuse
any other database.

```bash
npm run lint && npm run typecheck && npm run format:check
npm test                    # unit
npm run test:contract       # XentriPay adapter against recorded responses (no network)
npm run test:integration    # schema drift, outbox (real PostgreSQL)
npm run test:e2e            # full HTTP stack + mock provider, serial
npm run test:all            # everything, serial
```

Mobile (`cd android-ios`):

```bash
flutter analyze && dart format --output=none --set-exit-if-changed lib test
flutter test                # unit + widget + contract fixtures (live test skipped)
```

Mobile against the real API (from the repository root). This builds the API, starts it on port
3100 with the mock provider and the dev inbox, and runs the Dart live test:

```bash
scripts/live-integration.sh
```

## What each layer proves

| Layer | Location | Proves |
|---|---|---|
| Unit (API) | `api/test/unit` | money, fees, FX and rounding boundaries; phone normalisation and MTN routing; card eligibility; quote expiry; **every allowed and forbidden state transition**; risk rules; permissions; redaction and PAN scrubbing; TOTP/HMAC/Argon2 helpers; startup guards; webhook signature; settlement CSV parsing |
| Contract (API) | `api/test/contract` | the XentriPay adapter maps every documented payout status. Unknown statuses are never success. Timeouts are ambiguous, never failures. |
| Integration (API) | `api/test/integration` | migrations match the schema types (drift test); outbox claiming, retries, dead-lettering and dedupe under concurrency |
| E2E (API) | `api/test/e2e` | the HTTP API with the real modules, database and mock provider, with time controlled by a manual clock |
| Unit/widget (app) | `android-ios/test` | contrast ≥ 4.5:1, error mapping, router redirects, stale-lookup guard, sign-up flow, app lock, payment resume, secure-screen ref-counting, analytics events |
| Contract fixtures | `contracts/fixtures` | the e2e suite records sanitised API responses. The Flutter suite decodes every one with the app's models. If the API changes shape, the app's tests fail. |
| Live | `android-ios/test/integration/live_api_test.dart` | the real app code (Dio client, token refresh, device-key signing) against a running API: sign-up → card → lookup → quote → step-up → pay → 3-D Secure → completion, forced payout failure, history, logout |

## Payment scenarios (implementation brief §14)

| # | Scenario | Test |
|---|---|---|
| 1 | Authorisation → payout → confirmation → capture → receipt → notifications | `payments.e2e` scenario 1, `notifications-support.e2e` |
| 2 | Card declined | `payments.e2e` scenario 2 |
| 3 | 3-D Secure abandoned or timed out | `payments.e2e` scenario 3 |
| 4 | Payee lookup failure or inactive payee | `cards-payees-quotes.e2e` "blocks … with PAYEE_NOT_FOUND / PAYEE_INACTIVE / PROVIDER_UNAVAILABLE" |
| 5 | Quote expires before payment | `payments.e2e` scenario 5 |
| 6 | Payout fails → authorisation voided | `payments.e2e` scenario 6 |
| 7 | Payout timeout, unknown outcome → review, no duplicate payout | `payments.e2e` scenarios 7a, 7b; DB-level `the database refuses a second payout` |
| 8 | Payout succeeds, capture fails → review, no second payout | `payments.e2e` scenario 8 |
| 9 | Same idempotency key returns the same payment | `payments.e2e` scenario 9 (including concurrent requests) |
| 10 | Duplicate provider event has no duplicate effect | `operations.e2e` "accepts a signed event once, ignores duplicates…" |
| 11 | Connectivity lost and resumed safely | `android-ios/test/widget/payment_resume_test.dart` (same key, same payment); live test replay |
| 12 | Risk flag holds before payout | `payments.e2e` scenario 12; `operations.e2e` approve/reject |
| 13 | Refund / void / reversal distinct and auditable | `operations.e2e` scenario 13 |
| 14 | Another user's payment | `payments.e2e` scenario 14 |
| 15 | Prohibited admin action | `operations.e2e` scenario 15; `admin-identity.e2e` |

Also covered:

- **Invalid webhook signatures:** bad, stale or missing signatures are rejected and nothing is
  stored.
- **No card numbers at rest:** `pan-leak.e2e`.
- **Maker-checker:** the requester cannot approve their own refund.
- **Refund without the capability:** the refund waits for evidence instead of being faked.
- **Reconciliation:** mismatches are surfaced and never auto-corrected.

## Mock provider (development and tests only)

Production refuses to start with `PAYMENT_PROVIDER=mock`. Everything it returns is labelled
`simulated: true`, every name starts with `SANDBOX`, and the app shows a "Sandbox: no real money
moves" banner.

**Cards.** Pick one on the mock hosted page; no card number is ever typed:

| Key | Behaviour |
|---|---|
| `visa-new` | Normal card with a unique fingerprint on every add (used by the live test so risk rules do not trigger across runs) |
| `visa-home` | Normal credit card issued in the tourist's country |
| `mc-home` | Normal Mastercard debit |
| `visa-3ds` | Asks for 3-D Secure on every payment |
| `visa-decline` | Issuer declines payments |
| `visa-capture-fails` | Capture fails after a successful payout |
| `visa-setup-fails` | 3-D Secure fails while adding the card |
| `visa-rwanda` | Issued in Rwanda: not eligible |
| `mc-prepaid` | Prepaid gift card: not eligible |
| `visa-foreign` | Issued in Brazil: rejected as `COUNTRY_MISMATCH` when the card rule `blockOnCountryMismatch` is on and the residence differs |

**Payees**, chosen by the last four digits of the MTN number:

| Suffix | Behaviour |
|---|---|
| `0000` | Account not found |
| `0001` | Account inactive |
| `0002` | Lookup service unavailable |
| `1111` | Payout fails → hold released |
| `2222` | Payout stays pending → review after 2 minutes |
| `3333` | Payout call times out but the payout succeeded (reconciled by status) |
| `4444` | Payout succeeds, then is reported reversed |
| anything else | Success (first status check pending, then succeeded) |

**3-D Secure:** the mock challenge page has Approve and Decline buttons. Closing it abandons
the challenge, and the payment fails without a charge after 5 minutes.

## Visual review on a device or emulator

PIN, lock and payment screens block screenshots (`FLAG_SECURE`), so captures come out black.
For a design review build only:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 --dart-define=XD_ALLOW_SCREENSHOTS=true
```

Widget tests run in a 390×844 pt phone viewport (`test/support/pump_app.dart`), not the 800×600
default, so layouts are checked at a realistic size.

## Test data rules

- Fixtures and seeds use synthetic data only: `SANDBOX` names, `example.com` / `xendirekt.test`
  emails, and generated numbers.
- Never copy anything from `reference-docs/`, which contains real personal data.
- Recorded fixtures pass through the PAN scan in `pan-leak.e2e`.

## Not automated yet

- **Performance:** no load tests. The NFR-PER targets are measured by histograms
  (`xd_http_request_duration_seconds`, `xd_provider_request_duration_seconds`,
  `xd_payee_lookup_duration_seconds`) but not asserted.
- **Device and accessibility:** no runs on real devices or screen readers. Font scaling,
  TalkBack and VoiceOver need manual QA on Android 9 and iOS 15 devices.
- **Real provider sandbox:** no tests against XentriPay's sandbox; credentials are pending
  (OQ-15).
- **Backup restore drill:** not done yet (see `deployment.md`).
