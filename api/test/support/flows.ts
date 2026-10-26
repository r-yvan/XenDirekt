import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { E2eApp } from './e2e-app';

export interface SignedInTourist {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  userId: string;
  email: string;
  auth: { Authorization: string };
}

export async function signIn(
  e2e: E2eApp,
  email: string,
  deviceId = randomUUID(),
): Promise<SignedInTourist & { body: Record<string, unknown> }> {
  const otp = await e2e.http
    .post('/v1/auth/otp')
    .send({ channel: 'EMAIL', destination: email })
    .expect(202);
  const verify = await e2e.http
    .post('/v1/auth/verify')
    .send({
      challengeId: otp.body.challengeId,
      otp: e2e.email.lastCodeFor(email),
      deviceId,
      platform: 'android',
    })
    .expect(200);
  return {
    accessToken: verify.body.accessToken,
    refreshToken: verify.body.refreshToken,
    deviceId,
    userId: verify.body.user.id,
    email,
    auth: { Authorization: `Bearer ${verify.body.accessToken}` },
    body: verify.body,
  };
}

export const TEST_PIN = '482913';

/** Full onboarding: sign in, complete profile with consent, set PIN. */
export async function onboardTourist(
  e2e: E2eApp,
  email = `tourist-${randomUUID().slice(0, 8)}@example.com`,
): Promise<SignedInTourist> {
  const tourist = await signIn(e2e, email);
  await e2e.http
    .patch('/v1/me')
    .set(tourist.auth)
    .send({
      fullName: 'Oliver Martin',
      countryOfResidence: 'CA',
      dateOfBirth: '1990-04-12',
      acceptLegalTerms: true,
    })
    .expect(200);
  await e2e.http.post('/v1/me/pin').set(tourist.auth).send({ pin: TEST_PIN }).expect(204);
  return tourist;
}

export async function stepUpWithPin(
  e2e: E2eApp,
  tourist: SignedInTourist,
  purpose: string,
  pin = TEST_PIN,
): Promise<string> {
  const response = await e2e.http
    .post('/v1/auth/step-up')
    .set(tourist.auth)
    .send({ purpose, method: 'PIN', pin })
    .expect(201);
  return response.body.stepUpToken as string;
}

/** Registers an Ed25519 device key (as the app does after enabling biometrics) and returns a signer. */
export async function registerDeviceKey(e2e: E2eApp, tourist: SignedInTourist) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
  const stepUpToken = await stepUpWithPin(e2e, tourist, 'REGISTER_DEVICE_KEY');
  await e2e.http
    .post('/v1/me/device-key')
    .set(tourist.auth)
    .set('X-Step-Up-Token', stepUpToken)
    .send({ algorithm: 'ED25519', publicKey: raw })
    .expect(201);
  return {
    sign: (message: string) =>
      sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64'),
  };
}

/** Adds a card the way the app does: setup → hosted page (form post) → complete. */
export async function addCard(e2e: E2eApp, tourist: SignedInTourist, cardKey = 'visa-home') {
  const setup = await e2e.http.post('/v1/cards/setup').set(tourist.auth).expect(201);
  const hostedPath = new URL(setup.body.hostedUrl as string).pathname;
  const page = await e2e.http.post(hostedPath).type('form').send({ cardKey }).expect(303);
  expect(String(page.headers.location)).toMatch(/^xendirekt-app:\/\/card-setup\/return\?setupId=/);
  return e2e.http.post('/v1/cards').set(tourist.auth).send({ setupId: setup.body.setupId });
}

export function lookupPayee(e2e: E2eApp, tourist: SignedInTourist, identifier = '0788123456') {
  return e2e.http
    .post('/v1/payees/lookup')
    .set(tourist.auth)
    .send({ identifierType: 'PHONE', identifier });
}

export interface PaymentOptions {
  cardKey?: string;
  payee?: string;
  amountRwf?: number;
  idempotencyKey?: string;
  card?: { id: string };
}

/** Card (unless given) → lookup → quote → PIN step-up → POST /v1/payments. */
export async function createPayment(
  e2e: E2eApp,
  tourist: SignedInTourist,
  options: PaymentOptions = {},
) {
  const card = options.card ?? (await addCard(e2e, tourist, options.cardKey ?? 'visa-home')).body;
  const payee = await lookupPayee(e2e, tourist, options.payee ?? '0788123456').expect(200);
  const quote = await e2e.http
    .post('/v1/quotes')
    .set(tourist.auth)
    .send({ payeeId: payee.body.payeeId, cardId: card.id, amountRwf: options.amountRwf ?? 12_000 })
    .expect(201);
  const stepUp = await stepUpWithPin(e2e, tourist, 'PAYMENT');
  const response = await e2e.http
    .post('/v1/payments')
    .set(tourist.auth)
    .set(
      'Idempotency-Key',
      options.idempotencyKey ?? `key-${Math.random().toString(36).slice(2, 14)}`,
    )
    .set('X-Step-Up-Token', stepUp)
    .send({ quoteId: quote.body.quoteId, note: '2 baskets' });
  return { response, card, quote: quote.body, payee: payee.body };
}

const FINAL = new Set(['AUTH_FAILED', 'VOIDED', 'COMPLETED', 'REFUNDED']);

/**
 * Runs the worker and advances time until the payment reaches one of `until` (default: a final
 * state), or the round budget is spent. Each round moves the clock by `stepMs`.
 */
export async function settle(
  e2e: E2eApp,
  tourist: SignedInTourist,
  paymentId: string,
  options: { until?: string[]; rounds?: number; stepMs?: number } = {},
) {
  const until = new Set(options.until ?? [...FINAL]);
  let body: Record<string, unknown> = {};
  for (let round = 0; round < (options.rounds ?? 20); round += 1) {
    await e2e.dispatcher.drain();
    body = (await e2e.http.get(`/v1/payments/${paymentId}`).set(tourist.auth).expect(200))
      .body as Record<string, unknown>;
    if (until.has(body.state as string)) {
      return body;
    }
    e2e.clock.advance(options.stepMs ?? 3_000);
  }
  return body;
}

/** What the WebView does on the mock 3-D Secure page. */
export async function completeThreeDs(
  e2e: E2eApp,
  actionUrl: string,
  decision: 'approve' | 'decline',
) {
  return e2e.http.post(new URL(actionUrl).pathname).type('form').send({ decision }).expect(303);
}
