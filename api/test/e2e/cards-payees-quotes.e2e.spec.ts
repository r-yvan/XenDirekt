import { createE2eApp, E2eApp } from '../support/e2e-app';
import { recordContract } from '../support/contracts';
import { addCard, lookupPayee, onboardTourist, SignedInTourist } from '../support/flows';

describe('cards, payees and quotes (e2e, mock provider)', () => {
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

  describe('cards (FR-CRD-01..05)', () => {
    it('adds a card through the hosted page without any card number reaching the API', async () => {
      const setup = await e2e.http.post('/v1/cards/setup').set(tourist.auth).expect(201);
      recordContract('card_setup_started', setup.body);
      expect(setup.body).toMatchObject({
        returnUrlPrefix: 'xendirekt-app://card-setup/return',
        simulated: true,
      });
      const page = await e2e.http.get(new URL(setup.body.hostedUrl).pathname).expect(200);
      expect(page.text).toContain('SANDBOX');
      expect(page.text).not.toMatch(/name="(pan|cardNumber|cvv)"/i);

      const added = await addCard(e2e, tourist);
      expect(added.status).toBe(201);
      recordContract('card_added', added.body);
      expect(added.body).toMatchObject({
        brand: 'VISA',
        last4: '4242',
        isDefault: true,
        issuingCountry: 'CA',
        cardCurrency: 'CAD',
        simulated: true,
      });

      const row = await e2e.db.selectFrom('cards').selectAll().executeTakeFirstOrThrow();
      expect(row.provider_token_encrypted).toMatch(/^v1\.k1\./);
      expect(JSON.stringify(row)).not.toContain('mock_tok_');

      const list = await e2e.http.get('/v1/cards').set(tourist.auth).expect(200);
      recordContract('cards_list', list.body);
      expect(list.body.cards).toHaveLength(1);
    });

    it.each([
      ['visa-rwanda', 'ISSUED_IN_RWANDA_OR_BLOCKED_COUNTRY'],
      ['mc-prepaid', 'PREPAID'],
      ['visa-foreign', 'COUNTRY_MISMATCH'],
    ])('rejects %s with %s and stores no token', async (cardKey, reason) => {
      const response = await addCard(e2e, tourist, cardKey);
      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({ code: 'CARD_NOT_ELIGIBLE', details: { reason } });
      const row = await e2e.db.selectFrom('cards').selectAll().executeTakeFirstOrThrow();
      expect(row).toMatchObject({ status: 'REJECTED', provider_token_encrypted: null });
    });

    it('reports a failed 3-D Secure verification', async () => {
      const response = await addCard(e2e, tourist, 'visa-setup-fails');
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('CARD_SETUP_FAILED');
    });

    it('allows at most three cards and keeps exactly one default', async () => {
      await addCard(e2e, tourist, 'visa-home');
      await addCard(e2e, tourist, 'mc-home');
      const third = await addCard(e2e, tourist, 'visa-3ds');
      expect(third.body.isDefault).toBe(false);
      await e2e.http.post('/v1/cards/setup').set(tourist.auth).expect(409);

      await e2e.http
        .patch(`/v1/cards/${third.body.id}`)
        .set(tourist.auth)
        .send({ isDefault: true })
        .expect(200);
      const cards = (await e2e.http.get('/v1/cards').set(tourist.auth)).body.cards as {
        id: string;
        isDefault: boolean;
      }[];
      expect(cards.filter((card) => card.isDefault).map((card) => card.id)).toEqual([
        third.body.id,
      ]);

      await e2e.http.delete(`/v1/cards/${third.body.id}`).set(tourist.auth).expect(204);
      const after = (await e2e.http.get('/v1/cards').set(tourist.auth)).body.cards as {
        isDefault: boolean;
      }[];
      expect(after).toHaveLength(2);
      expect(after.filter((card) => card.isDefault)).toHaveLength(1);
      const removed = await e2e.db
        .selectFrom('cards')
        .select('provider_token_encrypted')
        .where('id', '=', third.body.id)
        .executeTakeFirstOrThrow();
      expect(removed.provider_token_encrypted).toBeNull();
    });

    it('returns the existing card when the same card is added again', async () => {
      const first = await addCard(e2e, tourist);
      const second = await addCard(e2e, tourist);
      expect(second.body.id).toBe(first.body.id);
    });

    it("never exposes another user's card (scenario 14)", async () => {
      const card = await addCard(e2e, tourist);
      e2e.clock.advance(31_000);
      const other = await onboardTourist(e2e);
      await e2e.http.delete(`/v1/cards/${card.body.id}`).set(other.auth).expect(404);
      await e2e.http
        .patch(`/v1/cards/${card.body.id}`)
        .set(other.auth)
        .send({ isDefault: true })
        .expect(404);
    });

    it('rejects a blocked card fingerprint', async () => {
      await e2e.db
        .insertInto('blocklist_entries')
        .values({
          entity_type: 'CARD_FINGERPRINT',
          entity_value: 'mockfp_visa-home',
          reason: 'fraud',
          created_by: 'test',
        })
        .execute();
      const response = await addCard(e2e, tourist);
      expect(response.body.error.details.reason).toBe('BLOCKED_FINGERPRINT');
    });
  });

  describe('payee lookup (FR-PAY-01..04)', () => {
    it('returns the registered name and a masked number', async () => {
      const response = await lookupPayee(e2e, tourist, '+250 788 123 456').expect(200);
      recordContract('payee_lookup', response.body);
      expect(response.body).toMatchObject({
        network: 'MTN',
        identifierType: 'PHONE',
        displayIdentifier: '078 812 3456',
        maskedIdentifier: '078* *** 456',
        simulated: true,
      });
      expect(response.body.registeredName).toMatch(/^SANDBOX /);
    });

    it.each([
      ['0788120000', 'PAYEE_NOT_FOUND', 422],
      ['0788120001', 'PAYEE_INACTIVE', 422],
      ['0722123456', 'NETWORK_NOT_SUPPORTED', 422],
      ['12345', 'INVALID_PAYEE_IDENTIFIER', 400],
      ['0788120002', 'PROVIDER_UNAVAILABLE', 503],
    ])('blocks %s with %s', async (identifier, code, status) => {
      const response = await lookupPayee(e2e, tourist, identifier).expect(status);
      expect(response.body.error.code).toBe(code);
      if (code === 'PAYEE_NOT_FOUND') {
        expect(response.body.error.message).toBe(
          "We couldn't find this MoMo account. Check the number with the seller.",
        );
      }
    });

    it('keeps merchant codes disabled until the partner confirms them', async () => {
      const response = await e2e.http
        .post('/v1/payees/lookup')
        .set(tourist.auth)
        .send({ identifierType: 'MERCHANT_CODE', identifier: '123456' })
        .expect(422);
      expect(response.body.error.code).toBe('FEATURE_DISABLED');
    });

    it('blocks a blocked payee', async () => {
      const payee = await lookupPayee(e2e, tourist).expect(200);
      await e2e.db
        .insertInto('blocklist_entries')
        .values({
          entity_type: 'PAYEE',
          entity_value: payee.body.payeeId,
          reason: 'fraud',
          created_by: 'test',
        })
        .execute();
      await lookupPayee(e2e, tourist).expect(422);
    });
  });

  describe('quotes (FR-QTE-01/02)', () => {
    it('quotes fee, FX and card total on the server, valid for five minutes', async () => {
      const card = await addCard(e2e, tourist);
      const payee = await lookupPayee(e2e, tourist).expect(200);
      const quote = await e2e.http
        .post('/v1/quotes')
        .set(tourist.auth)
        .send({ payeeId: payee.body.payeeId, cardId: card.body.id, amountRwf: 12_000 })
        .expect(201);
      recordContract('quote_created', quote.body);
      // Placeholder config: fee = 200 + ceil(1.5% of 12,000) = 380; CAD rate 1050 → 12,380 / 1050 = 11.7904… → 11.80
      expect(quote.body).toMatchObject({
        amountRwf: 12_000,
        feeRwf: 380,
        totalRwf: 12_380,
        cardCurrency: 'CAD',
        cardCurrencyExponent: 2,
        totalCardMinor: 1_180,
        totalCardDisplay: 'CAD 11.80',
        fxRate: '1050',
        fxRateDisplay: '1 CAD = 1,050 RWF',
        simulated: true,
        configApproved: false,
        card: { id: card.body.id, brand: 'VISA', last4: '4242' },
        payee: { payeeId: payee.body.payeeId, maskedIdentifier: '078* *** 456' },
      });
      const expiresIn = new Date(quote.body.expiresAt).getTime() - e2e.clock.nowMs();
      expect(expiresIn).toBe(5 * 60_000);
    });

    it('rejects amounts outside the configured range and fractional amounts', async () => {
      const card = await addCard(e2e, tourist);
      const payee = await lookupPayee(e2e, tourist).expect(200);
      const send = (amountRwf: number) =>
        e2e.http
          .post('/v1/quotes')
          .set(tourist.auth)
          .send({ payeeId: payee.body.payeeId, cardId: card.body.id, amountRwf });
      expect((await send(499).expect(422)).body.error).toMatchObject({
        code: 'AMOUNT_OUT_OF_RANGE',
        details: { minRwf: 500, maxRwf: 200_000 },
      });
      await send(500).expect(201);
      await send(200_000).expect(201);
      await send(200_001).expect(422);
      await send(1500.5).expect(400);
    });

    it("cannot quote with another user's card", async () => {
      const card = await addCard(e2e, tourist);
      const payee = await lookupPayee(e2e, tourist).expect(200);
      e2e.clock.advance(31_000);
      const other = await onboardTourist(e2e);
      await e2e.http
        .post('/v1/quotes')
        .set(other.auth)
        .send({ payeeId: payee.body.payeeId, cardId: card.body.id, amountRwf: 1_000 })
        .expect(404);
    });

    it('re-verifies a payee whose name is stale before quoting', async () => {
      const card = await addCard(e2e, tourist);
      const payee = await lookupPayee(e2e, tourist).expect(200);
      e2e.clock.advance(16 * 60_000);
      // The 15-minute access token expired too.
      const refreshed = await e2e.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: tourist.refreshToken, deviceId: tourist.deviceId })
        .expect(200);
      const before = await e2e.db
        .selectFrom('payees')
        .select('last_verified_at')
        .executeTakeFirstOrThrow();
      await e2e.http
        .post('/v1/quotes')
        .set({ Authorization: `Bearer ${refreshed.body.accessToken}` })
        .send({ payeeId: payee.body.payeeId, cardId: card.body.id, amountRwf: 1_000 })
        .expect(201);
      const after = await e2e.db
        .selectFrom('payees')
        .select('last_verified_at')
        .executeTakeFirstOrThrow();
      expect(after.last_verified_at!.getTime()).toBeGreaterThan(before.last_verified_at!.getTime());
    });
  });
});
