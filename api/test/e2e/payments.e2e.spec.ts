import { sql } from 'kysely';
import { MockPaymentProvider } from '../../src/modules/provider/mock/mock-payment.provider';
import { PAYMENT_PROVIDER } from '../../src/modules/provider/domain/payment-provider';
import { createE2eApp, E2eApp } from '../support/e2e-app';
import { recordContract } from '../support/contracts';
import {
  addCard,
  completeThreeDs,
  createPayment,
  onboardTourist,
  settle,
  SignedInTourist,
  stepUpWithPin,
} from '../support/flows';

describe('payment orchestration (e2e, mock provider)', () => {
  let e2e: E2eApp;
  let tourist: SignedInTourist;
  let mock: MockPaymentProvider;

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
  });

  const operations = (paymentId: string) =>
    e2e.db
      .selectFrom('provider_operations')
      .selectAll()
      .where('payment_id', '=', paymentId)
      .orderBy('created_at')
      .execute();
  const timeline = async (paymentId: string) =>
    (
      await e2e.db
        .selectFrom('payment_events')
        .select(['from_state', 'to_state'])
        .where('payment_id', '=', paymentId)
        .orderBy('created_at')
        .execute()
    )
      .filter((event) => event.to_state)
      .map((event) => event.to_state);

  it('scenario 1: 3-D Secure on the first payment, payout, confirmation, capture, receipt', async () => {
    const { response, quote } = await createPayment(e2e, tourist);
    expect(response.status).toBe(201);
    recordContract('payment_created', response.body);
    expect(response.body).toMatchObject({
      state: 'QUOTED',
      status: 'PROCESSING',
      chargeStatus: 'NOT_CHARGED',
      reference: expect.stringMatching(/^XD-[A-Z2-9]{6}$/),
    });
    expect(response.body.totalCardMinor).toBe(quote.totalCardMinor);

    const challenged = await settle(e2e, tourist, response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (await e2e.http.get(`/v1/payments/${response.body.id}`).set(tourist.auth)).body;
    recordContract('payment_three_ds_required', action);
    expect(challenged.state).toBe('AUTH_PENDING');
    expect(action).toMatchObject({
      status: 'ACTION_REQUIRED',
      nextAction: { type: 'THREE_DS', returnUrlPrefix: 'xendirekt-app://3ds/return' },
    });

    const redirect = await completeThreeDs(e2e, action.nextAction.url, 'approve');
    expect(String(redirect.headers.location)).toContain(`paymentId=${response.body.id}`);
    const done = await settle(e2e, tourist, response.body.id);
    recordContract('payment_completed', done);
    expect(done).toMatchObject({
      state: 'COMPLETED',
      status: 'COMPLETED',
      chargeStatus: 'CHARGED',
      steps: { processing: true, sent: true, received: true },
    });
    expect(done.receipt).toMatchObject({
      reference: response.body.reference,
      amountRwf: 12_000,
      feeRwf: 380,
      card: 'VISA •••• 4242',
      simulated: true,
    });
    expect(String((done.receipt as { kigaliDateTime: string }).kigaliDateTime)).toMatch(/\+02:00$/);

    expect(await timeline(response.body.id)).toEqual([
      'QUOTED',
      'AUTH_PENDING',
      'AUTHORISED',
      'PAYOUT_PENDING',
      'CAPTURE_PENDING',
      'COMPLETED',
    ]);
    expect((await operations(response.body.id)).map((op) => [op.type, op.status])).toEqual([
      ['AUTHORISATION', 'SUCCEEDED'],
      ['PAYOUT', 'SUCCEEDED'],
      ['CAPTURE', 'SUCCEEDED'],
    ]);
    expect(mock.payoutCount()).toBe(1);
  });

  it('skips 3-D Secure once a card has completed a payment', async () => {
    const first = await createPayment(e2e, tourist);
    await settle(e2e, tourist, first.response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (await e2e.http.get(`/v1/payments/${first.response.body.id}`).set(tourist.auth))
      .body;
    await completeThreeDs(e2e, action.nextAction.url, 'approve');
    await settle(e2e, tourist, first.response.body.id);

    const second = await createPayment(e2e, tourist, { card: first.card });
    const done = await settle(e2e, tourist, second.response.body.id);
    expect(done.state).toBe('COMPLETED');
    expect(await timeline(second.response.body.id)).not.toContain('PENDING_REVIEW');
  });

  it('scenario 2: card declined ends the payment, not charged', async () => {
    const { response } = await createPayment(e2e, tourist, { cardKey: 'visa-decline' });
    const done = await settle(e2e, tourist, response.body.id);
    recordContract('payment_declined', done);
    expect(done).toMatchObject({
      state: 'AUTH_FAILED',
      status: 'FAILED',
      chargeStatus: 'NOT_CHARGED',
      failureReason: 'CARD_DECLINED',
    });
    expect(mock.payoutCount()).toBe(0);
  });

  it('scenario 3: 3-D Secure declined, and abandoned until timeout, both end without a charge', async () => {
    const declined = await createPayment(e2e, tourist);
    await settle(e2e, tourist, declined.response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (
      await e2e.http.get(`/v1/payments/${declined.response.body.id}`).set(tourist.auth)
    ).body;
    await completeThreeDs(e2e, action.nextAction.url, 'decline');
    expect(await settle(e2e, tourist, declined.response.body.id)).toMatchObject({
      state: 'AUTH_FAILED',
      failureReason: 'THREE_DS_FAILED',
    });

    e2e.clock.advance(31_000);
    const abandoned = await createPayment(e2e, tourist, { cardKey: 'visa-3ds' });
    await settle(e2e, tourist, abandoned.response.body.id, { until: ['AUTH_PENDING'] });
    const done = await settle(e2e, tourist, abandoned.response.body.id, {
      stepMs: 60_000,
      rounds: 10,
    });
    expect(done).toMatchObject({
      state: 'AUTH_FAILED',
      chargeStatus: 'NOT_CHARGED',
      failureReason: 'THREE_DS_ABANDONED',
    });
    expect(await timeline(abandoned.response.body.id)).toEqual([
      'QUOTED',
      'AUTH_PENDING',
      'VOID_PENDING',
      'AUTH_FAILED',
    ]);
    expect(mock.payoutCount()).toBe(0);
  });

  it('scenario 5: an expired quote cannot be paid', async () => {
    const card = (await addCard(e2e, tourist)).body;
    const payee = (
      await e2e.http
        .post('/v1/payees/lookup')
        .set(tourist.auth)
        .send({ identifierType: 'PHONE', identifier: '0788123456' })
    ).body;
    const quote = (
      await e2e.http
        .post('/v1/quotes')
        .set(tourist.auth)
        .send({ payeeId: payee.payeeId, cardId: card.id, amountRwf: 5_000 })
    ).body;
    e2e.clock.advance(5 * 60_000 + 1);
    const stepUp = await stepUpWithPin(e2e, tourist, 'PAYMENT');
    const response = await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'expired-quote-key')
      .set('X-Step-Up-Token', stepUp)
      .send({ quoteId: quote.quoteId })
      .expect(409);
    expect(response.body.error.code).toBe('QUOTE_EXPIRED');
  });

  async function payWithoutThreeDs(options: Parameters<typeof createPayment>[2]) {
    // Pre-complete one payment so later payments on this card skip 3-D Secure.
    const warmUp = await createPayment(e2e, tourist, { cardKey: options?.cardKey });
    await settle(e2e, tourist, warmUp.response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (await e2e.http.get(`/v1/payments/${warmUp.response.body.id}`).set(tourist.auth))
      .body;
    await completeThreeDs(e2e, action.nextAction.url, 'approve');
    await settle(e2e, tourist, warmUp.response.body.id, { until: ['COMPLETED', 'CAPTURE_FAILED'] });
    return createPayment(e2e, tourist, { ...options, card: warmUp.card });
  }

  it('scenario 6: payout failure releases the hold; the user was not charged', async () => {
    const { response } = await payWithoutThreeDs({ payee: '0788121111' });
    const done = await settle(e2e, tourist, response.body.id);
    recordContract('payment_payout_failed_voided', done);
    expect(done).toMatchObject({
      state: 'VOIDED',
      status: 'FAILED',
      chargeStatus: 'NOT_CHARGED',
      failureReason: 'PAYOUT_FAILED',
    });
    expect(await timeline(response.body.id)).toEqual([
      'QUOTED',
      'AUTH_PENDING',
      'AUTHORISED',
      'PAYOUT_PENDING',
      'PAYOUT_FAILED',
      'VOID_PENDING',
      'VOIDED',
    ]);
    const adjustments = await e2e.db
      .selectFrom('payment_adjustments')
      .selectAll()
      .where('payment_id', '=', response.body.id)
      .execute();
    expect(adjustments.map((row) => [row.type, row.status])).toEqual([['VOID', 'SUCCEEDED']]);
  });

  it('scenario 7a: payout times out with unknown outcome; status reconciliation finishes it with no second payout', async () => {
    const { response } = await payWithoutThreeDs({ payee: '0788123333' });
    const before = mock.payoutCount();
    const done = await settle(e2e, tourist, response.body.id);
    expect(done.state).toBe('COMPLETED');
    expect(mock.payoutCount()).toBe(before + 1);
    const payouts = (await operations(response.body.id)).filter((op) => op.type === 'PAYOUT');
    expect(payouts).toHaveLength(1);
  });

  it('scenario 7b: no final payout answer within 2 minutes → PENDING_REVIEW, still exactly one payout', async () => {
    const { response } = await payWithoutThreeDs({ payee: '0788122222' });
    const before = mock.payoutCount();
    const review = await settle(e2e, tourist, response.body.id, {
      until: ['PENDING_REVIEW'],
      stepMs: 10_000,
      rounds: 30,
    });
    recordContract('payment_pending_review', review);
    expect(review).toMatchObject({
      state: 'PENDING_REVIEW',
      status: 'IN_REVIEW',
      chargeStatus: 'UNKNOWN',
    });
    const row = await e2e.db
      .selectFrom('payments')
      .select(['review_reason', 'authorised_at', 'review_at'])
      .where('id', '=', response.body.id)
      .executeTakeFirstOrThrow();
    expect(row.review_reason).toBe('NO_FINAL_STATE_2MIN');
    expect(row.review_at!.getTime() - row.authorised_at!.getTime()).toBeGreaterThan(120_000);
    // Background reconciliation keeps checking, never re-sending.
    await settle(e2e, tourist, response.body.id, {
      until: ['COMPLETED'],
      stepMs: 120_000,
      rounds: 5,
    });
    expect(mock.payoutCount()).toBe(before + 1);
  });

  it('scenario 8: payout succeeded but capture failed → CAPTURE_FAILED, never a second payout', async () => {
    const { response } = await createPayment(e2e, tourist, { cardKey: 'visa-capture-fails' });
    await settle(e2e, tourist, response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (await e2e.http.get(`/v1/payments/${response.body.id}`).set(tourist.auth)).body;
    await completeThreeDs(e2e, action.nextAction.url, 'approve');
    const done = await settle(e2e, tourist, response.body.id, { until: ['CAPTURE_FAILED'] });
    expect(done).toMatchObject({ state: 'CAPTURE_FAILED', status: 'IN_REVIEW' });
    // Keep the worker running for a while: nothing may ever pay out again.
    await settle(e2e, tourist, response.body.id, { rounds: 5, stepMs: 60_000 });
    expect(mock.payoutCount()).toBe(1);
    expect((await operations(response.body.id)).filter((op) => op.type === 'PAYOUT')).toHaveLength(
      1,
    );
    const audit = await e2e.db
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_id', '=', response.body.id)
      .execute();
    expect(audit.map((row) => row.action)).toContain('payment.capture_failed');
  });

  it('scenario 9: the same Idempotency-Key never creates a second charge, even concurrently', async () => {
    const card = (await addCard(e2e, tourist)).body;
    const payee = (
      await e2e.http
        .post('/v1/payees/lookup')
        .set(tourist.auth)
        .send({ identifierType: 'PHONE', identifier: '0788123456' })
    ).body;
    const quote = (
      await e2e.http
        .post('/v1/quotes')
        .set(tourist.auth)
        .send({ payeeId: payee.payeeId, cardId: card.id, amountRwf: 7_000 })
    ).body;
    const tokens = await Promise.all([
      stepUpWithPin(e2e, tourist, 'PAYMENT'),
      stepUpWithPin(e2e, tourist, 'PAYMENT'),
      stepUpWithPin(e2e, tourist, 'PAYMENT'),
    ]);
    const send = (token: string, body: Record<string, unknown> = { quoteId: quote.quoteId }) =>
      e2e.http
        .post('/v1/payments')
        .set(tourist.auth)
        .set('Idempotency-Key', 'same-key-123456')
        .set('X-Step-Up-Token', token)
        .send(body);

    const responses = await Promise.all(tokens.map((token) => send(token)));
    const ids = new Set(responses.map((response) => response.body.id));
    expect(ids.size).toBe(1);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 200, 201]);

    // Replay after a lost response: no step-up needed, same payment, no new charge.
    const replay = await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'same-key-123456')
      .send({ quoteId: quote.quoteId })
      .expect(200);
    expect(replay.body.id).toBe([...ids][0]);

    const conflict = await send(await stepUpWithPin(e2e, tourist, 'PAYMENT'), {
      quoteId: quote.quoteId,
      note: 'different',
    }).expect(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const count = await e2e.db
      .selectFrom('payments')
      .select(sql<string>`count(*)`.as('count'))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(1);
  });

  it('requires a fresh, single-use step-up for every new payment', async () => {
    const card = (await addCard(e2e, tourist)).body;
    const payee = (
      await e2e.http
        .post('/v1/payees/lookup')
        .set(tourist.auth)
        .send({ identifierType: 'PHONE', identifier: '0788123456' })
    ).body;
    const quoteFor = async () =>
      (
        await e2e.http
          .post('/v1/quotes')
          .set(tourist.auth)
          .send({ payeeId: payee.payeeId, cardId: card.id, amountRwf: 1_000 })
      ).body.quoteId as string;
    const [q1, q2, q3, q4] = [
      await quoteFor(),
      await quoteFor(),
      await quoteFor(),
      await quoteFor(),
    ];
    await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'no-step-up-1')
      .send({ quoteId: q1 })
      .expect(401);
    const token = await stepUpWithPin(e2e, tourist, 'PAYMENT');
    await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'step-up-ok-1')
      .set('X-Step-Up-Token', token)
      .send({ quoteId: q2 })
      .expect(201);
    await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'step-up-ok-2')
      .set('X-Step-Up-Token', token)
      .send({ quoteId: q3 })
      .expect(401);
    await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'x')
      .set('X-Step-Up-Token', token)
      .send({ quoteId: q4 })
      .expect(400);
  });

  it('scenario 12: a risk flag holds the payment at authorisation, before any payout', async () => {
    await addCard(e2e, tourist);
    e2e.clock.advance(31_000);
    const other = await onboardTourist(e2e);
    // The same physical card (fingerprint) on a second account.
    const { response } = await createPayment(e2e, other, { cardKey: 'visa-home' });
    await settle(e2e, other, response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (await e2e.http.get(`/v1/payments/${response.body.id}`).set(other.auth)).body;
    await completeThreeDs(e2e, action.nextAction.url, 'approve');
    const held = await settle(e2e, other, response.body.id, { until: ['PENDING_REVIEW'] });
    expect(held).toMatchObject({
      state: 'PENDING_REVIEW',
      status: 'IN_REVIEW',
      chargeStatus: 'HOLD',
    });
    const flags = await e2e.db
      .selectFrom('risk_flags')
      .selectAll()
      .where('payment_id', '=', response.body.id)
      .execute();
    expect(flags.map((flag) => flag.rule)).toContain('CARD_ON_MULTIPLE_ACCOUNTS');
    expect((await operations(response.body.id)).some((op) => op.type === 'PAYOUT')).toBe(false);
    expect(mock.payoutCount()).toBe(0);
  });

  it("scenario 14: a tourist cannot read or list another tourist's payment", async () => {
    const { response } = await createPayment(e2e, tourist);
    e2e.clock.advance(31_000);
    const other = await onboardTourist(e2e);
    await e2e.http.get(`/v1/payments/${response.body.id}`).set(other.auth).expect(404);
    expect((await e2e.http.get('/v1/payments').set(other.auth).expect(200)).body.payments).toEqual(
      [],
    );
  });

  it('lists history newest first with status filters and cursor pagination', async () => {
    const card = (await addCard(e2e, tourist)).body;
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      ids.push(
        (await createPayment(e2e, tourist, { card, amountRwf: 1_000 + index })).response.body.id,
      );
      e2e.clock.advance(1_000);
    }
    const page1 = await e2e.http.get('/v1/payments?limit=2').set(tourist.auth).expect(200);
    recordContract('payments_list', page1.body);
    expect(page1.body.payments.map((payment: { id: string }) => payment.id)).toEqual([
      ids[2],
      ids[1],
    ]);
    const page2 = await e2e.http
      .get(`/v1/payments?limit=2&cursor=${page1.body.nextCursor}`)
      .set(tourist.auth)
      .expect(200);
    expect(page2.body.payments.map((payment: { id: string }) => payment.id)).toEqual([ids[0]]);
    expect(page2.body.nextCursor).toBeNull();
    expect(
      (await e2e.http.get('/v1/payments?status=COMPLETED').set(tourist.auth).expect(200)).body
        .payments,
    ).toEqual([]);
    await e2e.http.get('/v1/payments?cursor=garbage').set(tourist.auth).expect(400);
  });

  it('enforces daily limits across payments', async () => {
    const card = (await addCard(e2e, tourist)).body;
    await createPayment(e2e, tourist, { card, amountRwf: 200_000 });
    await createPayment(e2e, tourist, { card, amountRwf: 200_000 });
    const payee = (
      await e2e.http
        .post('/v1/payees/lookup')
        .set(tourist.auth)
        .send({ identifierType: 'PHONE', identifier: '0788123456' })
    ).body;
    const response = await e2e.http
      .post('/v1/quotes')
      .set(tourist.auth)
      .send({ payeeId: payee.payeeId, cardId: card.id, amountRwf: 150_000 })
      .expect(422);
    expect(response.body.error).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'PER_USER_DAILY' },
    });
  });

  it('the database refuses a second payout for the same payment', async () => {
    const { response } = await createPayment(e2e, tourist);
    const insert = (ref: string) =>
      e2e.db
        .insertInto('provider_operations')
        .values({
          payment_id: response.body.id,
          type: 'PAYOUT',
          request_ref: ref,
          status: 'REQUESTED',
          amount_minor: 1n,
          currency: 'RWF',
          requested_at: new Date(),
        })
        .execute();
    await insert('manual-1');
    await expect(insert('manual-2')).rejects.toMatchObject({ code: '23505' });
  });
});
