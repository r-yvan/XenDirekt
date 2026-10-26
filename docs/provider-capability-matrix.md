# Provider capability matrix

Status: Phase 0 baseline. Update a row only with written provider confirmation or recorded
sandbox evidence, and link the evidence.

Evidence reviewed: `reference-docs/XentriPay-API-Documentation-Collections-payouts-and-checkout-Version_-1.0.0.pdf`
(cited below as **XP §n**) and `reference-docs/XenDirekt_PRD_MVP_v1.0.pdf` (cited as **PRD §n**).
`reference-docs/refunds-v2.pdf` was also checked. It is a business-user details record and
documents no refund operation.

## Verdict

The documented XentriPay API **cannot run the PRD payment flow** (authorise card → pay out to
MoMo → capture card). Specifically:

1. **No card authorisation.** Card collections and checkout send the payer to a hosted page and
   report `SUCCESS` when "the business wallet has been credited" (XP §4.1). That is an
   immediate charge, so it must not stand in for an authorisation.
2. **No reusable card token.** Every card collection is a one-off hosted page (XP §4.3, §7.4).
3. **Every payout waits for a human.** "Payout requests require OTP confirmation… sent to
   the authorized business user" (XP §5.1). An unattended tourist payment cannot depend on this.
4. **No pre-payment name lookup.** `validatedAccountName` only comes back *after* a payout has
   been initiated (XP §5.2). Initiating a payout to read a name is prohibited.
5. **RWF only.** "Currently only RWF is supported" (XP §4.6, §5.5, §7.6). XentriPay cannot
   charge in the card's currency or quote FX.
6. **No webhooks, no refunds, no settlement file, no void.**

**Consequence in code.** `XentriPayProvider` implements only the documented payout initiation
and payout status calls, contract-tested against the documented payloads. Every other
operation raises `CAPABILITY_NOT_CONFIGURED`. Production startup refuses to run until every
critical capability below is marked approved, with evidence, in `PROVIDER_CAPABILITY_APPROVALS`.
`MockPaymentProvider` exists for local and test environments only; config validation rejects it
in production, and every simulated payment is stored and shown as simulated.

## Matrix

Legend: **Confirmed by provider** = written confirmation received. **Sandbox-tested** = test
evidence recorded in `docs/testing.md`. "Pending" means asked or to be asked; "No" means the
supplied documents show the capability is absent.

