# Requirements traceability

Maps every requirement ID in `XenDirekt_PRD_MVP_v1.0.pdf` to its implementation, tests, status
and open decisions. Updated at the end of Phase 7 (2026-10-26).

**Status values:**

| Status | Meaning |
|---|---|
| `Done` | Implemented; automated tests pass |
| `Done (sandbox only)` | Works end to end with the mock provider; the real provider capability is missing, so it is **unverified with real money** |
| `Partial` | Part implemented; the gap is stated |
| `Blocked` | Needs a provider or PM/legal decision before it can work |
| `Descoped` | Excluded by the implementation brief |
| `Deferred` | Web UI phase |
| `Not verified` | Implemented, but the target cannot be checked by automated tests here |

Paths are relative to the repository root. `api/` is the NestJS backend; `android-ios/` is the
Flutter app (`lib/` omitted).

## 5.0 Three-tap rule

| ID | Requirement | Pri | Implementation | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|
| TAP-RULES | Opens on Pay; three tabs; one level of nesting; auto-advance; no confirmation screen; undo 5 s; hold-to-confirm only for delete account; biometrics on Pay; deep links | Must | `app/router/`, `features/payments/`, `features/cards/` (remove with undo), `core/widgets/hold_to_confirm_button.dart` | `router_redirect_test`, `sign_up_flow_test` | Partial: implemented; deep links are only the `xendirekt://payments/:id` notification links; no device usability test | — |
| TAP-LOG | `taps_to_complete` per flow | Must | `core/analytics/analytics.dart` (`taps`), pay screen; `api/src/modules/analytics` allowlist | analytics allowlist e2e | Partial: logged for the pay flow only | — |

## 5.1 Onboarding and account

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-ONB-01 | Splash < 2 s, one welcome screen | Must | — | `features/onboarding/` | widget (sign-up flow) | Done; launch time not measured on devices | — |
| FR-ONB-02 | Email/phone/Apple/Google; 6-digit OTP, 5 min, 5 attempts, autofill, auto-submit | Must | `modules/auth` | `features/authentication/` | unit, e2e `identity`, widget | Partial: email + international phone done; Apple/Google behind a disabled flag | OQ-29 |
| FR-ONB-03 | Name, country, DOB prefilled; Terms/Privacy accepted with Continue, timestamped | Must | `modules/users`, `modules/consents` | `features/profile/complete_profile_screen.dart` | e2e, widget | Done | — |
| FR-ONB-04 | PIN + biometrics in the same step | Must | `modules/auth` (PIN, device keys, step-up) | `features/authentication/` | unit, e2e, widget | Done (fixed 6-digit PIN) | OQ-21 |
| FR-ONB-05 | English and French, device default | Must | notification templates EN/FR | `app/localization/` | widget | Done | — |
| FR-ONB-06 | Partner KYC above limits | Must | `users.kyc_*` columns only | — | — | Blocked (no KYC provider) | OQ-04 |
| FR-ONB-07 | Delete account; keep what law requires | Must | `modules/users` (anonymise, revoke sessions/keys/push tokens) | profile hold-to-delete | e2e `identity` | Done; retention periods pending | OQ-26 |

## 5.2 Card management

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-CRD-01 | Hosted tokenisation; PAN never touches XenDirekt | Must | `modules/cards`, `modules/provider` | `features/cards/` + `core/web/` (WebView) | e2e, `pan-leak.e2e` | Done (sandbox only) | OQ-08 |
| FR-CRD-02 | 3DS + verification on add | Must | `modules/cards` | `features/cards/` | e2e | Done (sandbox only) | OQ-08, OQ-09 |
| FR-CRD-03 | Reject Rwandan-issued, prepaid gift, blocked BINs | Must | `modules/cards/domain/card-eligibility.ts`, `CARD_RULES` config | — | unit, e2e | Done (relies on partner metadata) | — |
| FR-CRD-04 | Brand, last 4, expiry; default; remove | Must | `modules/cards` | `features/cards/cards_section.dart` | e2e, fixtures | Done | — |
| FR-CRD-05 | Up to 3 cards | Must | row lock + count | — | e2e | Done | — |

