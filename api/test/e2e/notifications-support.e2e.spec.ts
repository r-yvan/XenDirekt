import { createE2eApp, E2eApp } from '../support/e2e-app';
import { recordContract } from '../support/contracts';
import {
  adminSession,
  completeThreeDs,
  createPayment,
  onboardTourist,
  settle,
  SignedInTourist,
} from '../support/flows';

describe('notifications, support and analytics (e2e)', () => {
  let e2e: E2eApp;
  let tourist: SignedInTourist;

  beforeAll(async () => {
    e2e = await createE2eApp();
  });
  afterAll(async () => {
    await e2e.close();
  });
  beforeEach(async () => {
    await e2e.reset();
    tourist = await onboardTourist(e2e);
  });

  async function completedPayment(options: Parameters<typeof createPayment>[2] = {}) {
    const { response } = await createPayment(e2e, tourist, options);
    await settle(e2e, tourist, response.body.id, { until: ['AUTH_PENDING'] });
    await e2e.dispatcher.drain();
    const action = (await e2e.http.get(`/v1/payments/${response.body.id}`).set(tourist.auth)).body;
    if (action.nextAction) {
      await completeThreeDs(e2e, action.nextAction.url, 'approve');
    }
    return settle(e2e, tourist, response.body.id);
  }

  it('confirms a completed payment to the tourist (in-app + email) and the merchant (SMS, EN + Kinyarwanda)', async () => {
    const payment = await completedPayment();
    expect(payment.state).toBe('COMPLETED');
    await e2e.dispatcher.drain();

    const merchant = e2e.sms.sent.find((message) => message.to === '+250788123456');
    expect(merchant?.text).toMatch(
      /^\[SANDBOX: not real money\] You received RWF 12,000 from Oliver via XenDirekt\. Ref XD-[A-Z2-9]{6}\. Note: 2 baskets\./,
    );
    expect(merchant?.text).toContain('Wakiriye RWF 12,000');
    expect(merchant?.text).not.toContain('Martin'); // first name only

    const email = e2e.email.sent.find(
      (message) => message.to === tourist.email && message.subject.includes('Payment sent'),
    );
    expect(email?.text).toContain('received RWF 12,000');

    const inbox = await e2e.http.get('/v1/notifications').set(tourist.auth).expect(200);
    recordContract('notifications_inbox', inbox.body);
    expect(inbox.body.unread).toBe(1);
    expect(inbox.body.notifications[0]).toMatchObject({
      kind: 'PAYMENT_COMPLETED',
      read: false,
      deepLink: `xendirekt://payments/${String(payment.id)}`,
    });

    await e2e.http
      .post(`/v1/notifications/${inbox.body.notifications[0].id}/read`)
      .set(tourist.auth)
      .expect(204);
    expect((await e2e.http.get('/v1/notifications').set(tourist.auth)).body.unread).toBe(0);

    const rows = await e2e.db
      .selectFrom('notifications')
      .select(['channel', 'audience', 'status', 'status_reason'])
      .execute();
    expect(rows).toEqual(
      expect.arrayContaining([
        { channel: 'IN_APP', audience: 'TOURIST', status: 'SENT', status_reason: null },
        { channel: 'EMAIL', audience: 'TOURIST', status: 'SENT', status_reason: null },
        { channel: 'SMS', audience: 'MERCHANT', status: 'SENT', status_reason: null },
      ]),
    );
  });

  it('tells the tourist they were not charged when a payout fails', async () => {
    const payment = await completedPayment({ payee: '0788121111' });
    expect(payment.state).toBe('VOIDED');
    await e2e.dispatcher.drain();
    const inbox = (await e2e.http.get('/v1/notifications').set(tourist.auth)).body;
    expect(inbox.notifications[0].body).toContain('You have not been charged');
    expect(e2e.sms.sent.some((message) => message.to === '+250788121111')).toBe(false);
  });

  it('never lets a notification failure change a completed payment', async () => {
    const original = e2e.sms.send.bind(e2e.sms);
    e2e.sms.send = () => Promise.reject(new Error('SMS gateway down'));
    try {
      const payment = await completedPayment();
      for (let round = 0; round < 8; round += 1) {
        e2e.clock.advance(10 * 60_000);
        await e2e.dispatcher.drain();
      }
      const merchant = await e2e.db
        .selectFrom('notifications')
        .selectAll()
        .where('audience', '=', 'MERCHANT')
        .executeTakeFirstOrThrow();
      expect(merchant.status).toBe('FAILED');
      const state = await e2e.db
        .selectFrom('payments')
        .select('state')
        .where('id', '=', payment.id as string)
        .executeTakeFirstOrThrow();
      expect(state.state).toBe('COMPLETED');
    } finally {
      e2e.sms.send = original;
    }
  });

  it('records notifications once even if a state is re-entered or a job is re-run', async () => {
    await completedPayment();
    await e2e.dispatcher.drain();
    const before = e2e.sms.sent.length;
    const jobs = await e2e.db
      .selectFrom('outbox_events')
      .select('id')
      .where('type', '=', 'notification.deliver')
      .execute();
    await e2e.db
      .updateTable('outbox_events')
      .set({ status: 'PENDING', available_at: new Date(0) })
      .where('type', '=', 'notification.deliver')
      .execute();
    await e2e.dispatcher.drain();
    expect(jobs.length).toBeGreaterThan(0);
    expect(e2e.sms.sent.length).toBe(before);
  });

  describe('support tickets (FR-HIS-02)', () => {
    it('reports a problem with the payment reference attached; admins triage with masking by role', async () => {
      const { response } = await createPayment(e2e, tourist);
      const ticket = await e2e.http
        .post(`/v1/payments/${response.body.id}/tickets`)
        .set(tourist.auth)
        .send({ category: 'SELLER_NOT_PAID', message: 'The seller says nothing arrived.' })
        .expect(201);
      recordContract('ticket_created', ticket.body);
      expect(ticket.body).toMatchObject({
        paymentReference: response.body.reference,
        paymentStateAtReport: 'QUOTED',
        status: 'OPEN',
        reference: expect.stringMatching(/^TK-/),
      });
      expect(
        (await e2e.http.get('/v1/tickets').set(tourist.auth).expect(200)).body.tickets,
      ).toHaveLength(1);

      const viewer = await adminSession(e2e, 'VIEWER');
      const viewerList = (await e2e.http.get('/v1/admin/tickets').set(viewer.auth).expect(200)).body
        .tickets;
      expect(viewerList[0].customer.email).toMatch(/^\w\*\*\*@/);
      await e2e.http
        .patch(`/v1/admin/tickets/${ticket.body.id}`)
        .set(viewer.auth)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);

      const agent = await adminSession(e2e, 'SUPPORT_AGENT');
      const agentList = (await e2e.http.get('/v1/admin/tickets').set(agent.auth).expect(200)).body
        .tickets;
      expect(agentList[0].customer.email).toBe(tourist.email);
      await e2e.http
        .patch(`/v1/admin/tickets/${ticket.body.id}`)
        .set(agent.auth)
        .send({ status: 'RESOLVED' })
        .expect(400);
      await e2e.http
        .patch(`/v1/admin/tickets/${ticket.body.id}`)
        .set(agent.auth)
        .send({
          status: 'RESOLVED',
          assigneeId: agent.id,
          resolutionNote: 'Payout confirmed with partner.',
        })
        .expect(200);
      const audit = await e2e.db
        .selectFrom('audit_logs')
        .select(['action', 'actor_id'])
        .where('action', '=', 'ticket.updated')
        .executeTakeFirstOrThrow();
      expect(audit.actor_id).toBe(agent.id);
    });

    it("cannot open a ticket on someone else's payment", async () => {
      const { response } = await createPayment(e2e, tourist);
      e2e.clock.advance(31_000);
      const other = await onboardTourist(e2e);
      await e2e.http
        .post(`/v1/payments/${response.body.id}/tickets`)
        .set(other.auth)
        .send({ category: 'OTHER' })
        .expect(404);
    });
  });

  describe('analytics (PRD §10.1)', () => {
    it('accepts allowlisted events and rejects personal data', async () => {
      await e2e.http
        .post('/v1/analytics/events')
        .set(tourist.auth)
        .send({
          events: [
            { name: 'pay_screen_opened', occurredAt: new Date().toISOString(), properties: {} },
            {
              name: 'taps_to_complete',
              occurredAt: new Date().toISOString(),
              properties: { flow: 'pay_new_merchant', taps: 1 },
            },
          ],
        })
        .expect(202);
      await e2e.http
        .post('/v1/analytics/events')
        .set(tourist.auth)
        .send({
          events: [
            {
              name: 'card_added',
              occurredAt: new Date().toISOString(),
              properties: { brand: 'VISA', email: 'x@example.com' },
            },
          ],
        })
        .expect(400);
      await e2e.http
        .post('/v1/analytics/events')
        .set(tourist.auth)
        .send({
          events: [{ name: 'custom_event', occurredAt: new Date().toISOString(), properties: {} }],
        })
        .expect(400);
      await e2e.http
        .post('/v1/analytics/events')
        .set(tourist.auth)
        .send({
          events: [
            {
              name: 'card_add_failed',
              occurredAt: new Date().toISOString(),
              properties: { reason: '4242424242424242' },
            },
          ],
        })
        .expect(400);
      const stored = await e2e.db
        .selectFrom('analytics_events')
        .select(['event_name', 'properties'])
        .execute();
      expect(stored.map((row) => row.event_name).sort()).toEqual([
        'pay_screen_opened',
        'taps_to_complete',
      ]);
    });

    it('records server-side payment outcome events without personal data', async () => {
      await completedPayment();
      const event = await e2e.db
        .selectFrom('analytics_events')
        .selectAll()
        .where('event_name', '=', 'payment_completed')
        .executeTakeFirstOrThrow();
      expect(JSON.stringify(event.properties)).not.toMatch(/Oliver|@|\+250|SANDBOX/);
      expect(event.properties).toMatchObject({ amountRwf: 12_000, simulated: true });
    });
  });
});