| # | Requirement | PRD source | Evidence in supplied docs | Confirmed by provider | Sandbox-tested | Implementation consequence | Owner | Decision deadline |
|---|---|---|---|---|---|---|---|---|
| 1 | Card tokenisation or hosted fields returning a reusable partner token; PAN/CVV never reach XenDirekt | FR-CRD-01, NFR-SEC-01, PRD §7 (1) | None. The card page is a per-transaction redirect to `urubutopay.rw` (XP §4.3, §7.4); no token is returned. | Pending | No | Card setup uses a provider "setup session" port. XentriPay raises `CAPABILITY_NOT_CONFIGURED`. The mock serves a dev-only hosted page with test cards and never accepts a PAN. | PM (partner) | Gate 1: partner signed |
| 2 | 3-D Secure initiation and result callback | FR-CRD-02, FR-EXE-02, NFR-RSK-01 | None. Whether the hosted card page runs 3DS is not stated. | Pending | No | `AUTH_PENDING` exposes a `THREE_DS` next action. XentriPay: not available. | PM | Gate 1 |
| 3 | Zero-amount or small reversible verification authorisation when a card is added | FR-CRD-02 | None | Pending | No | Card stays `PENDING_VERIFICATION` until the provider reports verification. | PM | Gate 1 |
| 4 | Separate card **authorise** | FR-EXE-02, PRD §6 | None. Collections credit the business wallet on `SUCCESS` (XP §4.1), i.e. they capture immediately. | No (documented flows capture) | No | Collections and checkout are **never** used as an authorisation. | PM | Gate 1 |
| 5 | Separate card **capture** after payout success | FR-EXE-02 | None | Pending | No | `CAPTURE_PENDING` and `CAPTURE_FAILED` states exist; XentriPay: not available. | PM | Gate 1 |
| 6 | Card **void** (release a hold) | FR-EXE-03, AC-4 | None | Pending | No | `VOID_PENDING` and `VOIDED` states exist; XentriPay: not available. | PM | Gate 1 |
| 7 | Trusted card metadata: issuing country, funding type (prepaid), BIN | FR-CRD-03 | None | Pending | No | Eligibility rules (no Rwandan-issued, no prepaid, blocked BINs) need provider metadata; client claims are never trusted. | PM | Gate 1 |
| 8 | Card fingerprint (same card across accounts) | NFR-RSK-03, FR-ADM-04 | None | Pending | No | The velocity rule "one card on many accounts" and card blocking depend on it; the rule is skipped and logged when absent. | PM | Gate 1 |
| 9 | Cardholder name and country for mismatch checks | NFR-RSK-04 | None | Pending | No | The mismatch rule only runs when the provider returns the data. | PM / Risk | Before pilot |
| 10 | Charge in card currency, or a provider FX quote | FR-QTE-02, PRD §4 (currency) | **Absent**: "Currently only RWF is supported" (XP §4.6, §5.5, §7.6) | No | No | With XentriPay the issuer would convert RWF, so the in-app card-currency total cannot be guaranteed. FX comes from a configured source that must be approved before launch. | PM / Finance | Gate 1 |
| 11 | MTN MoMo account-name lookup **before** any charge | FR-PAY-03, FR-PAY-04, AC-2 | **Absent as a lookup.** `validatedAccountName` only appears in the payout *initiation* response (XP §5.2). | Pending | No | Lookup raises `CAPABILITY_NOT_CONFIGURED`, so Pay stays blocked. A payout is never initiated just to read a name. | PM | Gate 1 |
| 12 | Payout to MTN MoMo **phone number**, unattended | FR-EXE-02, PRD §7 (4) | Documented: `POST /api/payment-requests`, `telecomProviderId` `63510`, local-format `msisdn` (XP §5.2, §6). **Blocker:** every payout waits for an OTP from an authorised business user (XP §5.1). | Pending (OTP waiver needed) | No | The adapter and status mapping are built and contract-tested; automated use stays disabled until OTP-free payouts are confirmed in writing. | PM | Gate 1 |
| 13 | Payout to MoMo Pay **merchant code** | FR-PAY-01, PRD §7 (4) | None | Pending | No | The merchant-code input is behind a feature flag that is off by default and cannot be turned on in production without this approval. | PM | Gate 1 |
| 14 | Payout status query | FR-EXE-04, FR-EXE-05 | Documented: `GET /api/payment-requests/check-status?customerRef=` returns the external provider status: `PENDING`, `COMPLETED`, `FAILED`, `REVERSED` (XP §5.3, §5.4). Unknown references, timestamp timezone and amount type (`"500.0"` as a string) are not specified. | Pending | No | Explicit, tested status mapping. Unrecognised statuses map to `UNKNOWN`, which routes to review. | Eng | Before sandbox tests |
| 15 | Idempotent payout on a client reference | FR-EXE-01, AC-5 | `customerReference` "must be unique per transaction" (XP §5.5). Behaviour on a duplicate submission is not documented. | Pending | No | A payout is never re-sent after an ambiguous outcome. The database allows at most one payout per payment, ever. | Eng / PM | Gate 1 |
| 16 | Signed webhooks for every status change, with replay guidance | NFR-SEC-06, FR-EXE-04, PRD §7 (5) | None. XentriPay updates collection status with its own internal scheduler (XP §4.1). | Pending | No | `POST /v1/webhooks/partner` rejects XentriPay events (`CAPABILITY_NOT_CONFIGURED`). Status comes from polling plus reconciliation. No signature scheme is invented. | PM | Gate 1 |
| 17 | Webhook source IP list | NFR-SEC-06 | None | Pending | No | Used as an extra signal only, once provided. | PM | Gate 1 |
| 18 | Refund of a captured card charge | FR-EXE-03, FR-ADM-03, AC-6 | None. `refunds-v2.pdf` is a business-user record, not a refund API. | Pending | No | The refund workflow (request, approve, audit) is built, but execution raises `CAPABILITY_NOT_CONFIGURED` and refunds go to manual operations. No refund URL is invented, and a payout is never labelled as a refund. | PM | Gate 1 |
| 19 | Payout reversal reporting | PRD §6 | Documented status `REVERSED` (XP §5.4) | Pending | No | Mapped to a `PAYOUT_REVERSAL` adjustment and an ops alert. | Eng | Before sandbox tests |
| 20 | Daily settlement / report file | FR-ADM-06, PRD §7 (7) | None | Pending | No | Reconciliation runs against the status API plus an uploaded CSV in a **provisional** format, which must be replaced with the real format. | PM / Finance | Gate 1 |
| 21 | Sandbox | PRD §7 (6), roadmap gate "Sandbox tests pass" | Test base URL `https://merchant.test.xentripay.com` (XP §2). No credentials, test numbers or scenario list supplied. | Pending | No | Sandbox contract tests are written but skipped until credentials exist. | PM | Gate 1 |
| 22 | Production certification steps | Roadmap gate 3 | None | Pending | No | Production refuses to start without capability approvals. | PM | Before pilot |
| 23 | API rate limits and timeouts | NFR-PER-01/02 | None | Pending | No | Conservative client timeouts (connect 3 s, response 10 s), bounded retries only where the request provably never reached the provider. | Eng | Before sandbox tests |
| 24 | Fee semantics: who bears `txnCharge`; does the merchant receive exactly `amount`? | FR-QTE-02, PRD §10.3 | Payout `amount` is "before charges"; `txnCharge` is returned (XP §5.2, §5.5). Collections use `chargesIncluded` (XP §4.6). No fee schedule. | Pending | No | Quotes keep the merchant amount, XenDirekt fee and provider cost separate. Placeholder fee config is flagged unapproved and blocked in production. | PM / Finance | Gate 1 |
| 25 | Funding model: payouts appear to draw on a XenDirekt business wallet at XentriPay, and card collections credit it (XP §4.1) | PRD §1 ("never holds a customer balance"), BNR rules | Implied by XP §4.1 and §5 | Pending | No | Legal must confirm that a prefunded partner wallet does not count as XenDirekt holding customer funds, and who bears the float. | Compliance / PM | Gate 1 |
| 26 | Tourist KYC (passport + selfie liveness) | FR-ONB-06 | None. `API-TEST-1-V23.pdf` covers **business** KYC for XenDirekt's own partner onboarding, not tourists. | Pending | No | KYC status fields exist; no passport or selfie is collected until a flow is approved. Over-limit payments return `LIMIT_EXCEEDED` with a KYC hint. | PM / Compliance | Before pilot |
| 27 | Sanctions and PEP screening | NFR-RSK-06 | None | Pending | No | Risk port with a "not configured" result; payments are not auto-approved on its basis. | Compliance | Before pilot |
| 28 | Partner risk score (to request 3DS) | NFR-RSK-01 | None | Pending | No | 3DS is required on every first payment per card, independent of any partner score. | PM | Gate 1 |
| 29 | Merchant SMS: sender, sender ID, duplicates | FR-RCP-01, PRD §10.3 | None | Pending | No | The SMS channel is a port that is "not configured" by default. A delivery failure never changes payment state. | PM | Before pilot |
| 30 | Card acceptance chain: who acquires (card page hosted by Urubuto Pay), merchant category, effect on tourist fees | PRD §10.2, §10.3 | Card page URLs point to `urubutopay.rw` (XP §4.3, §7.4) | Pending | No | Documented as a compliance and pricing question. | PM / Compliance | Gate 1 |

