import { ProviderGateway } from '../../src/modules/provider/provider.gateway';
import { MockPaymentProvider } from '../../src/modules/provider/mock/mock-payment.provider';
import { PAYMENT_PROVIDER } from '../../src/modules/provider/domain/payment-provider';
import {
  MOCK_SIGNATURE_HEADER,
  signMockWebhook,
} from '../../src/modules/webhooks/mock-webhook-signature';
import { kigaliBusinessDate } from '../../src/shared/time/clock';
import { recordContract } from '../support/contracts';
import { createE2eApp, E2eApp } from '../support/e2e-app';
import {
  addCard,
  adminSession,
  completeThreeDs,
  createPayment,
  lookupPayee,
  onboardTourist,
  PaymentOptions,
  settle,
  SignedInTourist,
} from '../support/flows';
import { testEnv } from '../support/test-env';

type Admin = Awaited<ReturnType<typeof adminSession>>;

describe('operations: admin review, refunds, risk, reconciliation, webhooks (e2e)', () => {
  let e2e: E2eApp;
  let tourist: SignedInTourist;
  let mock: MockPaymentProvider;
  let admin: Admin;
  let secondAdmin: Admin;
  let analyst: Admin;
  let support: Admin;
  let viewer: Admin;

  beforeAll(async () => {
    e2e = await createE2eApp();
  });
  afterAll(async () => {
    await e2e.close();
  });
  beforeEach(async () => {
    await e2e.reset();
    mock = e2e.app.get(PAYMENT_PROVIDER);
    tourist = await onboardTourist(e2e);
    admin = await adminSession(e2e, 'ADMIN');
    secondAdmin = await adminSession(e2e, 'ADMIN', 'admin2@xendirekt.test');
    analyst = await adminSession(e2e, 'RISK_ANALYST');
    support = await adminSession(e2e, 'SUPPORT_AGENT');
    viewer = await adminSession(e2e, 'VIEWER');
  });

  /** Creates a payment, approves 3-D Secure when asked, and runs it to `until`. */
  async function pay(payer: SignedInTourist, options: PaymentOptions = {}, until?: string[]) {
    const { response } = await createPayment(e2e, payer, options);
    expect(response.status).toBe(201);
    const id = response.body.id as string;
    const pending = await settle(e2e, payer, id, {
      until: ['AUTH_PENDING', 'COMPLETED', 'VOIDED', 'PENDING_REVIEW', 'PAYOUT_PENDING'],
    });
    if (pending.state === 'AUTH_PENDING') {
      await e2e.dispatcher.drain();
      const action = (await e2e.http.get(`/v1/payments/${id}`).set(payer.auth)).body;
      if (action.nextAction?.url) {
        await completeThreeDs(e2e, action.nextAction.url, 'approve');
      }
    }
    return { id, body: await settle(e2e, payer, id, until ? { until } : {}) };
  }

  /** Moves to the next Kigali day; admin access tokens expire meanwhile, so sign in again. */
  let day = 0;
  async function nextDay() {
    e2e.clock.advance(86_400_000);
    day += 1;
    analyst = await adminSession(e2e, 'RISK_ANALYST', `analyst-d${day}@xendirekt.test`);
    viewer = await adminSession(e2e, 'VIEWER', `viewer-d${day}@xendirekt.test`);
  }

  const stateOf = async (paymentId: string) =>
    (
      await e2e.db
        .selectFrom('payments')
        .select('state')
        .where('id', '=', paymentId)
        .executeTakeFirstOrThrow()
    ).state;

  const adjustments = (paymentId: string) =>
    e2e.db
      .selectFrom('payment_adjustments')
      .select(['type', 'status'])
      .where('payment_id', '=', paymentId)
      .execute();

  it('scenario 13: refund (maker-checker), void and payout reversal are distinct records', async () => {
    const completed = await pay(tourist);
    expect(completed.body.state).toBe('COMPLETED');

    // Only a captured payment can be refunded; support may request, only a different Admin approves.
    const request = await e2e.http
      .post(`/v1/admin/payments/${completed.id}/refunds`)
      .set(admin.auth)
      .send({ reason: 'Seller agreed to refund the tourist', idempotencyKey: 'refund-key-0001' })
      .expect(201);
    recordContract('admin_refund_requested', request.body);
    expect(request.body).toMatchObject({
      type: 'REFUND',
      status: 'REQUESTED',
      reference: expect.stringMatching(/^RF-/),
    });
    const replay = await e2e.http
      .post(`/v1/admin/payments/${completed.id}/refunds`)
      .set(admin.auth)
      .send({ reason: 'Seller agreed to refund the tourist', idempotencyKey: 'refund-key-0001' })
      .expect(201);
    expect(replay.body.id).toBe(request.body.id);

    const self = await e2e.http
      .post(`/v1/admin/refunds/${request.body.id}/approve`)
      .set(admin.auth)
      .expect(403);
    expect(self.body.error.code).toBe('MAKER_CHECKER_VIOLATION');
    await e2e.http
      .post(`/v1/admin/refunds/${request.body.id}/approve`)
      .set(support.auth)
      .expect(403);
    const approved = await e2e.http
      .post(`/v1/admin/refunds/${request.body.id}/approve`)
      .set(secondAdmin.auth)
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');
    const refunded = await settle(e2e, tourist, completed.id, { until: ['REFUNDED'] });
    expect(refunded).toMatchObject({ state: 'REFUNDED' });

    // Payout fails → the hold is voided (no charge).
    const voided = await pay(tourist, { payee: '0788121111' });
    expect(voided.body).toMatchObject({ state: 'VOIDED', chargeStatus: 'NOT_CHARGED' });

    // Payout reported as reversed → a recorded reversal, never a silent state flip.
    const reversed = await pay(tourist, { payee: '0788124444' }, [
      'COMPLETED',
      'PENDING_REVIEW',
      'CAPTURE_FAILED',
    ]);
    expect(reversed.body.state).toBe('COMPLETED');
    // The reversal arrives after completion; the next status reconciliation records it.
    const businessDate = kigaliBusinessDate(e2e.clock.now());
    await nextDay();
    const run = await e2e.http
      .post('/v1/admin/reconciliation/runs')
      .set(analyst.auth)
      .send({ businessDate })
      .expect(201);
    expect(run.body.totals.REVERSAL).toBe(1);
    expect(await stateOf(reversed.id)).toBe('COMPLETED');

    expect(await adjustments(completed.id)).toEqual([{ type: 'REFUND', status: 'SUCCEEDED' }]);
    expect((await adjustments(voided.id)).map((row) => row.type)).toEqual(['VOID']);
    expect((await adjustments(reversed.id)).map((row) => row.type)).toContain('PAYOUT_REVERSAL');

    const audit = (
      await e2e.http
        .get('/v1/admin/audit-logs')
        .query({ entityId: request.body.id })
        .set(analyst.auth)
        .expect(200)
    ).body.entries;
    expect(audit.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining(['refund.requested', 'refund.approved']),
    );
  });

  it('an approved refund waits for manual handling when the refund capability is not configured', async () => {
    const completed = await pay(tourist);
    const gateway = e2e.app.get(ProviderGateway);
    const original = gateway.isUsable.bind(gateway);
    const spy = jest
      .spyOn(gateway, 'isUsable')
      .mockImplementation((capability) => capability !== 'CARD_REFUND' && original(capability));
    try {
      const request = await e2e.http
        .post(`/v1/admin/payments/${completed.id}/refunds`)
        .set(support.auth)
        .send({ reason: 'Duplicate purchase', idempotencyKey: 'refund-key-0002' })
        .expect(201);
      const approved = await e2e.http
        .post(`/v1/admin/refunds/${request.body.id}/approve`)
        .set(admin.auth)
        .expect(201);
      expect(approved.body.status).toBe('AWAITING_CAPABILITY');
      await e2e.dispatcher.drain();
      // Nothing was faked: the payment stays COMPLETED until operations record evidence.
      expect((await settle(e2e, tourist, completed.id, { rounds: 1 })).state).toBe('COMPLETED');
      await e2e.http
        .post(`/v1/admin/refunds/${request.body.id}/record-manual`)
        .set(admin.auth)
        .send({ providerReference: 'PARTNER-RF-778', note: 'Refunded in the partner portal' })
        .expect(201);
      expect((await settle(e2e, tourist, completed.id, { rounds: 1 })).state).toBe('REFUNDED');
    } finally {
      spy.mockRestore();
    }
  });

  it('scenario 15: prohibited admin actions are refused and nothing changes', async () => {
    const completed = await pay(tourist);
    await e2e.http.get('/v1/admin/payments').set(tourist.auth).expect(401);
    await e2e.http
      .post(`/v1/admin/payments/${completed.id}/actions`)
      .set(viewer.auth)
      .send({ action: 'RETRY_CAPTURE', reason: 'trying it out' })
      .expect(403);
    await e2e.http
      .post(`/v1/admin/payments/${completed.id}/refunds`)
      .set(viewer.auth)
      .send({ reason: 'not allowed', idempotencyKey: 'refund-key-0003' })
      .expect(403);
    await e2e.http
      .post('/v1/admin/config/FEES')
      .set(analyst.auth)
      .send({ value: {}, changeReason: 'not my job' })
      .expect(403);
    await e2e.http.get('/v1/admin/audit-logs').set(support.auth).expect(403);
    // An action that does not fit the payment's state is a conflict.
    const conflict = await e2e.http
      .post(`/v1/admin/payments/${completed.id}/actions`)
      .set(analyst.auth)
      .send({ action: 'APPROVE_RISK_HOLD', reason: 'looks fine to me' })
      .expect(409);
    expect(conflict.body.error.code).toBe('PAYMENT_STATE_CONFLICT');
    expect((await settle(e2e, tourist, completed.id, { rounds: 1 })).state).toBe('COMPLETED');
    expect(await adjustments(completed.id)).toEqual([]);
  });

  it('search masks personal data for viewers and shows the full timeline to support', async () => {
    const completed = await pay(tourist);
    const masked = await e2e.http
      .get('/v1/admin/payments')
      .query({ email: tourist.email })
      .set(viewer.auth)
      .expect(200);
    expect(JSON.stringify(masked.body)).not.toContain(tourist.email);
    const found = await e2e.http
      .get('/v1/admin/payments')
      .query({ momo: '0788123456' })
      .set(support.auth)
      .expect(200);
    expect(found.body.payments.map((payment: { id: string }) => payment.id)).toContain(
      completed.id,
    );
    const detail = await e2e.http
      .get(`/v1/admin/payments/${completed.id}`)
      .set(support.auth)
      .expect(200);
    recordContract('admin_payment_detail', detail.body);
    expect(JSON.stringify(detail.body)).not.toMatch(/\b\d{13,19}\b/);
    const metrics = await e2e.http.get('/v1/admin/metrics/summary').set(viewer.auth).expect(200);
    expect(metrics.body).toMatchObject({ completionRate: expect.any(Number) });
  });

  it('a risk-held payment proceeds to payout only after an analyst approves it', async () => {
    await createPayment(e2e, tourist);
    e2e.clock.advance(31_000);
    const other = await onboardTourist(e2e);
    const held = await pay(other, { cardKey: 'visa-home' }, ['PENDING_REVIEW']);
    expect(held.body.state).toBe('PENDING_REVIEW');
    const queue = await e2e.http.get('/v1/admin/review-queue').set(analyst.auth).expect(200);
    expect(JSON.stringify(queue.body)).toContain(held.id);
    expect(mock.payoutCount()).toBe(0);
    await e2e.http
      .post(`/v1/admin/payments/${held.id}/actions`)
      .set(analyst.auth)
      .send({ action: 'APPROVE_RISK_HOLD', reason: 'Card owner verified by phone' })
      .expect(201);
    expect((await settle(e2e, other, held.id)).state).toBe('COMPLETED');
    expect(mock.payoutCount()).toBe(1);
  });

  it('a rejected risk hold releases the card hold without paying out', async () => {
    await createPayment(e2e, tourist);
    e2e.clock.advance(31_000);
    const other = await onboardTourist(e2e);
    const held = await pay(other, { cardKey: 'visa-home' }, ['PENDING_REVIEW']);
    await e2e.http
      .post(`/v1/admin/payments/${held.id}/actions`)
      .set(analyst.auth)
      .send({ action: 'REJECT_AND_RELEASE', reason: 'Card reported stolen' })
      .expect(201);
    expect(await settle(e2e, other, held.id)).toMatchObject({
      state: 'VOIDED',
      chargeStatus: 'NOT_CHARGED',
    });
    expect(mock.payoutCount()).toBe(0);
  });

  it('blocking a tourist ends their sessions; unblocking restores access to sign in', async () => {
    await e2e.http
      .post('/v1/admin/blocks')
      .set(analyst.auth)
      .send({ entityType: 'USER', value: tourist.userId, reason: 'Chargeback fraud ring' })
      .expect(201);
    const denied = await e2e.http.get('/v1/me').set(tourist.auth);
    expect([401, 403]).toContain(denied.status);
    const blocks = await e2e.http.get('/v1/admin/blocks').set(analyst.auth).expect(200);
    expect(blocks.body.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'USER', value: tourist.userId }),
      ]),
    );
    await e2e.http
      .delete('/v1/admin/blocks')
      .set(analyst.auth)
      .send({ entityType: 'USER', value: tourist.userId, reason: 'Cleared after review' })
      .expect(204);
    const user = await e2e.db
      .selectFrom('users')
      .select('status')
      .where('id', '=', tourist.userId)
      .executeTakeFirstOrThrow();
    expect(user.status).toBe('ACTIVE');
  });

  describe('partner webhooks (mock signature scheme)', () => {
    const send = (body: object, options: { secret?: string; at?: number } = {}) => {
      const raw = JSON.stringify(body);
      const at = options.at ?? Math.floor(e2e.clock.nowMs() / 1000);
      return e2e.http
        .post('/v1/webhooks/partner')
        .set('Content-Type', 'application/json')
        .set(
          MOCK_SIGNATURE_HEADER,
          signMockWebhook(options.secret ?? testEnv().MOCK_WEBHOOK_SECRET!, raw, at),
        )
        .send(raw);
    };

    it('accepts a signed event once, ignores duplicates, and only triggers a status poll', async () => {
      const { response } = await createPayment(e2e, tourist, { payee: '0788122222' });
      const event = {
        id: 'evt_0001',
        type: 'payout.updated',
        data: { paymentReference: response.body.reference },
      };
      expect((await send(event).expect(200)).body).toEqual({ received: true, duplicate: false });
      expect((await send(event).expect(200)).body).toEqual({ received: true, duplicate: true });
      const stored = await e2e.db.selectFrom('inbound_provider_events').selectAll().execute();
      expect(stored).toHaveLength(1);
      // The payment was QUOTED (not awaiting a status): the callback changes nothing by itself.
      expect(stored[0]).toMatchObject({ signature_valid: true, outcome: 'IGNORED_NOT_IN_FLIGHT' });
    });

    it('rejects bad, stale and missing signatures without storing anything', async () => {
      const event = {
        id: 'evt_0002',
        type: 'payout.updated',
        data: { paymentReference: 'XD-AAAAAA' },
      };
      expect((await send(event, { secret: 'wrong-secret' }).expect(401)).body.error.code).toBe(
        'WEBHOOK_REJECTED',
      );
      await send(event, { at: Math.floor(e2e.clock.nowMs() / 1000) - 3600 }).expect(401);
      await e2e.http.post('/v1/webhooks/partner').send(event).expect(401);
      expect(await e2e.db.selectFrom('inbound_provider_events').selectAll().execute()).toEqual([]);
      // A genuine event with the same ID still goes through afterwards.
      expect((await send(event).expect(200)).body.duplicate).toBe(false);
    });
  });

  describe('reconciliation', () => {
    it('status reconciliation of a past business date matches every operation', async () => {
      const completed = await pay(tourist);
      const today = kigaliBusinessDate(e2e.clock.now());
      await e2e.http
        .post('/v1/admin/reconciliation/runs')
        .set(analyst.auth)
        .send({ businessDate: today })
        .expect(400);
      await nextDay();
      const run = await e2e.http
        .post('/v1/admin/reconciliation/runs')
        .set(analyst.auth)
        .send({ businessDate: today })
        .expect(201);
      expect(run.body.totals).toMatchObject({ total: 2, MATCHED: 2 });
      const items = await e2e.http
        .get(`/v1/admin/reconciliation/runs/${run.body.runId}/items`)
        .set(viewer.auth)
        .expect(200);
      expect(
        items.body.items.every((item: { paymentId: string }) => item.paymentId === completed.id),
      ).toBe(true);
    });

    it('a settlement file surfaces mismatches for operations and never corrects payments', async () => {
      const completed = await pay(tourist);
      const today = kigaliBusinessDate(e2e.clock.now());
      const ops = await e2e.db
        .selectFrom('provider_operations')
        .selectAll()
        .where('payment_id', '=', completed.id)
        .where('type', 'in', ['PAYOUT', 'CAPTURE'])
        .execute();
      const payout = ops.find((op) => op.type === 'PAYOUT')!;
      const capture = ops.find((op) => op.type === 'CAPTURE')!;
      const csv = [
        'client_reference,provider_reference,amount_minor,currency,status',
        `${payout.request_ref},P-1,${payout.amount_minor - 1n},RWF,SUCCEEDED`,
        `${capture.request_ref},P-2,${capture.amount_minor},${capture.currency.trim()},SUCCEEDED`,
        'UNKNOWN-REF-1,P-3,5000,RWF,SUCCEEDED',
      ].join('\n');
      await nextDay();
      const imported = await e2e.http
        .post('/v1/admin/reconciliation/settlement-files')
        .set(analyst.auth)
        .send({ businessDate: today, fileName: 'settlement.csv', content: csv })
        .expect(201);
      expect(imported.body.totals).toMatchObject({
        total: 3,
        MATCHED: 1,
        AMOUNT_MISMATCH: 1,
        MISSING_INTERNAL: 1,
      });
      await e2e.http
        .post('/v1/admin/reconciliation/settlement-files')
        .set(analyst.auth)
        .send({ businessDate: today, fileName: 'again.csv', content: csv })
        .expect(409);

      const open = await e2e.http
        .get(`/v1/admin/reconciliation/runs/${imported.body.runId}/items`)
        .query({ unresolved: 'true' })
        .set(analyst.auth)
        .expect(200);
      expect(open.body.items).toHaveLength(2);
      await e2e.http
        .patch(`/v1/admin/reconciliation/items/${open.body.items[0].id}`)
        .set(viewer.auth)
        .send({ status: 'RESOLVED', note: 'checked with partner' })
        .expect(403);
      await e2e.http
        .patch(`/v1/admin/reconciliation/items/${open.body.items[0].id}`)
        .set(analyst.auth)
        .send({ status: 'RESOLVED', note: 'Partner fee deducted; confirmed' })
        .expect(200);
      const csvExport = await e2e.http
        .get(`/v1/admin/reconciliation/runs/${imported.body.runId}/export.csv`)
        .set(viewer.auth)
        .expect(200);
      expect(csvExport.headers['content-type']).toContain('text/csv');
      expect(csvExport.text.split('\n')[0]).toContain('match_state');
      // No automatic correction: the payment is untouched.
      expect(await stateOf(completed.id)).toBe('COMPLETED');
    });
  });

  it('operations can pause new payments through configuration; the app sees a banner', async () => {
    const current = (await e2e.http.get('/v1/admin/config/LIMITS').set(viewer.auth).expect(200))
      .body.active.value;
    const draft = await e2e.http
      .post('/v1/admin/config/LIMITS')
      .set(admin.auth)
      .send({ value: { ...current, paymentsPaused: true }, changeReason: 'Partner outage' })
      .expect(201);
    await e2e.http
      .post(`/v1/admin/config/LIMITS/versions/${draft.body.version}/activate`)
      .set(analyst.auth)
      .send({})
      .expect(403);
    await e2e.http
      .post(`/v1/admin/config/LIMITS/versions/${draft.body.version}/activate`)
      .set(admin.auth)
      .send({})
      .expect(201);

    const config = await e2e.http.get('/v1/app-config').expect(200);
    recordContract('app_config_paused', config.body);
    expect(config.body.banner).toEqual({ kind: 'PAYMENTS_PAUSED' });
    const card = (await addCard(e2e, tourist)).body;
    const payee = (await lookupPayee(e2e, tourist).expect(200)).body;
    const refused = await e2e.http
      .post('/v1/quotes')
      .set(tourist.auth)
      .send({ payeeId: payee.payeeId, cardId: card.id, amountRwf: 5_000 })
      .expect(503);
    expect(refused.body.error.code).toBe('PAYMENTS_PAUSED');

    const actions = (
      await e2e.http
        .get('/v1/admin/audit-logs')
        .query({ actorId: admin.id })
        .set(admin.auth)
        .expect(200)
    ).body.entries.map((entry: { action: string }) => entry.action);
    expect(actions.some((action: string) => action.startsWith('config'))).toBe(true);
  });
});
