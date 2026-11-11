# Testing against XentriPay's sandbox

XenDirekt's XentriPay adapter implements the two operations XentriPay documents for paying a seller:

- payout to an MTN MoMo number: `POST /api/payment-requests`
- payout status: `GET /api/payment-requests/check-status`

This command runs that **real adapter** against XentriPay's **test** environment, so the money-out leg can be
verified before any real money moves.

## Setup

1. Get sandbox credentials from XentriPay: an API key for `https://merchant.test.xentripay.com`, and the MTN
   test numbers they support.
2. Put them in `api/.env`. That file is git-ignored; never commit keys.

   ```
   XENTRIPAY_BASE_URL=https://merchant.test.xentripay.com
   XENTRIPAY_API_KEY=<sandbox key>
   ```

## Commands

Run these from `api/`.

```bash
npm run xentripay:sandbox -- check
npm run xentripay:sandbox -- payout --msisdn 0788123456 --amount 100 --name "Test Seller"
npm run xentripay:sandbox -- status --ref XD-SBX-…
```

- **`check`** is read-only. It asks for the status of a reference that can't exist, which proves that the key
  works and the service is reachable.
- **`payout`** sends one payout of RWF 100–5000, then checks its status every 5 s for up to 2 minutes and shows
  XentriPay's raw status next to XenDirekt's mapping.
  - XentriPay documents that every payout waits for an OTP approval by a business user (XP §5.1). If the status
    stays pending, approve the payout in their dashboard.
  - Automated payouts in the app stay disabled until XentriPay confirms in writing that this approval can be
    waived (OQ-13).
- **`status`** re-checks a payout made earlier.

The tool refuses any base URL other than the test environment unless `--allow-live` is passed. Don't pass it
until production payouts are approved.

## Testing inside the app (hybrid mode)

`PAYMENT_PROVIDER=hybrid` runs the whole app flow with the steps XentriPay doesn't offer **simulated**:
adding cards, 3-D Secure, holding and capturing card money, and the name lookup. Payouts and payout status go
to **XentriPay's sandbox**. Every payment stays marked as sandbox, and production refuses this mode.

Uncomment the block at the end of `api/.env`, paste the test key, and restart the backend. A payment in the app
then sends a real sandbox payout to XentriPay.

- If XentriPay requires OTP approval, approve it in their dashboard.
- Until it's approved, the payment shows "being checked".
- After approval, the backend picks up the result on its next status check and completes the payment.

## What to record

Record the following and attach it to OQ-13, OQ-15 and OQ-19 in `docs/open-questions.md`:

- the status values XentriPay actually returns
- what happens for an unknown reference (status code and body)
- timestamps and their timezone
- how long OTP approval takes

Each confirmed capability then goes into `PROVIDER_CAPABILITY_APPROVALS` with that evidence.

## What this does not cover

XentriPay's documents don't describe any of the following, so they can't be tested with XentriPay today:

- charging a card: tokenisation, 3-D Secure, authorise / capture / void, refunds
- looking up the registered name of a MoMo account before paying

See `provider-capability-matrix.md`.

## Findings from the first sandbox run (2026-11-06)

- **API key:** accepted on `merchant.test.xentripay.com`.
- **Unknown reference on the status call:** returns HTTP **500** with `"Payment with customerReference not found"`,
  not 404. The adapter now maps exactly this message to `NOT_FOUND` (OQ-19).
- **Recipient name check:** payout initiation **validates the recipient name** against the MoMo account.
  - A wrong name returns 400 `Correct Registered name is : <name>`.
  - So XentriPay knows the registered name. Ask whether a proper name-lookup endpoint exists (OQ-10). Don't use
    failed payouts as a lookup.
  - Test number `0788123456` is registered as `444 3` in their sandbox.
- **Charge setting:** with the correct name, payout initiation returns 400 `Approved charge setting not found.`.
  The merchant account needs an approved payout charge/fee setting, which only XentriPay can configure.
- **Not reached yet:** no payout has been created. OTP approval and status transitions are still untested.

## Findings from the funded sandbox run (2026-11-10)

XentriPay confirmed that its sandbox moves **real money** on MoMo, and that the wallet is funded through
collections. Test only with authorised testers' own numbers and small amounts.

- **New key after account approval:** the earlier key started returning 401 once Merchant 284 was approved. A key
  generated afterwards in Developers → API Keys & Webhooks works.
- **Empty wallet:** a payout returns 400 `Insufficient wallet balance.`.
- **Funding (`collect`, XP §4.2):** `POST /api/collections/initiate` with `pmethod: momo` returned `success=1`,
  `retcode=0` and sent an MTN prompt to the payer.
  - The status (`GET /api/collections/status/{customerRef}`) stayed `PENDING` until the payer confirmed, then
    turned `SUCCESS` after about 50 s.
  - A rejected prompt ended as `FAILED`.
- **Payout:** 100 RWF to the tester's own number went `PENDING` → `COMPLETED` within about 10 s.
  - The adapter mapped it to `SUCCEEDED`.
  - **No OTP approval was asked for** on this sandbox payout, although the docs (XP §5.1) and XentriPay's email say
    payouts need one. Confirm with XentriPay whether this also holds in production (open question: payout approval).
- **Cards:** XentriPay says it supports Visa/Mastercard collections, including international cards and 3-D Secure,
  once the card channel is activated. Activation has been requested. Card collections charge immediately (no
  authorisation hold, no token), so they don't map to the authorise/capture model.