## Documented XentriPay operations and how XenDirekt treats them

| Operation (XP §) | Method and path | Used by XenDirekt? | Why |
|---|---|---|---|
| Initiate collection, MoMo (4.2) | `POST /api/collections/initiate` (`pmethod: momo`) | **No** | Pulls money *from* a MoMo wallet; XenDirekt pays *to* the merchant. Opposite direction. |
| Initiate collection, card (4.3) | `POST /api/collections/initiate` (`pmethod: cc`) | **No** | Immediate charge, not an authorisation; RWF only; no token. |
| Collection status (4.5) | `GET /api/collections/status/{reference}` | No (collections not used) | — |
| Initiate payout (5.2) | `POST /api/payment-requests` | Adapter built; **disabled** for automated use | Per-payout OTP approval by a business user (XP §5.1). |
| Payout status (5.3) | `GET /api/payment-requests/check-status?customerRef=` | Adapter built | Needed for reconciliation and status polling once payouts are approved. |
| Create checkout session (7.2) | `POST /api/checkout/sessions` | **No** | Same as card collection: immediate charge, RWF only. |
| Pay checkout session (7.3, 7.4) | `POST /api/checkout/sessions/{sessionId}/pay` | **No** | Same as above. |
| Checkout session status (7.5) | `GET /api/checkout/sessions/status/{refid}` | No | — |

Payout status normalisation (implemented in `api/src/modules/provider/xentripay/`):

| Provider value | Source | Internal payout status | Notes |
|---|---|---|---|
| `PENDING` | initiation and status | `PENDING` | Accepted, not settled. Never treated as success. |
| `COMPLETED` | status (external provider) | `SUCCEEDED` | "Provider has fully processed and finalized the payout" (XP §5.4). |
| `SUCCESSFUL` | XentriPay internal | `SUCCEEDED` | "XentriPay's internal confirmation that payout is finalized" (XP §5.4). |
| `FAILED` | both | `FAILED` | |
| `REVERSED` | both | `REVERSED` | Recorded as a payout reversal; ops alert. |
| anything else, missing or malformed | — | `UNKNOWN` | Never mapped to success; routes to review. |

`success: 1`, `retcode: 0` and HTTP 200 mean only that the request was accepted. None of them
are treated as proof that money moved.
