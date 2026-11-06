import { randomUUID } from 'node:crypto';
import { createE2eApp, E2eApp } from '../support/e2e-app';
import { recordContract } from '../support/contracts';
import {
  adminSession,
  completeThreeDs,
  lookupPayee,
  onboardTourist,
  settle,
  SignedInTourist,
  stepUpWithPin,
} from '../support/flows';

const WEB = 'http://localhost:3100';

describe('pre-launch website and web portal support (e2e)', () => {
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

  function join(body: Record<string, unknown>) {
    return e2e.http.post('/v1/launch/waitlist').send({ acceptPrivacy: true, ...body });
  }

  describe('waitlist', () => {
    it('joins once per email, sends one welcome email and answers repeats with the same spot', async () => {
      const first = await join({
        email: 'Ana.Silva@Example.com',
        fullName: '  Ana   Silva ',
        persona: 'VISITOR',
        countryCode: 'pt',
        source: 'hero',
      }).expect(201);
      recordContract('launch_waitlist_joined', first.body);
      expect(first.body).toEqual({
        referralCode: expect.stringMatching(/^[A-HJKMNP-Z2-9]{8}$/),
        position: 1,
        total: 1,
        referrals: 0,
        referralBoost: 5,
        shareUrl: `${WEB}/?ref=${first.body.referralCode}`,
        alreadyJoined: false,
      });

      const again = await join({ email: ' ana.silva@example.COM ' }).expect(200);
      expect(again.body).toMatchObject({
        referralCode: first.body.referralCode,
        position: 1,
        alreadyJoined: true,
      });

      await e2e.dispatcher.drain();
      const welcome = e2e.email.sent.filter((message) => message.to === 'ana.silva@example.com');
      expect(welcome).toHaveLength(1);
      expect(welcome[0]?.subject).toBe("You're #1 on the XenDirekt waitlist");
      expect(welcome[0]?.text).toContain('Hi Ana,');
      expect(welcome[0]?.text).toContain(`${WEB}/?ref=${first.body.referralCode}`);
      expect(welcome[0]?.text).toContain(`${WEB}/waitlist/${first.body.referralCode}`);
      expect(welcome[0]?.text).not.toContain('Silva');

      const row = await e2e.db.selectFrom('waitlist_entries').selectAll().executeTakeFirstOrThrow();
      expect(row).toMatchObject({
        email: 'ana.silva@example.com',
        full_name: 'Ana Silva',
        persona: 'VISITOR',
        country_code: 'PT',
        source: 'hero',
        privacy_version: '2026-10-01',
      });
      expect(row.welcome_sent_at).not.toBeNull();
    });

    it('writes the welcome email in French when asked', async () => {
      await join({ email: 'luc@example.fr', locale: 'fr' }).expect(201);
      await e2e.dispatcher.drain();
      expect(e2e.email.sent[0]?.subject).toBe("Vous êtes n° 1 sur la liste d'attente XenDirekt");
    });

    it('moves referrers up five places per friend who joins with their link', async () => {
      const codes: string[] = [];
      for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
        codes.push((await join({ email: `${name}@example.com` }).expect(201)).body.referralCode);
      }
      // f (6th) refers one friend: score 6 - 5 = 1 ties with a (1st); join order breaks the tie.
      const friend = await join({ email: 'friend@example.com', referralCode: codes[5] }).expect(
        201,
      );
      expect(friend.body.position).toBe(7);

      const f = await e2e.http.get(`/v1/launch/waitlist/${codes[5]}`).expect(200);
      recordContract('launch_waitlist_status', f.body);
      expect(f.body).toMatchObject({ position: 2, referrals: 1, total: 7 });
      const a = await e2e.http.get(`/v1/launch/waitlist/${codes[0]?.toLowerCase()}`).expect(200);
      expect(a.body.position).toBe(1);
      const b = await e2e.http.get(`/v1/launch/waitlist/${codes[1]}`).expect(200);
      expect(b.body.position).toBe(3);
    });

    it('ignores an unknown referral code and rejects a malformed one', async () => {
      await join({ email: 'x@example.com', referralCode: 'ABCDEFGH' }).expect(201);
      const row = await e2e.db
        .selectFrom('waitlist_entries')
        .select('referred_by')
        .executeTakeFirstOrThrow();
      expect(row.referred_by).toBeNull();
      const bad = await join({ email: 'y@example.com', referralCode: 'abc' }).expect(400);
      expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('requires consent and a valid email', async () => {
      await e2e.http.post('/v1/launch/waitlist').send({ email: 'ana@example.com' }).expect(400);
      await join({ email: 'not-an-email' }).expect(400);
      await e2e.http.get('/v1/launch/waitlist/NOPE').expect(404);
    });

    it('lets the person leave with the emailed token, which deletes the entry', async () => {
      const joined = await join({ email: 'leaver@example.com' }).expect(201);
      await e2e.dispatcher.drain();
      const text = e2e.email.sent[0]?.text ?? '';
      const token = /leave\?token=([0-9a-f-]+\.[0-9a-f]{32})/.exec(text)?.[1];
      expect(token).toBeDefined();

      // The public referral code is not a key to the entry.
      await e2e.http
        .post('/v1/launch/waitlist/leave')
        .send({ token: `${randomUUID()}.${'0'.repeat(32)}` })
        .expect(404);
      await e2e.http.post('/v1/launch/waitlist/leave').send({ token }).expect(204);
      await e2e.http.get(`/v1/launch/waitlist/${joined.body.referralCode}`).expect(404);
      await e2e.http.post('/v1/launch/waitlist/leave').send({ token }).expect(404);
      expect(await e2e.db.selectFrom('waitlist_entries').selectAll().execute()).toHaveLength(0);
    });

    it('shows operations a masked list unless the role may see personal data', async () => {
      await join({ email: 'ana.silva@example.com', fullName: 'Ana Silva' }).expect(201);
      const viewer = await adminSession(e2e, 'VIEWER');
      const masked = await e2e.http.get('/v1/admin/launch/waitlist').set(viewer.auth).expect(200);
      expect(masked.body.entries[0]).toMatchObject({
        email: 'a***@e***.com',
        fullName: 'A*** S***',
        position: 1,
      });
      const admin = await adminSession(e2e, 'ADMIN');
      const full = await e2e.http.get('/v1/admin/launch/waitlist').set(admin.auth).expect(200);
      expect(full.body).toMatchObject({
        total: 1,
        nextCursor: null,
        entries: [{ email: 'ana.silva@example.com', fullName: 'Ana Silva' }],
      });
      // Tourist tokens never reach admin routes.
      const tourist = await onboardTourist(e2e);
      await e2e.http.get('/v1/admin/launch/waitlist').set(tourist.auth).expect(401);
    });
  });

  describe('Hustle Check', () => {
    const worst = {
      persona: 'SENDER',
      lastTime: 'STUCK',
      speed: 'UNKNOWN',
      fees: 'UNKNOWN',
      checking: 'ALWAYS',
    };

    it('scores on the server and compares with everyone who answered before', async () => {
      const first = await e2e.http.post('/v1/launch/hustle-check').send(worst).expect(201);
      expect(first.body).toMatchObject({
        score: 100,
        tier: 'LEGEND',
        percentile: null,
        responses: 1,
        insights: null,
      });
      const calm = {
        persona: 'VISITOR',
        lastTime: 'SMOOTH',
        speed: 'SECONDS',
        fees: 'LOW',
        checking: 'NEVER',
      };
      for (let index = 0; index < 8; index += 1) {
        await e2e.http.post('/v1/launch/hustle-check').send(calm).expect(201);
      }
      const tenth = await e2e.http.post('/v1/launch/hustle-check').send(worst).expect(201);
      recordContract('launch_hustle_check_result', tenth.body);
      // 8 lower scores and 1 tie among the 9 others: (8 + 0.5) / 9 = 94%.
      expect(tenth.body).toMatchObject({ score: 100, percentile: 94, responses: 10 });
      expect(tenth.body.insights).toEqual({
        hitAWallPct: 20,
        unknownFeesPct: 20,
        alwaysCheckingPct: 20,
        waitDaysOrMorePct: 20,
      });
    });

    it('rejects answers that are not on the card', async () => {
      const response = await e2e.http
        .post('/v1/launch/hustle-check')
        .send({ ...worst, fees: 'A_LOT' })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('Wall of Hustle', () => {
    it('publishes a story only after a moderator approves it, with card numbers scrubbed', async () => {
      await e2e.http
        .post('/v1/launch/stories')
        .send({
          body: 'My card 4111 1111 1111 1111 got declined at a craft stall in Kigali.',
          countryCode: 'be',
          persona: 'VISITOR',
        })
        .expect(202, { status: 'PENDING' });
      expect((await e2e.http.get('/v1/launch/stories').expect(200)).body.stories).toEqual([]);

      const viewer = await adminSession(e2e, 'VIEWER');
      const queue = await e2e.http
        .get('/v1/admin/launch/stories?status=PENDING')
        .set(viewer.auth)
        .expect(200);
      expect(queue.body.stories).toHaveLength(1);
      const story = queue.body.stories[0];
      expect(story.body).toBe('My card [REDACTED_PAN] got declined at a craft stall in Kigali.');
      await e2e.http
        .patch(`/v1/admin/launch/stories/${story.id}`)
        .set(viewer.auth)
        .send({ status: 'APPROVED' })
        .expect(403);

      const support = await adminSession(e2e, 'SUPPORT_AGENT');
      await e2e.http
        .patch(`/v1/admin/launch/stories/${story.id}`)
        .set(support.auth)
        .send({ status: 'APPROVED', note: 'Good one' })
        .expect(200);
      const published = await e2e.http.get('/v1/launch/stories').expect(200);
      recordContract('launch_stories', published.body);
      expect(published.body.stories).toEqual([
        {
          id: story.id,
          body: 'My card [REDACTED_PAN] got declined at a craft stall in Kigali.',
          countryCode: 'BE',
          persona: 'VISITOR',
          createdAt: expect.any(String),
        },
      ]);
      const audit = await e2e.db
        .selectFrom('audit_logs')
        .selectAll()
        .where('action', '=', 'launch.story_moderated')
        .execute();
      expect(audit).toHaveLength(1);
    });

    it('rejects stories that are too short once whitespace is collapsed', async () => {
      await e2e.http
        .post('/v1/launch/stories')
        .send({ body: 'too          short        ' })
        .expect(400);
    });

    it('reports live counters', async () => {
      await join({ email: 'one@example.com' }).expect(201);
      await e2e.http
        .post('/v1/launch/hustle-check')
        .send({
          persona: 'DIASPORA',
          lastTime: 'DETOUR',
          speed: 'DAYS',
          fees: 'SOME',
          checking: 'OFTEN',
        })
        .expect(201);
      const stats = await e2e.http.get('/v1/launch/stats').expect(200);
      recordContract('launch_stats', stats.body);
      expect(stats.body).toEqual({
        waitlist: { total: 1 },
        hustleCheck: { responses: 1, averageScore: 58 },
        stories: { published: 0 },
      });
    });
  });

  describe('web portal clients', () => {
    async function signInOnWeb(email: string) {
      const otp = await e2e.http
        .post('/v1/auth/otp')
        .send({ channel: 'EMAIL', destination: email })
        .expect(202);
      return e2e.http
        .post('/v1/auth/verify')
        .send({
          challengeId: otp.body.challengeId,
          otp: e2e.email.lastCodeFor(email),
          deviceId: `web-${randomUUID()}`,
          platform: 'web',
        })
        .expect(200);
    }

    it('records web sessions with platform "web"', async () => {
      const verified = await signInOnWeb('web@example.com');
      const session = await e2e.db
        .selectFrom('sessions')
        .select('platform')
        .where('id', '=', verified.body.sessionId)
        .executeTakeFirstOrThrow();
      expect(session.platform).toBe('web');
    });

    it('returns from the hosted card page and 3-D Secure to the web portal', async () => {
      const tourist: SignedInTourist = await onboardTourist(e2e);
      const setup = await e2e.http
        .post('/v1/cards/setup')
        .set(tourist.auth)
        .send({ returnTo: 'WEB' })
        .expect(201);
      expect(setup.body.returnUrlPrefix).toBe(`${WEB}/app/cards/return`);
      const page = await e2e.http
        .post(new URL(setup.body.hostedUrl as string).pathname)
        .type('form')
        .send({ cardKey: 'visa-home' })
        .expect(303);
      expect(String(page.headers.location)).toMatch(
        /^http:\/\/localhost:3100\/app\/cards\/return\?setupId=/,
      );
      // Browsers apply form-action to the redirect after a form post.
      expect(String(page.headers['content-security-policy'])).toContain(
        "form-action 'self' http://localhost:3100",
      );
      const card = await e2e.http
        .post('/v1/cards')
        .set(tourist.auth)
        .send({ setupId: setup.body.setupId })
        .expect(201);

      const payee = await lookupPayee(e2e, tourist).expect(200);
      const quote = await e2e.http
        .post('/v1/quotes')
        .set(tourist.auth)
        .send({ payeeId: payee.body.payeeId, cardId: card.body.id, amountRwf: 12_000 })
        .expect(201);
      const stepUp = await stepUpWithPin(e2e, tourist, 'PAYMENT');
      const created = await e2e.http
        .post('/v1/payments')
        .set(tourist.auth)
        .set('Idempotency-Key', `web-${randomUUID()}`)
        .set('X-Step-Up-Token', stepUp)
        .send({ quoteId: quote.body.quoteId, returnTo: 'WEB' })
        .expect(201);
      await settle(e2e, tourist, created.body.id, { until: ['AUTH_PENDING'] });
      await e2e.dispatcher.drain();
      const action = (await e2e.http.get(`/v1/payments/${created.body.id}`).set(tourist.auth)).body;
      expect(action.nextAction).toMatchObject({
        type: 'THREE_DS',
        returnUrlPrefix: `${WEB}/app/payments/return`,
      });
      const approved = await completeThreeDs(e2e, action.nextAction.url, 'approve');
      expect(approved.headers.location).toBe(
        `${WEB}/app/payments/return?paymentId=${created.body.id}`,
      );
      expect((await settle(e2e, tourist, created.body.id)).state).toBe('COMPLETED');
    });

    it('keeps the app deep links for app clients', async () => {
      const tourist = await onboardTourist(e2e);
      const setup = await e2e.http.post('/v1/cards/setup').set(tourist.auth).expect(201);
      expect(setup.body.returnUrlPrefix).toBe('xendirekt-app://card-setup/return');
    });
  });
});
