# Requirements traceability

Maps every requirement ID in `XenDirekt_PRD_MVP_v1.0.pdf` to implementation modules, tests,
status and open decisions.

**Status values:** `Planned` · `Done` (implemented, tests pass) · `Done (sandbox only)`
(works end to end with the mock provider; real provider capability missing) · `Blocked`
(needs a provider or PM decision before it can work for real) · `Partial` (part implemented;
the gap is stated) · `Descoped` (excluded by the implementation brief) · `Deferred` (web UI phase).

Paths are relative to the repository root. `api/` = NestJS backend, `android-ios/` = Flutter app.

## 5.0 Three-tap rule

| ID | Requirement | Pri | Implementation | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|
| TAP-RULES | App opens on Pay; three tabs (Pay, History, Profile); one level of nesting; auto-advance; no confirmation screens; undo for 5 s; hold-to-confirm only for delete account; biometrics on Pay; deep links | Must | `android-ios/lib/app/router/`, `features/payments/`, `features/profile/` | Widget tests per screen | Planned | — |
| TAP-LOG | App logs `taps_to_complete` per flow | Must | `features/*` + `api/src/modules/analytics` | Unit test on the analytics allowlist | Planned | — |

## 5.1 Onboarding and account

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-ONB-01 | Splash < 2 s, one welcome screen, no carousel | Must | — | `features/onboarding/` | widget | Planned | — |
| FR-ONB-02 | Apple/Google/email/phone sign-up; 6-digit OTP, 5-min expiry, max 5 attempts; autofill and auto-submit | Must | `modules/auth` | `features/authentication/` | unit, integration, e2e | Planned (email + phone; Apple/Google behind flag) | OQ-29 |
| FR-ONB-03 | Full name, country, DOB prefilled; Terms and Privacy accepted by the Continue tap, timestamped | Must | `modules/users`, `modules/consents` | `features/profile/` | integration, widget | Planned | — |
| FR-ONB-04 | PIN, biometrics in the same step | Must | `modules/auth` (PIN, step-up, device keys) | `features/authentication/`, `core/security/` | unit, integration, widget | Planned (fixed 6 digits) | OQ-21 |
| FR-ONB-05 | English and French, default from device | Must | notification templates | `app/localization/` | widget | Planned | — |
| FR-ONB-06 | Partner KYC when limits exceeded | Must | `modules/users` (KYC status), `modules/quotes` (limit → KYC hint) | `features/profile/` | unit | Blocked (no KYC provider) | OQ-04 |
| FR-ONB-07 | Delete account; retain only what the law requires | Must | `modules/users` | `features/profile/` | integration | Planned | OQ-26 |

## 5.2 Card management

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-CRD-01 | Add card via partner tokenisation or hosted fields; PAN never touches XenDirekt | Must | `modules/cards`, `modules/provider` | `features/cards/` (hosted page in WebView) | integration, e2e, PAN-leak test | Planned (sandbox only) | OQ-08 |
| FR-CRD-02 | Verify card with 3DS + zero/small authorisation | Must | `modules/cards`, `modules/provider` | `features/cards/` | integration | Planned (sandbox only) | OQ-08, OQ-09 |
| FR-CRD-03 | Reject Rwandan-issued, prepaid gift, blocked BIN ranges | Must | `modules/cards/domain/card-eligibility.ts`, `modules/configuration` | — | unit | Planned | — |
| FR-CRD-04 | Show brand + last 4 + expiry; default; remove | Must | `modules/cards` | `features/cards/`, `features/profile/` | integration, widget | Planned | — |
| FR-CRD-05 | Up to 3 cards | Must | `modules/cards` (row lock + count) | — | integration (concurrency) | Planned | — |

