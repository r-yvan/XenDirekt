# Open questions and decisions required

Nothing here has been decided silently. Where code needs a value to run, the **proposed default**
is used. Those defaults are flagged in configuration as unapproved, and production refuses to use
unapproved values where money or legal exposure is involved.

Owners: **PM** = XenDirekt product owner/PM · **Partner** = licensed payment provider ·
**Legal** = qualified Rwandan counsel / compliance · **Ops** = operations lead ·
**Eng** = engineering lead · **Design** = product designer.

## A. Open questions carried from the PRD (§10.3)

| ID | Question | Owner | Impact | Proposed default (what the code does now) | Evidence required to close |
|---|---|---|---|---|---|
| OQ-01 | Which licensed partner? Are all seven PRD §7 capabilities confirmed in writing? | PM, Partner | Blocks real-money launch. XentriPay's documents confirm none of tokenisation, authorise/capture/void, name lookup or webhooks (see `provider-capability-matrix.md`). | Mock provider in dev/test only. XentriPay adapter covers payout and payout status only; real-money mode disabled. | Signed contract, written capability confirmation per matrix row, sandbox evidence. |
| OQ-02 | Fee model: flat, percentage or both? Who pays the FX spread? | PM, Finance | Every quote. | Configurable `fixed + percentage (bps)` with min/max, rounded **up** to whole RWF; FX spread 0 bps. Seeded values are `DEV PLACEHOLDER` with `approved: false`; production quotes refuse unapproved fee config. | PM-approved fee schedule recorded as an approved configuration version. |
| OQ-03 | Starting limits per payment, per day and per trip. | PM, Partner | Fraud exposure, conversion. | Placeholder limits (dev only): min RWF 500, max RWF 200,000 per payment, RWF 500,000 per user per day, RWF 500,000 per card per day, RWF 1,000,000 per payee per day, RWF 2,000,000 per user per rolling 30 days ("trip"). Flagged unapproved. | Approved limits configuration version. |
| OQ-04 | Is KYC (passport + selfie) needed from the first payment, or only above a limit? | PM, Legal, Partner | Onboarding friction; regulatory exposure. | No identity documents collected. Over-limit payments return `LIMIT_EXCEEDED` with a KYC hint; the "Verify now" flow reports that verification is not yet available. | Approved KYC policy and the partner's KYC integration spec. |
| OQ-05 | Where may personal data be hosted under Law n° 058/2021? | Legal | Hosting region, deployment, contracts. | No hosting region is assumed. `docs/deployment.md` lists this as a release blocker. | Written legal opinion and, if required, registration with the regulator. |
| OQ-06 | Merchant SMS: sent by XenDirekt, the partner or both? Is the sender ID "XenDirekt" registered? | PM, Partner | FR-RCP-01; duplicate or confusing messages. | SMS channel is a port that is **not configured** by default; messages are recorded as `SUPPRESSED (CHANNEL_NOT_CONFIGURED)`. Payment state never depends on delivery. | Partner statement on its own SMS, sender ID registration, SMS gateway contract. |
| OQ-07 | Card-network merchant category; will issuers treat payments as cash advances or money transfers? | PM, Partner | Tourist fees, decline rates, chargebacks. | No assumption. Raised for partner discussion. | Partner MCC confirmation; pilot test with cards from 5+ countries (PRD §10.2). |

## B. Integration questions exposed by the XentriPay documentation

