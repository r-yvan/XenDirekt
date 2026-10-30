# Production readiness

**Verdict (2026-10-26): not ready.** The software is a complete, tested sandbox implementation.
Real money cannot and must not move until the blockers below are closed. The production startup
guards enforce this.

✅ = done and verified · ⬜ = not done · ⚠️ = done but with a stated caveat

## 1. Payment partner (blocks launch)

- ⬜ A partner confirmed in writing for card tokenisation via hosted fields, 3-D Secure,
  separate authorise/capture/void, refunds, and MTN name lookup (OQ-01, OQ-08, OQ-09, OQ-10, OQ-12).
- ⬜ Adapters for those capabilities, contract-tested against the partner sandbox (OQ-15).
- ⬜ Unattended payouts without per-payout OTP approval (OQ-13).
- ⬜ A webhook signature contract, or written PM acceptance of polling (OQ-11).
- ⬜ A settlement report format, with the CSV import adapted to it (OQ-14). Fee semantics and the
  funding model confirmed (OQ-16, OQ-17).
- ⬜ Evidence recorded for every capability in `PROVIDER_CAPABILITY_APPROVALS`.
- ✅ The capability gateway refuses unapproved capabilities, and the mock is refused in production.

## 2. Product and legal decisions

- ⬜ Fees, FX source and spread, rounding policy, and limits approved. Configuration activated
  with `approvalReference` (OQ-02, OQ-03, OQ-27, OQ-28; ADR 0006).
- ⬜ KYC policy (OQ-04), and sanctions/PEP screening through the partner.
- ⬜ Hosting region, DPA and retention periods under Law n° 058/2021 (OQ-05, OQ-26). Privacy
  notice covers the merchant SMS (OQ-32).
- ⬜ Kinyarwanda SMS copy reviewed by a native speaker (OQ-24).
- ⬜ Refund policy confirmed, including partial refunds (OQ-25).
- ⬜ `reference-docs/refunds-v2.pdf` (third-party personal data) removed or covered by consent (OQ-34).

## 3. Channels

- ⬜ SMS gateway and registered sender ID; merchant SMS sending (OQ-06, OQ-31).
- ⬜ Push (FCM/APNs) adapter and projects (OQ-31). Today only the port and token storage exist.
- ⬜ Transactional email domain with SPF/DKIM/DMARC.
- ⬜ Apple/Google sign-in client IDs, if wanted (OQ-29).

## 4. Security

- ✅ No PAN/CVV stored; leak test over every table and fixture; redaction in logs.
- ✅ OTP/PIN/refresh/step-up controls, maker-checker, append-only audit, rate limits.
- ✅ Dependency audit clean (`npm audit`: 0 known vulnerabilities after pinning `multer` 2.5.0
  through `overrides`).
- ⚠️ Secret scanning: gitleaks runs in CI. A manual scan here found nothing, but there is no git
  history yet.
- ⬜ Certificate pinning set chosen and enabled, with a rotation plan (OQ-35).
- ⬜ Root/jailbreak detection vendor (OQ-30).
- ⬜ External penetration test and threat-model review.
- ⬜ PCI DSS scope assessment with the partner. No SAQ claim is made.
- ⬜ Admin SSO, if required (OQ-36). Today: password + TOTP.
- ⬜ Admin endpoint to resolve a `SUBMITTED` refund with unknown outcome. Today it needs an
  audited engineering script (runbook).
- ⬜ Field-encryption key rotation tooling (re-encryption job).

## 5. Platform and operations

- ⬜ Environments created (staging, production) in the approved region; managed PostgreSQL with
  PITR; Redis; secret manager; TLS ingress with HSTS; webhook source-IP allowlist.
- ⬜ Backups configured, and the **restore drill performed** and timed (NFR-AVL-02).
- ⬜ Metrics scraping, log pipeline and the alert rules in `api/docs/alerts.md`; on-call rota.
- ⬜ Runbooks rehearsed (tabletop) with operations and the partner contact list filled in.
- ⬜ First admin created; roles assigned; two distinct `ADMIN`s for maker-checker.
- ✅ Health probes, graceful shutdown, separate worker role, idempotent migrations job, Docker image
  running as non-root.

## 6. Quality

- ✅ API: lint, typecheck, format, unit, contract, integration and e2e suites pass (see `testing.md`).
- ✅ Mobile: analyze, format, unit and widget tests pass; the live mobile ↔ API test passes.
- ⬜ Load test proving NFR-PER-01/02 (lookup p95 ≤ 3 s, quote p95 ≤ 1 s, overhead ≤ 300 ms).
- ⬜ Device QA on Android 9 and iOS 15 hardware, TalkBack/VoiceOver and font scaling (NFR-QA-02/03).
- ⬜ iOS build signed and run. Development so far had no iOS toolchain or Android SDK on this
  machine, so native builds are untested.
- ⬜ Admin web UI (deferred by the brief); operations must use the API until then.
- ⬜ Store listings, bundle IDs confirmed (OQ-33), privacy labels.

## 7. Go-live sequence (when the above is done)

1. Partner sandbox certification → evidence → `PROVIDER_CAPABILITY_APPROVALS` in staging.
2. Staging soak: a full scenario run against the partner sandbox, a reconciliation run, and a
   restore drill.
3. Production with low limits and an internal pilot, with daily reconciliation reviewed by finance.
4. Raise limits only after a clean reconciliation week.
