# Source document review (Phase 0)

All five files exist under `/reference-docs/`. They were read, and are treated as read-only.

| File | What it actually is | How it is used |
|---|---|---|
| `XenDirekt_PRD_MVP_v1.0.pdf` (20 pages, dated Oct 18, 2026) | Primary product specification, including three diagrams: the payment state flow (p.10), the 9-component architecture (p.12) and the delivery roadmap with 4 gates (p.19). | Requirement IDs drive `requirements-traceability.md`. |
| `XentriPay-API-Documentation-Collections-payouts-and-checkout-Version_-1.0.0.pdf` (18 pages) | XentriPay collections, payouts and checkout API v1.0.0. | Only documented endpoints and fields are implemented. Gaps are listed in `provider-capability-matrix.md`. |
| `API-TEST-1-V23.pdf` (2 pages) | Business onboarding KYC document list (international and local business). | Used only for XenDirekt's **own** due diligence with a partner. Not a tourist onboarding flow. |
| `Api-test-1.pdf` | **Not a PDF.** A Microsoft Word (.docx) file with a `.pdf` extension. Content: "TERA APP Complete QA Test Suite v3.0" (groups, SACCOs, contributions, withdrawals, 3% fee). | Used only as inspiration for test categories (functional, regression, unit, integration, stress, security, boundary, UX, compatibility, E2E) and pass/fail status tracking. **No TERA business rules** (groups, SACCO, 3% fee, withdrawals) are imported. |
| `refunds-v2.pdf` (1 page) | A "Business User Details" record for a third-party company user. It contains **personal data** (name, email, phone, date of birth). | Establishes **no** refund API. Its personal data is not copied anywhere. Excluded from version control (OQ-34). |

## Conflicts found and how they are handled

| # | Conflict | Sources | Handling |
|---|---|---|---|
| C1 | Airtel Money is in the PRD (§1, §3, FR-PAY-02, AC-1) but out of scope in the implementation brief. | PRD vs brief | MTN only, no override (ADR 0008, OQ-20). |
| C2 | The admin console (internal web app, FR-ADM-01..08) is Must in the PRD; the brief defers all web UI. | PRD §5.8 vs brief §13 | Admin **APIs** with server-side RBAC and audit are built; web UI deferred. |
| C3 | The PRD flow needs authorise/capture/void, lookup, tokenisation and webhooks; XentriPay documents none of them, and its payouts need a manual OTP. | PRD §6–7 vs XentriPay | Capability boundary, real-money gate (ADR 0004). |
| C4 | Variable-length 4–6 digit PIN that "saves itself on the last digit". | PRD FR-ONB-04 | Fixed 6 digits (OQ-21). |
| C5 | "No final state after 2 minutes → PENDING_REVIEW" vs 3DS challenge duration. | PRD FR-EXE-05, §6 | 2-minute clock starts at `AUTHORISED`; separate 3DS timeout (OQ-22). |
| C6 | Typography "Inter or platform default" vs Satoshi fonts supplied in the repository. | PRD §9 vs repo | Satoshi (OQ-23). |
| C7 | PRD claims SAQ-A PCI scope (NFR-SEC-01); the brief forbids claiming scope reduction without assessor confirmation. | PRD vs brief | Documented as an unconfirmed **target** in `security.md`. |
| C8 | PRD languages table says "English" only; FR-ONB-05 says English + French; FR-RCP-01 needs a Kinyarwanda merchant SMS. | PRD §4 vs §5.1, §5.6 | App: EN + FR. Merchant SMS: EN + RW draft pending review (OQ-24). |
| C9 | PRD recommends Redis for idempotency keys; the brief says Redis alone is not enough. | PRD §7 vs brief §7 | Idempotency is a PostgreSQL unique constraint. |
| C10 | FR-CRD-01 mentions Apple Pay / Google Pay card autofill; the brief puts Apple Pay / Google Pay *as payment methods* out of scope. | PRD vs brief | Wallets are not payment methods. Autofill only where a partner SDK supports it (none confirmed). |
| C11 | PRD acceptance AC-6: "Admin can… refund it". No refund capability exists. | PRD vs XentriPay | Refund workflow built; execution gated (`CAPABILITY_NOT_CONFIGURED`). |
| C12 | Payouts debit a XenDirekt business wallet at the partner, while the PRD says XenDirekt never holds a customer balance. | XentriPay §4.1/§5 vs PRD §1 | Legal question (OQ-17). |