| ID | Question | Owner | Impact | Proposed default | Evidence required |
|---|---|---|---|---|---|
| OQ-08 | Can XentriPay tokenise cards for repeat use without exposing PAN/CVV to XenDirekt? | Partner | FR-CRD-01; PCI scope. | Card setup raises `CAPABILITY_NOT_CONFIGURED` with XentriPay. | Tokenisation SDK or hosted-fields spec plus sandbox token test. |
| OQ-09 | Can it authorise, capture and void separately? | Partner | Core flow FR-EXE-02/03. The documented card collection captures immediately. | Never use collections as an authorisation. | API spec for auth/capture/void and their status lifecycle. |
| OQ-10 | Can it look up MTN MoMo account names before payment, and pay MoMo Pay merchant codes? | Partner | FR-PAY-03 (Must), FR-PAY-01. | Lookup disabled with XentriPay, so Pay stays blocked. Merchant codes behind a disabled feature flag. | Lookup endpoint spec and sandbox numbers; merchant-code payout spec. |
| OQ-11 | Are signed webhooks supported? What is the exact signature and replay contract? | Partner | NFR-SEC-06; latency of status updates. | Webhook endpoint rejects XentriPay events. Polling + reconciliation. | Signature algorithm, header names, timestamp tolerance, source IPs, event catalogue. |
| OQ-12 | How are card refunds performed and reconciled? | Partner | FR-EXE-03, FR-ADM-03, AC-6. | Refund workflow recorded; execution raises `CAPABILITY_NOT_CONFIGURED`; manual ops process. | Refund API spec, permissions, limits, status lifecycle, settlement evidence. |
| OQ-13 | Can the per-payout OTP approval be waived for approved automated merchant payouts? | Partner | **Blocks** unattended payouts (XP §5.1). | Automated payout disabled with XentriPay. | Written waiver/config change plus sandbox proof that payouts process without OTP. |
| OQ-14 | How are payout results correlated with card authorisation/capture and the settlement files? | Partner, Finance | Reconciliation (FR-ADM-06). | Correlation by `customerReference` = XenDirekt operation reference; provisional CSV format for uploads. | Settlement file spec with sample file. |
| OQ-15 | What are the sandbox credentials, supported test scenarios, rate limits and production certification steps? | Partner | Testing and go-live gates. | Sandbox contract tests written but skipped without credentials. | Credentials (kept in a secret manager), scenario list, certification checklist. |
| OQ-16 | Payout fee semantics: does the merchant receive exactly `amount`, with `txnCharge` taken from the XenDirekt wallet? | Partner, Finance | "Merchant receives RWF X" promise in the quote and SMS. | Quote stores merchant amount, XenDirekt fee and provider cost separately. | Partner confirmation plus sandbox evidence. |
| OQ-17 | Funding model: payouts draw on a XenDirekt business wallet at the partner. Does that conflict with "XenDirekt never holds customer funds", and who funds the float? | Legal, Partner | Licensing (BNR), cash management. | No assumption; flagged as a launch blocker. | Legal opinion; partner settlement and float terms. |
| OQ-18 | Timestamp timezone in status responses (for example `2025-09-25T23:57:50.672947` has no offset). | Partner | Reconciliation date matching. | Provider timestamps are stored as received text and never used for business logic; XenDirekt uses its own UTC timestamps. | Partner confirmation. |
| OQ-19 | What does payout status return for an unknown `customerRef`? | Partner | Recovery after a timeout. | "Not found" is treated as **ambiguous** (review), never as "safe to resend". | Partner confirmation plus sandbox test. |

## C. Questions raised while turning the PRD into an implementation

