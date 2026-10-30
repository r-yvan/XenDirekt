# Provider outage

**Signals:**

- `xd_provider_errors_total{kind="unreachable"|"unknown_outcome"}` rising.
- `xd_payment_oldest_state_age_seconds` above 10 minutes for in-flight states.
- `xd_outbox_jobs_total{outcome="dead"}` increasing.
- Tourists reporting slow payments.

**Impact:** new payments wait in `QUOTED`/`AUTH_PENDING`/`PAYOUT_PENDING`. Money is safe: the
worker retries only requests that were certainly not sent, and polls status for everything else.

## Immediately

1. Confirm it is the partner, not us:
   - `GET /health/ready` must be OK. It checks the database.
   - Look at `xd_provider_request_duration_seconds` by `operation`. Is it one operation or all?
2. Check the partner's status page or contact channel and open a ticket with them. Record the
   ticket ID.
3. If the outage will last more than 15 minutes, **pause new payments** rather than queueing
   them:
   - take the active `LIMITS` value from `GET /v1/admin/config/LIMITS`;
   - draft a copy with `"paymentsPaused": true` (`POST /v1/admin/config/LIMITS`);
   - an `ADMIN` activates it (`POST /v1/admin/config/LIMITS/versions/:v/activate`).

   New quotes and payments are then refused with `PAYMENTS_PAUSED` ("You have not been
   charged"), and `/v1/app-config` returns a `PAYMENTS_PAUSED` banner, which the app shows on
   its next start. Replays of payments already created still answer. Existing payments continue
   to be polled.

## While it lasts

- Do **not** restart workers in a loop. Jobs retry with backoff by themselves.
- Payments that pass 2 minutes after authorisation without a payout answer go to
  `PENDING_REVIEW` (`NO_FINAL_STATE_2MIN`). They are reconciled automatically when the partner
  recovers. Do not act on them during the outage.
- Dead jobs (`outbox_events.status = 'DEAD'`) are not lost. The payment sweeper re-enqueues the
  driving job of every in-flight payment every 30 seconds.

## After recovery

1. Watch `xd_payments_non_final` fall back to its normal level.
2. Re-activate the previous `LIMITS` version (without `paymentsPaused`).
3. Work the review queue: `GET /v1/admin/review-queue` (see [ambiguous-payout](ambiguous-payout.md)).
4. Run reconciliation for the affected business dates
   (`POST /v1/admin/reconciliation/runs`).
5. Write a short incident note: duration, payments affected, any tourist contacted.

## Platform outage (our side)

If `/health/ready` fails:

1. Check the database first: connections, disk, failover.
2. The API and worker are stateless and can be restarted safely. Redis loss only resets rate
   limits.