## 5.3 Payee lookup

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-PAY-01 | Phone number or MoMo Pay merchant code | Must | `modules/payees` | `features/payee_lookup/` | unit, e2e | Partial: phone done; merchant code behind disabled flag | OQ-10 |
| FR-PAY-02 | Detect network from prefix; user override | Must | `modules/payees/domain/network-routing.ts` | — | unit | Descoped in part: MTN only, **no override** | OQ-20 |
| FR-PAY-03 | Automatic name lookup when number complete; show registered name before any charge | Must | `modules/payees`, `modules/provider` | `features/payee_lookup/` (debounce, stale-response guard) | unit, e2e, widget | Planned (sandbox only) | OQ-10 |
| FR-PAY-04 | Lookup fails or inactive → block payment with clear message | Must | `modules/payees` | `features/payee_lookup/` | e2e, widget | Planned | — |
| FR-PAY-05 | Recent payees (name + masked number) | Should | `modules/payees` (`user_payees`) | `features/payee_lookup/` | integration | Planned | — |
| FR-PAY-06 | Paste number; strip spaces and country code | Should | `shared/phone` | `features/payee_lookup/` | unit | Planned | — |

## 5.4 Amount, quote and confirmation

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-QTE-01 | Amount in whole RWF; server-configured min/max | Must | `modules/quotes`, `modules/configuration` | `features/quotes/` | unit (boundaries) | Planned | OQ-03 |
| FR-QTE-02 | Quote: merchant RWF, fee, FX, card total; valid 5 min | Must | `modules/quotes/domain/quote-calculator.ts` | `features/quotes/` | unit (rounding), integration | Planned | OQ-02, OQ-28 |
| FR-QTE-03 | Live summary on Pay screen, no confirm screen | Must | — | `features/payments/`, `features/quotes/` | widget | Planned | — |
| FR-QTE-04 | Optional 60-char note in merchant SMS | Should | `modules/payments`, `modules/notifications` | `features/payments/` | unit | Planned | — |
| FR-QTE-05 | One tap on Pay starts biometrics; Pay disabled while in flight | Must | `modules/auth` (step-up) | `features/payments/` | widget | Planned | — |

## 5.5 Payment execution

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-EXE-01 | App-generated idempotency key; never charge twice | Must | `modules/payments` (unique `(user_id, idempotency_key)`) | `features/payments/` | integration (concurrent), e2e | Planned | — |
| FR-EXE-02 | Authorise (3DS) → payout → capture after payout success | Must | `modules/payments/application/payment-orchestrator.ts`, `jobs/` | `features/payments/` | integration per transition | Planned (sandbox only) | OQ-09, OQ-13 |
| FR-EXE-03 | Payout fails → void automatically and tell the user | Must | orchestrator, `modules/refunds` | `features/payments/` | integration | Planned (sandbox only) | OQ-09 |
| FR-EXE-04 | Live status; poll or webhooks until final | Must | orchestrator, `modules/webhooks` | `features/payments/` (polling) | integration | Planned (polling; webhooks mock only) | OQ-11 |
| FR-EXE-05 | No final state after 2 min → PENDING_REVIEW, visible to ops | Must | `jobs/payment-sweeper` | — | integration | Planned | OQ-22 |

## 5.6 Confirmations and receipts

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-RCP-01 | Merchant SMS EN + Kinyarwanda | Must | `modules/notifications` (templates) | — | unit | Blocked (SMS sender undecided; RW copy needs review) | OQ-06, OQ-24 |
| FR-RCP-02 | Tourist SMS, or push + email fallback | Must | `modules/notifications` | `features/notifications/` | integration | Partial (email + in-app; SMS/push ports not configured) | OQ-31 |
| FR-RCP-03 | In-app receipt with all fields, Kigali time | Must | `modules/payments` (receipt view) | `features/receipts/` | unit, widget | Planned | — |
| FR-RCP-04 | Share or download receipt as PDF/image | Should | — | `features/receipts/` | widget | Planned (share as text) | — |

