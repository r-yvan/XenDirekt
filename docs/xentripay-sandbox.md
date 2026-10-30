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
