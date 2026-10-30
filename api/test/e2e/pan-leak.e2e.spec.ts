import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'kysely';
import { passesLuhn } from '../../src/common/logging/redaction';
import { createE2eApp, E2eApp } from '../support/e2e-app';
import {
  addCard,
  createPayment,
  lookupPayee,
  onboardTourist,
  settle,
  stepUpWithPin,
} from '../support/flows';

/** Every 13–19 digit run (spaces/dashes allowed) that passes Luhn: what a card number looks like. */
function findPans(text: string): string[] {
  // Bounded by non-alphanumerics, as a card number in text is: digit runs inside hashes and
  // random tokens (e.g. hex) are not card numbers and would make this test flaky.
  return [...text.matchAll(/(?<![\dA-Za-z])(?:\d[ -]?){12,18}\d(?![\dA-Za-z])/g)]
    .map((match) => match[0].replace(/[ -]/g, ''))
    .filter((digits) => digits.length >= 13 && digits.length <= 19 && passesLuhn(digits));
}

/**
 * NFR-SEC-01 / AC-7: after the main flows — including a tourist pasting a card number into
 * free-text fields — no table, recorded contract fixture or analytics row holds a card number.
 */
describe('no card numbers at rest (e2e)', () => {
  let e2e: E2eApp;
  const PASTED_PAN = '4111 1111 1111 1111';

  beforeAll(async () => {
    e2e = await createE2eApp();
    await e2e.reset();
  });
  afterAll(async () => {
    await e2e.close();
  });

  it('scrubs pasted card numbers and stores none anywhere', async () => {
    expect(findPans(PASTED_PAN)).toEqual(['4111111111111111']);
    const tourist = await onboardTourist(e2e);
    await addCard(e2e, tourist, 'mc-home');
    const { response } = await createPayment(e2e, tourist, { payee: '0788121111' });
    await settle(e2e, tourist, response.body.id);

    // Free text: payment note and support ticket.
    const card = (await e2e.http.get('/v1/cards').set(tourist.auth).expect(200)).body.cards[0];
    const payee = (await lookupPayee(e2e, tourist).expect(200)).body;
    const quote = (
      await e2e.http
        .post('/v1/quotes')
        .set(tourist.auth)
        .send({ payeeId: payee.payeeId, cardId: card.id, amountRwf: 5_000 })
        .expect(201)
    ).body;
    const stepUp = await stepUpWithPin(e2e, tourist, 'PAYMENT');
    const noted = await e2e.http
      .post('/v1/payments')
      .set(tourist.auth)
      .set('Idempotency-Key', 'pan-leak-key-0001')
      .set('X-Step-Up-Token', stepUp)
      .send({ quoteId: quote.quoteId, note: `card ${PASTED_PAN}` })
      .expect(201);
    expect(noted.body.note ?? '').not.toContain('1111 1111');
    const ticket = await e2e.http
      .post('/v1/tickets')
      .set(tourist.auth)
      .send({ category: 'APP_PROBLEM', message: `My card ${PASTED_PAN} exp 12/29 does not work` })
      .expect(201);
    expect(JSON.stringify(ticket.body)).not.toContain('1111 1111');
    // Analytics refuses card-number-like properties outright.
    await e2e.http
      .post('/v1/analytics/events')
      .set(tourist.auth)
      .send({
        events: [
          {
            name: 'card_add_failed',
            occurredAt: new Date().toISOString(),
            properties: { reason: '4111111111111111' },
          },
        ],
      })
      .expect(400);

    const tables = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'kysely_%'`.execute(
      e2e.db,
    );
    expect(tables.rows.length).toBeGreaterThan(20);
    const leaks: string[] = [];
    for (const { table_name: table } of tables.rows) {
      const rows = await sql<{
        row: string;
      }>`SELECT t::text AS row FROM ${sql.table(table)} t`.execute(e2e.db);
      for (const { row } of rows.rows) {
        leaks.push(...findPans(row).map((pan) => `${table}: ${pan.slice(0, 6)}…`));
      }
    }
    expect(leaks).toEqual([]);

    const fixtures = join(__dirname, '../../../contracts/fixtures');
    for (const file of readdirSync(fixtures)) {
      expect({ file, pans: findPans(readFileSync(join(fixtures, file), 'utf8')) }).toEqual({
        file,
        pans: [],
      });
    }
  });
});