## 5.7 History and support

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-HIS-01 | History newest first, status chips, filter | Must | `modules/payments` (cursor pagination) | `features/history/` | integration, widget | Planned | — |
| FR-HIS-02 | FAQ; report a problem with reference attached | Must | `modules/tickets` | `features/support/` | integration, widget | Planned | — |
| FR-HIS-03 | Push for success, failure, refund | Must | `modules/notifications` | `features/notifications/` | integration | Partial (in-app inbox; push not configured) | OQ-31 |

## 5.8 Admin console

The web UI is deferred by the brief; the **backend APIs** below are in scope.

| ID | Requirement | Pri | API | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|
| FR-ADM-01 | Login with SSO or email + 2FA; four roles | Must | `modules/admin` | integration, e2e | Planned (API) / Deferred (UI) | OQ-36 |
| FR-ADM-02 | Search payments; full timeline | Must | `modules/payments/admin-payments.controller.ts` | e2e | Planned (API) / Deferred (UI) | — |
| FR-ADM-03 | Review queue: approve, refund, block | Must | `modules/payments` (review actions), `modules/refunds`, `modules/risk` | e2e | Planned (API) / Deferred (UI) | OQ-12, OQ-25 |
| FR-ADM-04 | Block/unblock user, card fingerprint, payee | Must | `modules/risk` (blocklist) | integration | Planned (API) / Deferred (UI) | — |
| FR-ADM-05 | Configure fees, limits, min/max, BINs without a release | Must | `modules/configuration` | integration | Planned (API) / Deferred (UI) | — |
| FR-ADM-06 | Daily reconciliation report | Must | `modules/reconciliation` | integration | Planned (provisional file format) / Deferred (UI) | OQ-14 |
| FR-ADM-07 | Dashboard metrics | Should | `modules/payments` (admin metrics) | integration | Planned (API) / Deferred (UI) | — |
| FR-ADM-08 | Audit log of every admin action (who, what, when, before/after) | Must | `modules/audit` (append-only trigger) | integration | Planned | — |

## 8.1 Security and privacy

| ID | Requirement | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|
| NFR-SEC-01 | No PAN/CVV on servers or in logs; partner tokens only | `modules/cards`, `common/logging` (redaction) | hosted page only | PAN-pattern leak test over logs, DB and analytics | Planned (SAQ-A is a target, not a claim) | OQ-08 |
| NFR-SEC-02 | TLS 1.2+; certificate pinning | deployment | `core/security/` (pinning) | — | Planned | OQ-35 |
| NFR-SEC-03 | Encryption at rest; secrets in a vault | field encryption (AES-256-GCM) for provider tokens; `docs/deployment.md` | — | unit | Planned | OQ-05 |
| NFR-SEC-04 | 15-min access tokens; device-bound refresh; lock after 5 min | `modules/auth` | `core/security/app_lock` | integration, widget | Planned | — |
| NFR-SEC-05 | Masking in logs and for the Viewer role | `common/logging`, admin serializers | — | unit, e2e | Planned | — |
| NFR-SEC-06 | Webhooks verified by signature and source IP; replays ignored | `modules/webhooks` | — | integration | Partial (mock contract; XentriPay has none) | OQ-11 |
| NFR-SEC-07 | Root/jailbreak detection; screenshot blocking | — | `core/security/` | — | Partial (screenshot guard; detection vendor open) | OQ-30 |
| NFR-SEC-08 | Law n° 058/2021 compliance | consents, deletion, retention | — | — | Partial (needs legal review) | OQ-05, OQ-26 |

## 8.2 Fraud and risk controls