## 5.3 Payee lookup

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-PAY-01 | Phone number or MoMo Pay merchant code | Must | `modules/payees` | `features/payee_lookup/` | unit, e2e | Partial: phone done; merchant code behind a disabled flag | OQ-10 |
| FR-PAY-02 | Network detection; user override | Must | `PAYEE_ROUTING` MTN prefixes | — | unit, e2e | Descoped in part: MTN only, **no override, no Airtel** (ADR 0008) | OQ-20 |
| FR-PAY-03 | Automatic name lookup; name shown before any charge | Must | `modules/payees` | pay controller (debounce, stale guard) | unit, e2e | Done (sandbox only) | OQ-10 |
| FR-PAY-04 | Failed/inactive lookup blocks payment | Must | `modules/payees` | pay screen | e2e (scenario 4) | Done | — |
| FR-PAY-05 | Recent payees | Should | `GET /v1/payees/recent` | pay screen chips | e2e | Done | — |
| FR-PAY-06 | Paste; strip spaces and country code | Should | `shared/phone` | pay screen | unit | Done | — |

## 5.4 Amount, quote and confirmation

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-QTE-01 | Whole RWF; configurable min/max | Must | `modules/quotes`, `LIMITS` | pay screen | unit, e2e | Done (placeholder limits) | OQ-03 |
| FR-QTE-02 | Quote: RWF, fee, FX, card total; 5 min | Must | `quote-calculator.ts` (integer, ceiling) | `features/quotes/` | unit, e2e | Done (placeholder fees/FX; rounding pending approval) | OQ-02, OQ-28 |
| FR-QTE-03 | Live summary on Pay; no confirm screen | Must | — | pay screen, `pay_controller.dart` | unit | Done | — |
| FR-QTE-04 | Optional 60-character note in merchant SMS | Should | payments (scrubbed), notification templates | pay screen | e2e | Partial: stored and templated; merchant SMS not sent | OQ-06 |
| FR-QTE-05 | One tap starts biometrics; Pay disabled in flight | Must | step-up | pay screen | widget, live | Done | — |

## 5.5 Payment execution

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-EXE-01 | Idempotency key; never charge twice | Must | unique `(user_id, idempotency_key)` | `PaymentAttempt` | e2e scenario 9 (concurrent), widget scenario 11 | Done | — |
| FR-EXE-02 | Authorise (3DS) → payout → capture | Must | `payment-orchestrator.ts`, outbox | progress screen | e2e scenarios 1–8 | Done (sandbox only) | OQ-09, OQ-13 |
| FR-EXE-03 | Payout fails → automatic void + message | Must | orchestrator | progress screen | e2e scenario 6, live | Done (sandbox only) | OQ-09 |
| FR-EXE-04 | Live status until final | Must | polling; webhooks trigger a re-poll | progress screen polling | e2e, widget | Done (polling); webhooks mock only | OQ-11 |
| FR-EXE-05 | No final state in 2 min → PENDING_REVIEW | Must | orchestrator + sweeper | in-review copy | e2e scenario 7b | Done (clock starts at authorisation) | OQ-22 |

## 5.6 Confirmations and receipts

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-RCP-01 | Merchant SMS EN + Kinyarwanda | Must | templates (RW draft, needs native review) | — | unit | Blocked (no SMS sender) | OQ-06, OQ-24 |
| FR-RCP-02 | Tourist SMS or push + email | Must | `modules/notifications` | inbox | e2e | Partial: email + in-app done; SMS/push not configured | OQ-31 |
| FR-RCP-03 | In-app receipt, Kigali time | Must | payment view | `features/receipts/` | e2e, fixtures | Done | — |
| FR-RCP-04 | Share/download as PDF or image | Should | — | `receipt_card.dart` | — | Partial: shared as text, not PDF/image | — |

## 5.7 History and support