| ID | Question | Owner | Impact | Proposed default | Evidence required |
|---|---|---|---|---|---|
| OQ-20 | The PRD lists MTN **and** Airtel (FR-PAY-02, AC-1); the implementation brief restricts v1.0 to MTN only, with no manual override. | PM | Scope and acceptance criteria. | **MTN only.** Non-MTN numbers get `NETWORK_NOT_SUPPORTED`. No network toggle or override. FR-PAY-02 and AC-1 are partially descoped. | PM confirmation that the brief supersedes the PRD on this point. |
| OQ-21 | FR-ONB-04 asks for a "4–6 digit PIN that saves itself on the last digit". A variable-length PIN cannot know which digit is last. | PM, Design | Onboarding UX. | **Fixed 6-digit PIN** (within the allowed range, strongest option, supports auto-advance). | PM / Design sign-off. |
| OQ-22 | FR-EXE-05 says *any* payment without a final state after 2 minutes goes to `PENDING_REVIEW`, but a 3-D Secure challenge can legitimately take longer. | PM | Review volume; user experience. | The 2-minute clock starts at `AUTHORISED` (server-controlled processing). `AUTH_PENDING` has its own 3DS timeout (default 5 minutes) that ends in `AUTH_FAILED` once the provider confirms no hold exists; if it cannot confirm, the payment goes to `PENDING_REVIEW`. | PM sign-off. |
| OQ-23 | Typography: the PRD says "Inter or the platform default"; the repository supplied Satoshi font files. | Design | Brand. | **Satoshi** (assumed to be a deliberate brand choice because it was supplied). | Design confirmation and font licence check (Fontshare/ITF free licence). |
| OQ-24 | Kinyarwanda merchant SMS text (FR-RCP-01). | PM | Merchant trust. | A draft Kinyarwanda template is included and marked **requires native-speaker review**. | Approved copy. |
| OQ-25 | Refund approval policy. | PM, Ops | Fraud and insider risk. | **Maker-checker:** one admin requests, a *different* Admin approves; self-approval is rejected. | PM / Ops sign-off. |
| OQ-26 | Retention periods for transaction, audit and KYC records after account deletion. | Legal | FR-ONB-07, NFR-SEC-08. | Deleting an account revokes sessions and anonymises profile data immediately. Payment, audit and reconciliation records are retained, linked only to the anonymised user ID, until counsel confirms the period. | Written retention schedule. |
| OQ-27 | Definition of a "trip" for per-trip limits. | PM | Limits. | Rolling 30 days. | PM decision. |
| OQ-28 | Card currency when the provider does not return the card's billing currency. | PM, Partner | FX display accuracy. | Charge currency **USD** (PRD §4: "card currency (or USD)"). | Partner capability or PM decision. |
| OQ-29 | Apple and Google sign-in client IDs; Apple developer account. | PM, Eng | FR-ONB-02. | Email and international-phone OTP implemented. Apple/Google sign-in hidden unless configured (server verification is behind a feature flag). | Client IDs, bundle/package IDs, Apple Services ID. |
| OQ-30 | Device integrity (root/jailbreak detection) product choice. | PM, Security | NFR-SEC-07. | Screenshot blocking on Android payment screens (FLAG_SECURE) and an app-switcher privacy cover on iOS. Root/jailbreak detection is an interface with no vendor chosen. | Vendor decision (e.g. RASP SDK) and false-positive policy. |
| OQ-31 | Push (FCM/APNs) project, transactional email domain, SMS gateway. | Eng, PM | FR-HIS-03, FR-RCP-02. | In-app inbox always works. Push, SMS and email are ports; email uses SMTP (Mailpit locally). | Firebase/APNs credentials; SPF/DKIM domain; SMS contract. |
| OQ-32 | Merchant SMS includes the tourist's **first name**: privacy-notice coverage. | Legal | NFR-SEC-08. | Template uses first name only; the privacy notice must disclose it. | Legal review of the privacy notice. |
| OQ-33 | Application and bundle identifier. | PM | Store listing (hard to change after release). | `com.xendirekt` for Android and iOS. | PM confirmation before the first store submission. |
| OQ-34 | `reference-docs/refunds-v2.pdf` contains a real person's name, email, phone and date of birth. Should it stay in the repository? | PM, Legal | Data protection (Law n° 058/2021). | File left untouched (read-only) but excluded from version control via `.gitignore`. | PM/Legal decision. |
| OQ-35 | The PRD asks for certificate pinning (NFR-SEC-02). Which certificates are pinned, and what is the rotation plan? | Eng, Ops | Outage risk when certificates rotate. | Pinning implemented but driven by configuration; disabled for local development. | Pin set plus a backup pin and rotation runbook. |
| OQ-36 | Admin console login: SSO provider or email + TOTP? | PM, Ops | FR-ADM-01. | Email + password + TOTP for admin API accounts; SSO can be added later. | Decision. |

## D. Decision log (closed items)

| Date | ID | Decision | Decided by | Evidence |
|---|---|---|---|---|
| — | — | No decisions closed yet. | — | — |