| ID | Requirement | API | Tests | Status | Open decisions |
|---|---|---|---|---|---|
| NFR-RSK-01 | 3DS on every first payment per card and when the partner asks | `modules/payments`, `modules/provider` | integration | Planned (sandbox only) | OQ-09 |
| NFR-RSK-02 | Per-user/card/payee limits per payment, day, trip; configurable | `modules/quotes/domain/limits.ts`, `modules/configuration` | unit, integration | Planned | OQ-03, OQ-27 |
| NFR-RSK-03 | Velocity: many cards per device, card on many accounts, many tourists paying one new payee | `modules/risk/domain/rules/` | unit, integration | Planned | — |
| NFR-RSK-04 | Name or country mismatch → block card | `modules/risk`, `modules/cards` | unit | Partial (runs only when the provider returns data) | — |
| NFR-RSK-05 | Device fingerprint; one active account per device | `modules/auth` (install ID), `modules/risk` | integration | Planned | — |
| NFR-RSK-06 | Sanctions and PEP screening via partner | `modules/risk` (port) | — | Blocked | OQ-01 |
| NFR-RSK-07 | Flagged payment held at AUTHORISED, sent to review before payout | orchestrator, `modules/risk` | integration (scenario 12) | Planned | — |

## 8.3 Performance, availability, quality

| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| NFR-PER-01 | Lookup p95 ≤ 3 s; quote p95 ≤ 1 s | metrics histograms per route | load-test script | Planned |
| NFR-PER-02 | API adds ≤ 300 ms p95 over partner time | provider call histograms vs request histograms | — | Planned |
| NFR-PER-03 | Usable on 3G; < 200 KB per payment | compact JSON, no images on payment screens | — | Planned |
| NFR-AVL-01 | 99.5% monthly; outage banner in app | `/v1/app-config` status banner | widget | Planned |
| NFR-AVL-02 | Daily backups, 30-day retention, tested restore | `docs/deployment.md`, `api/scripts/` | restore drill | Planned (docs) |
| NFR-QA-01 | Tests for every transition, duplicate webhooks, timeouts | `api/test/` | — | Planned |
| NFR-QA-02 | Font scaling, contrast ≥ 4.5:1, screen-reader labels | `app/theme`, semantics | widget (contrast unit test) | Planned |
| NFR-QA-03 | Android 9+, iOS 15+ | `android/app/build.gradle.kts`, `ios/` | — | Planned |

## 10.1 Analytics events (no personal data)

| ID | Event | Status |
|---|---|---|
| AN-01 | `app_installed`, `signup_started`, `signup_completed` | Planned |
| AN-02 | `card_added`, `card_add_failed` | Planned |
| AN-03 | `payee_lookup_succeeded` / `payee_lookup_failed` | Planned |
| AN-04 | `quote_shown`, `payment_confirmed` | Planned |
| AN-05 | `payment_completed` / `payment_failed` / `payment_voided` | Planned |
| AN-06 | `ticket_created` | Planned |

## 10.5 MVP acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| AC-1 | Real MTN number and MoMo Pay code paid in partner production | Blocked (provider); Airtel descoped |
| AC-2 | Registered name before every payment; unknown number blocks | Planned |
| AC-3 | Confirmations within 30 s of success | Blocked (SMS/push channels) |
| AC-4 | Forced payout failure releases hold; "You have not been charged" | Planned (sandbox only) |
| AC-5 | Same idempotency key never creates a second charge | Planned |
| AC-6 | Admin finds payment, sees timeline, refunds, exports reconciliation | Partial (API; refund execution gated; UI deferred) |
| AC-7 | No card number in logs, DB or analytics | Planned |

## Success metrics (PRD §2)

| Metric | Source | Status |
|---|---|---|
| Payment completion rate | `payments` states + `payment_confirmed` event | Planned |
| Median time to pay | app `pay_screen_opened` → `payment_completed` | Planned |
| Onboarding completion | `app_installed` → `card_added` | Planned |
| Repeat use | payments per user per 30 days | Planned |
| Settlement time p95 | `authorised_at` → `payout_confirmed_at` | Planned |
| Fraud / chargeback rate | risk flags + adjustments (chargebacks need a partner feed) | Partial |