| ID | Requirement | Pri | API | Mobile | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|---|
| FR-HIS-01 | History newest first; chips; filter | Must | cursor pagination | `features/history/` | e2e | Done | — |
| FR-HIS-02 | FAQ; report a problem with reference | Must | `modules/tickets` | `features/support/` | e2e | Done | — |
| FR-HIS-03 | Push for success, failure, refund | Must | notifications (transition listener) | inbox | e2e | Partial: in-app inbox; push not configured | OQ-31 |

## 5.8 Admin console

The web UI is deferred by the brief. The **backend APIs** are in scope and done.

| ID | Requirement | Pri | API | Tests | Status | Open decisions |
|---|---|---|---|---|---|---|
| FR-ADM-01 | Login (SSO or email + 2FA); four roles | Must | `modules/admin` | e2e `admin-identity` | Done (API, email + password + TOTP) / Deferred (UI) | OQ-36 |
| FR-ADM-02 | Search; full timeline | Must | `admin-payments.controller.ts` | e2e `operations` | Done (API) / Deferred (UI) | — |
| FR-ADM-03 | Review queue: approve, refund, block | Must | review actions, `modules/refunds`, `modules/risk` | e2e scenarios 12, 13, 15 | Done (API; refund execution capability-gated) / Deferred (UI) | OQ-12, OQ-25 |
| FR-ADM-04 | Block/unblock user, card, payee | Must | `admin-risk.controller.ts` | e2e | Done (API) / Deferred (UI) | — |
| FR-ADM-05 | Configure fees, limits, BINs without release | Must | `admin-config.controller.ts` | e2e | Done (API) / Deferred (UI) | — |
| FR-ADM-06 | Daily reconciliation report | Must | `modules/reconciliation` | unit, e2e | Done (status API); settlement file uses a **provisional** format / Deferred (UI) | OQ-14 |
| FR-ADM-07 | Dashboard metrics | Should | `GET /v1/admin/metrics/summary` | e2e | Done (API) / Deferred (UI) | — |
| FR-ADM-08 | Audit log of every admin action | Must | `modules/audit` (append-only) | e2e | Done | — |

## 8.1 Security and privacy

| ID | Requirement | Implementation | Tests | Status | Open decisions |
|---|---|---|---|---|---|
| NFR-SEC-01 | No PAN/CVV on servers or logs | hosted pages, token encryption, redaction, free-text scrubbing | `pan-leak.e2e`, redaction unit | Done (SAQ-A is a target, not a claim) | OQ-08 |
| NFR-SEC-02 | TLS 1.2+; certificate pinning | platform TLS; `CERT_PINS_PEM` | — | Partial: pinning implemented but off until certificates are chosen | OQ-35 |
| NFR-SEC-03 | Encryption at rest; secrets vault | AES-256-GCM field encryption; env from secret manager | unit | Partial: disk encryption and vault are platform tasks | OQ-05 |
| NFR-SEC-04 | 15-min access; device-bound refresh; lock after 5 min | `modules/auth`, `app_lock_observer.dart` | e2e, widget | Done | — |
| NFR-SEC-05 | Masking in logs and for viewers | redaction, admin masking | unit, e2e | Done | — |
| NFR-SEC-06 | Signed webhooks; replays ignored | `modules/webhooks` | e2e | Partial: mock scheme only; XentriPay has none; IP allowlist is an ingress task | OQ-11 |
| NFR-SEC-07 | Root/jailbreak detection; screenshot blocking | `core/security/screen_security.dart` | unit | Partial: FLAG_SECURE on payment/PIN screens (Android); no root detection | OQ-30 |
| NFR-SEC-08 | Law 058/2021 | consents, deletion, minimal analytics | e2e | Partial: needs legal review | OQ-05, OQ-26 |

## 8.2 Fraud and risk

