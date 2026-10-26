import { randomUUID } from 'node:crypto';
import { createE2eApp, E2eApp } from '../support/e2e-app';
import { recordContract } from '../support/contracts';
import {
  onboardTourist,
  registerDeviceKey,
  signIn,
  stepUpWithPin,
  TEST_PIN,
} from '../support/flows';

describe('identity and profile (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp();
  });
  afterAll(async () => {
    await e2e.close();
  });
  beforeEach(async () => {
    await e2e.reset();
  });

  describe('app config', () => {
    it('tells the app it is talking to a sandbox and which features exist', async () => {
      const response = await e2e.http.get('/v1/app-config').expect(200);
      expect(response.body).toMatchObject({
        providerMode: 'SANDBOX',
        features: { merchantCodes: false, federatedSignIn: false },
        auth: { otpLength: 6, pinLength: 6 },
      });
      recordContract('app_config', response.body);
    });
  });

  describe('one-time codes (FR-ONB-02)', () => {
    it('signs up a new tourist with an emailed code and returns device-bound tokens', async () => {
      const otp = await e2e.http
        .post('/v1/auth/otp')
        .set('Accept-Language', 'fr-FR')
        .send({ channel: 'EMAIL', destination: 'Oliver@Example.com' })
        .expect(202);
      recordContract('auth_otp_requested', otp.body);
      expect(otp.body).toMatchObject({ destinationMasked: 'o***@e***.com', codeLength: 6 });
      expect(e2e.email.sent[0]?.subject).toContain('Votre code');

      const code = e2e.email.lastCodeFor('oliver@example.com');
      const verify = await e2e.http
        .post('/v1/auth/verify')
        .send({
          challengeId: otp.body.challengeId,
          otp: code,
          deviceId: randomUUID(),
          platform: 'ios',
        })
        .expect(200);
      recordContract('auth_verified_new_user', verify.body);
      expect(verify.body).toMatchObject({
        isNewUser: true,
        accessTokenExpiresIn: 900,
        user: {
          email: 'oliver@example.com',
          status: 'PENDING_PROFILE',
          pinSet: false,
          profileComplete: false,
        },
      });

      const stored = await e2e.db
        .selectFrom('otp_challenges')
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(stored.code_hash).not.toContain(code);
      expect(stored.destination_encrypted).toBeNull();
      expect(JSON.stringify(stored)).not.toContain('oliver@example.com');
    });

    it('supports international phone numbers by SMS', async () => {
      const otp = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'SMS', destination: '+1 415 555 2671' })
        .expect(202);
      await e2e.http
        .post('/v1/auth/verify')
        .send({
          challengeId: otp.body.challengeId,
          otp: e2e.sms.lastCodeFor('+14155552671'),
          deviceId: randomUUID(),
        })
        .expect(200)
        .expect((response) => expect(response.body.user.phone).toBe('+14155552671'));
    });

    it('rejects a phone number without a country code', async () => {
      const response = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'SMS', destination: '4155552671' })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('allows five attempts, then burns the code', async () => {
      const otp = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'a@example.com' })
        .expect(202);
      const real = e2e.email.lastCodeFor('a@example.com');
      const wrong = real === '000000' ? '111111' : '000000';
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await e2e.http
          .post('/v1/auth/verify')
          .send({ challengeId: otp.body.challengeId, otp: wrong, deviceId: randomUUID() })
          .expect(400);
        expect(response.body.error).toMatchObject({
          code: 'OTP_INVALID',
          details: { attemptsRemaining: 5 - attempt },
        });
      }
      await e2e.http
        .post('/v1/auth/verify')
        .send({ challengeId: otp.body.challengeId, otp: wrong, deviceId: randomUUID() })
        .expect(400)
        .expect((response) => expect(response.body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED'));
      // Even the right code no longer works.
      await e2e.http
        .post('/v1/auth/verify')
        .send({ challengeId: otp.body.challengeId, otp: real, deviceId: randomUUID() })
        .expect(400)
        .expect((response) => expect(response.body.error.code).toBe('OTP_EXPIRED'));
    });

    it('expires codes after five minutes and never accepts a code twice', async () => {
      const first = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'b@example.com' })
        .expect(202);
      const code = e2e.email.lastCodeFor('b@example.com');
      e2e.clock.advance(5 * 60_000 + 1);
      await e2e.http
        .post('/v1/auth/verify')
        .send({ challengeId: first.body.challengeId, otp: code, deviceId: randomUUID() })
        .expect(400)
        .expect((response) => expect(response.body.error.code).toBe('OTP_EXPIRED'));

      const second = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'b@example.com' })
        .expect(202);
      const payload = {
        challengeId: second.body.challengeId,
        otp: e2e.email.lastCodeFor('b@example.com'),
        deviceId: randomUUID(),
      };
      await e2e.http.post('/v1/auth/verify').send(payload).expect(200);
      await e2e.http
        .post('/v1/auth/verify')
        .send(payload)
        .expect(400)
        .expect((response) => expect(response.body.error.code).toBe('OTP_EXPIRED'));
    });

    it('enforces a resend cooldown and invalidates the previous code', async () => {
      const first = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'c@example.com' })
        .expect(202);
      const firstCode = e2e.email.lastCodeFor('c@example.com');
      const tooSoon = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'c@example.com' })
        .expect(429);
      expect(tooSoon.body.error.code).toBe('RATE_LIMITED');
      e2e.clock.advance(31_000);
      await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'c@example.com' })
        .expect(202);
      await e2e.http
        .post('/v1/auth/verify')
        .send({ challengeId: first.body.challengeId, otp: firstCode, deviceId: randomUUID() })
        .expect(400)
        .expect((response) => expect(response.body.error.code).toBe('OTP_EXPIRED'));
    });

    it('rate-limits code requests per destination', async () => {
      for (let index = 0; index < 5; index += 1) {
        await e2e.http
          .post('/v1/auth/otp')
          .send({ channel: 'EMAIL', destination: 'd@example.com' })
          .expect(202);
        e2e.clock.advance(31_000);
      }
      const limited = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'd@example.com' })
        .expect(429);
      expect(limited.headers['retry-after']).toBeDefined();
    });

    it('reports delivery failure without leaving a usable challenge', async () => {
      e2e.email.failNext = true;
      const response = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'e@example.com' })
        .expect(503);
      expect(response.body.error.code).toBe('PROVIDER_UNAVAILABLE');
      const challenge = await e2e.db
        .selectFrom('otp_challenges')
        .select('invalidated_at')
        .executeTakeFirstOrThrow();
      expect(challenge.invalidated_at).not.toBeNull();
    });
  });

  describe('profile and consent (FR-ONB-03)', () => {
    it('keeps the account pending until name, country, DOB and consent are all present', async () => {
      const tourist = await signIn(e2e, 'f@example.com');
      await e2e.http
        .get('/v1/cards')
        .set(tourist.auth)
        .expect((response) => {
          expect([403, 404, 409]).toContain(response.status);
        });
      const partial = await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .send({ fullName: 'Ana Silva', countryOfResidence: 'PT' })
        .expect(200);
      expect(partial.body.status).toBe('PENDING_PROFILE');
      const complete = await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .set('X-App-Version', '1.0.0')
        .send({ dateOfBirth: '1988-02-29', acceptLegalTerms: true })
        .expect(200);
      recordContract('me_profile_active', complete.body);
      expect(complete.body).toMatchObject({
        status: 'ACTIVE',
        profileComplete: true,
        acceptedTermsVersion: '2026-10-01',
      });
      const consents = await e2e.db
        .selectFrom('consents')
        .selectAll()
        .where('user_id', '=', tourist.userId)
        .execute();
      expect(consents.map((row) => row.document_type).sort()).toEqual(['PRIVACY', 'TERMS']);
      expect(consents[0]?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects minors and impossible dates', async () => {
      const tourist = await signIn(e2e, 'g@example.com');
      const minor = new Date(e2e.clock.nowMs() - 17 * 365 * 86_400_000).toISOString().slice(0, 10);
      await e2e.http.patch('/v1/me').set(tourist.auth).send({ dateOfBirth: minor }).expect(400);
      await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .send({ dateOfBirth: '1990-02-30' })
        .expect(400);
      await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .send({ countryOfResidence: 'XX' })
        .expect(400);
    });

    it('locks identity fields once active, but allows language changes', async () => {
      const tourist = await onboardTourist(e2e);
      await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .send({ fullName: 'Someone Else' })
        .expect(409);
      await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .send({ preferredLanguage: 'fr' })
        .expect(200);
    });

    it('strips unknown fields instead of trusting them', async () => {
      const tourist = await signIn(e2e, 'h@example.com');
      await e2e.http
        .patch('/v1/me')
        .set(tourist.auth)
        .send({ status: 'ACTIVE', kycLevel: 'VERIFIED' })
        .expect(400);
    });
  });

  describe('sessions (NFR-SEC-04)', () => {
    it('rotates refresh tokens and revokes the session when an old token is replayed later', async () => {
      const tourist = await signIn(e2e, 'i@example.com');
      const first = await e2e.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: tourist.refreshToken, deviceId: tourist.deviceId })
        .expect(200);
      recordContract('auth_refreshed', first.body);
      expect(first.body.refreshToken).not.toBe(tourist.refreshToken);

      // A lost-response retry within the grace window still works.
      await e2e.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: tourist.refreshToken, deviceId: tourist.deviceId })
        .expect(200);

      e2e.clock.advance(60_000);
      await e2e.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: tourist.refreshToken, deviceId: tourist.deviceId })
        .expect(401)
        .expect((response) => expect(response.body.error.code).toBe('SESSION_REVOKED'));
      await e2e.http
        .get('/v1/me')
        .set({ Authorization: `Bearer ${first.body.accessToken}` })
        .expect(401);
      const audit = await e2e.db
        .selectFrom('audit_logs')
        .select('action')
        .where('action', '=', 'session.refresh_reuse_detected')
        .execute();
      expect(audit).toHaveLength(1);
    });

    it('treats a refresh token from another device as stolen', async () => {
      const tourist = await signIn(e2e, 'j@example.com');
      await e2e.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: tourist.refreshToken, deviceId: randomUUID() })
        .expect(401);
      await e2e.http.get('/v1/me').set(tourist.auth).expect(401);
    });

    it('logs out immediately, before the access token expires', async () => {
      const tourist = await signIn(e2e, 'k@example.com');
      await e2e.http.post('/v1/auth/logout').set(tourist.auth).expect(204);
      await e2e.http
        .get('/v1/me')
        .set(tourist.auth)
        .expect(401)
        .expect((response) => expect(response.body.error.code).toBe('SESSION_REVOKED'));
    });

    it('expires access tokens after 15 minutes', async () => {
      const tourist = await signIn(e2e, 'l@example.com');
      e2e.clock.advance(15 * 60_000 + 1_000);
      await e2e.http
        .get('/v1/me')
        .set(tourist.auth)
        .expect(401)
        .expect((response) => expect(response.body.error.code).toBe('UNAUTHENTICATED'));
    });

    it('keeps one active account per device (NFR-RSK-05)', async () => {
      const deviceId = randomUUID();
      const first = await signIn(e2e, 'm@example.com', deviceId);
      await signIn(e2e, 'n@example.com', deviceId);
      await e2e.http.get('/v1/me').set(first.auth).expect(401);
    });

    it('rejects missing, malformed and forged tokens', async () => {
      await e2e.http.get('/v1/me').expect(401);
      await e2e.http.get('/v1/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
      const tourist = await signIn(e2e, 'o@example.com');
      const [header, payload] = tourist.accessToken.split('.');
      await e2e.http
        .get('/v1/me')
        .set('Authorization', `Bearer ${header}.${payload}.forged`)
        .expect(401);
    });
  });

  describe('PIN and step-up (FR-ONB-04, ADR 0005)', () => {
    it('refuses trivial PINs and a second initial PIN', async () => {
      const tourist = await signIn(e2e, 'p@example.com');
      await e2e.http.post('/v1/me/pin').set(tourist.auth).send({ pin: '123456' }).expect(400);
      await e2e.http.post('/v1/me/pin').set(tourist.auth).send({ pin: '111111' }).expect(400);
      await e2e.http.post('/v1/me/pin').set(tourist.auth).send({ pin: '12345' }).expect(400);
      await e2e.http.post('/v1/me/pin').set(tourist.auth).send({ pin: TEST_PIN }).expect(204);
      await e2e.http.post('/v1/me/pin').set(tourist.auth).send({ pin: '905173' }).expect(409);
      const row = await e2e.db
        .selectFrom('users')
        .select('pin_hash')
        .where('id', '=', tourist.userId)
        .executeTakeFirstOrThrow();
      expect(row.pin_hash).toMatch(/^\$argon2id\$/);
      expect(row.pin_hash).not.toContain(TEST_PIN);
    });

    it('locks PIN use after five wrong attempts', async () => {
      const tourist = await onboardTourist(e2e);
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await e2e.http
          .post('/v1/auth/step-up')
          .set(tourist.auth)
          .send({ purpose: 'PAYMENT', method: 'PIN', pin: '905173' })
          .expect(401);
        expect(response.body.error).toMatchObject({
          code: 'PIN_INVALID',
          details: { attemptsRemaining: 5 - attempt },
        });
      }
      await e2e.http
        .post('/v1/auth/step-up')
        .set(tourist.auth)
        .send({ purpose: 'PAYMENT', method: 'PIN', pin: '905173' })
        .expect(423);
      // Locked even for the right PIN until the lock expires.
      await e2e.http
        .post('/v1/auth/step-up')
        .set(tourist.auth)
        .send({ purpose: 'PAYMENT', method: 'PIN', pin: TEST_PIN })
        .expect(423);
      e2e.clock.advance(15 * 60_000 + 1);
      // The 15-minute access token expired too; refresh it as the app would.
      const refreshed = await e2e.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: tourist.refreshToken, deviceId: tourist.deviceId })
        .expect(200);
      await e2e.http
        .post('/v1/auth/step-up')
        .set({ Authorization: `Bearer ${refreshed.body.accessToken}` })
        .send({ purpose: 'PAYMENT', method: 'PIN', pin: TEST_PIN })
        .expect(201);
    });

    it('accepts a biometric device-key signature, single use, bound to purpose', async () => {
      const tourist = await onboardTourist(e2e);
      const device = await registerDeviceKey(e2e, tourist);
      const challenge = await e2e.http
        .post('/v1/auth/step-up/challenge')
        .set(tourist.auth)
        .send({ purpose: 'DELETE_ACCOUNT' })
        .expect(201);
      recordContract('auth_step_up_challenge', challenge.body);
      const signature = device.sign(challenge.body.signingMessage);
      const grant = await e2e.http
        .post('/v1/auth/step-up')
        .set(tourist.auth)
        .send({
          purpose: 'DELETE_ACCOUNT',
          method: 'DEVICE_KEY',
          challengeId: challenge.body.challengeId,
          signature,
        })
        .expect(201);
      recordContract('auth_step_up_granted', grant.body);
      // Challenge reuse fails.
      await e2e.http
        .post('/v1/auth/step-up')
        .set(tourist.auth)
        .send({
          purpose: 'DELETE_ACCOUNT',
          method: 'DEVICE_KEY',
          challengeId: challenge.body.challengeId,
          signature,
        })
        .expect(401);
      // Grant for one purpose cannot be used for another.
      await e2e.http
        .post('/v1/me/pin/change')
        .set(tourist.auth)
        .set('X-Step-Up-Token', grant.body.stepUpToken)
        .send({ pin: '905173' })
        .expect(401);
    });

    it('rejects a signature from a different key', async () => {
      const tourist = await onboardTourist(e2e);
      await registerDeviceKey(e2e, tourist);
      const attacker = await registerDeviceKey(e2e, await onboardTourist(e2e));
      const challenge = await e2e.http
        .post('/v1/auth/step-up/challenge')
        .set(tourist.auth)
        .send({ purpose: 'PAYMENT' })
        .expect(201);
      await e2e.http
        .post('/v1/auth/step-up')
        .set(tourist.auth)
        .send({
          purpose: 'PAYMENT',
          method: 'DEVICE_KEY',
          challengeId: challenge.body.challengeId,
          signature: attacker.sign(challenge.body.signingMessage),
        })
        .expect(401);
    });

    it('changes the PIN with step-up and signs other devices out', async () => {
      const tourist = await onboardTourist(e2e);
      const token = await stepUpWithPin(e2e, tourist, 'CHANGE_PIN');
      await e2e.http
        .post('/v1/me/pin/change')
        .set(tourist.auth)
        .set('X-Step-Up-Token', token)
        .send({ pin: '905173' })
        .expect(204);
      await e2e.http
        .post('/v1/me/pin/change')
        .set(tourist.auth)
        .set('X-Step-Up-Token', token)
        .send({ pin: '905174' })
        .expect(401);
      await e2e.http
        .post('/v1/auth/step-up')
        .set(tourist.auth)
        .send({ purpose: 'PAYMENT', method: 'PIN', pin: '905173' })
        .expect(201);
    });
  });

  describe('account deletion (FR-ONB-07)', () => {
    it('anonymises personal data, revokes sessions and keeps the audit trail', async () => {
      const tourist = await onboardTourist(e2e, 'delete-me@example.com');
      await e2e.http.delete('/v1/me').set(tourist.auth).expect(401);
      const token = await stepUpWithPin(e2e, tourist, 'DELETE_ACCOUNT');
      await e2e.http.delete('/v1/me').set(tourist.auth).set('X-Step-Up-Token', token).expect(204);
      await e2e.http.get('/v1/me').set(tourist.auth).expect(401);
      const row = await e2e.db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', tourist.userId)
        .executeTakeFirstOrThrow();
      expect(row).toMatchObject({
        status: 'DELETED',
        email: null,
        full_name: null,
        date_of_birth: null,
        pin_hash: null,
      });
      const consents = await e2e.db
        .selectFrom('consents')
        .select('id')
        .where('user_id', '=', tourist.userId)
        .execute();
      expect(consents).toHaveLength(2);
      // The same email can start over as a brand-new account (after the resend cooldown).
      e2e.clock.advance(31_000);
      const again = await signIn(e2e, 'delete-me@example.com');
      expect(again.userId).not.toBe(tourist.userId);
    });
  });

  describe('blocked accounts', () => {
    it('refuses sign-in and existing sessions', async () => {
      const tourist = await onboardTourist(e2e, 'blocked@example.com');
      await e2e.db
        .updateTable('users')
        .set({ status: 'BLOCKED', blocked_at: new Date(), blocked_reason: 'test' })
        .where('id', '=', tourist.userId)
        .execute();
      await e2e.http
        .get('/v1/me')
        .set(tourist.auth)
        .expect(403)
        .expect((response) => expect(response.body.error.code).toBe('ACCOUNT_BLOCKED'));
      e2e.clock.advance(31_000);
      const otp = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: 'blocked@example.com' })
        .expect(202);
      await e2e.http
        .post('/v1/auth/verify')
        .send({
          challengeId: otp.body.challengeId,
          otp: e2e.email.lastCodeFor('blocked@example.com'),
          deviceId: randomUUID(),
        })
        .expect(403);
    });
  });

  describe('error envelope', () => {
    it('returns stable codes with the correlation id and no internals', async () => {
      const response = await e2e.http
        .post('/v1/auth/verify')
        .set('X-Request-Id', 'corr-test-0001')
        .send({ challengeId: 'x' })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.requestId).toBe('corr-test-0001');
      expect(JSON.stringify(response.body)).not.toMatch(/stack|node_modules|SELECT/i);
      recordContract('error_validation', response.body);
    });
  });
});