| ID | Requirement | Implementation | Tests | Status | Open decisions |
|---|---|---|---|---|---|
| NFR-RSK-01 | 3DS on first payment per card and when asked | orchestrator | e2e scenario 1 and "skips 3DS once…" | Done (sandbox only) | OQ-09 |
| NFR-RSK-02 | Limits per payment/day/trip; configurable | `limits.service.ts`, `LIMITS` | unit, e2e | Done (placeholder values) | OQ-03, OQ-27 |
| NFR-RSK-03 | Velocity rules | `risk/domain/risk-rules.ts` | unit, e2e | Done | — |
| NFR-RSK-04 | Name/country mismatch blocks card | card eligibility | unit | Partial: only when the provider returns the data | — |
| NFR-RSK-05 | Device fingerprint; one active account per device | install ID, device hash, `CARDS_PER_DEVICE` | e2e | Partial: device is a risk signal, not hard-enforced | — |
| NFR-RSK-06 | Sanctions/PEP via partner | — | — | Blocked | OQ-01 |
| NFR-RSK-07 | Flagged payment held before payout | orchestrator + review actions | e2e scenario 12 | Done | — |

## 8.3 Performance, availability, quality

| ID | Requirement | Implementation | Status |
|---|---|---|---|
| NFR-PER-01 | Lookup p95 ≤ 3 s; quote p95 ≤ 1 s | histograms; 5 s lookup cap | Not verified (no load test, no real provider) |
| NFR-PER-02 | ≤ 300 ms overhead | HTTP vs provider histograms | Not verified |
| NFR-PER-03 | 3G; < 200 KB per payment | compact JSON, no images on payment screens | Not verified |
| NFR-AVL-01 | 99.5%; outage banner | health probes; `paymentsPaused` switch + app banner | Partial (no environment yet) |
| NFR-AVL-02 | Daily backups, 30 days, tested restore | `deployment.md` | Blocked (no environment; drill not done) |
| NFR-QA-01 | Tests for transitions, duplicate webhooks, timeouts | `api/test` | Done |
| NFR-QA-02 | Font scaling, contrast ≥ 4.5:1, labels | theme + contrast test, semantics | Partial: contrast tested; screen readers not tested on devices |
| NFR-QA-03 | Android 9+, iOS 15+ | `minSdk 28`, iOS 15.0 | Not verified on devices |

## 10.1 Analytics events (no personal data)

| ID | Events | Status |
|---|---|---|
| AN-01 | `app_installed`, `signup_started`, `signup_completed` | Done (queued until signed in) |
| AN-02 | `card_added`, `card_add_failed` | Done |
| AN-03 | `payee_lookup_succeeded` / `_failed` (with latency) | Done |
| AN-04 | `quote_shown`, `payment_confirmed` | Done |
| AN-05 | `payment_completed` / `payment_failed` / `payment_voided` | Done (server side) |
| AN-06 | `ticket_created` | Done |

## 10.5 MVP acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| AC-1 | Real MTN number (and merchant code) paid in partner production | Blocked (provider capabilities); Airtel descoped |
| AC-2 | Registered name before every payment; unknown blocks | Done (sandbox only) |
| AC-3 | Confirmations within 30 s | Blocked (SMS/push channels); email + in-app work |
| AC-4 | Forced payout failure releases hold; "You have not been charged" | Done (sandbox only; live test) |
| AC-5 | Same key never charges twice | Done |
| AC-6 | Admin finds, reviews, refunds, exports reconciliation | Done (API; refund execution needs capability) / Deferred (UI) |
| AC-7 | No card number in logs, DB, analytics | Done (`pan-leak.e2e`; logs covered by redaction tests) |

## Success metrics (PRD §2)

| Metric | Source | Status |
|---|---|---|
| Payment completion rate | `GET /v1/admin/metrics/summary` | Done |
| Median time to pay | metrics summary; `pay_screen_opened` → completion | Done |
| Onboarding completion | `app_installed` → `card_added` events | Done (events; no dashboard) |
| Repeat use | payments per user | Partial: query only |
| Settlement time p95 | metrics summary | Done |
| Fraud / chargeback rate | risk flags + adjustments | Partial: no chargeback feed |
