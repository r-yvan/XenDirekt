import { totpAt, totpStep } from '../../src/shared/crypto/totp';
import { AdminAuthService } from '../../src/modules/admin/admin-auth.service';
import { createE2eApp, E2eApp } from '../support/e2e-app';
import { signIn } from '../support/flows';

export async function adminSession(
  e2e: E2eApp,
  role: 'VIEWER' | 'SUPPORT_AGENT' | 'RISK_ANALYST' | 'ADMIN',
  email = `${role.toLowerCase()}@xendirekt.test`,
) {
  const created = await e2e.app
    .get(AdminAuthService)
    .createAdmin({ email, fullName: `${role} User`, role, createdBy: 'test' });
  const login = await e2e.http
    .post('/v1/admin/auth/login')
    .send({ email, password: created.initialPassword })
    .expect(200);
  const tokens = await e2e.http
    .post('/v1/admin/auth/totp')
    .send({
      challengeToken: login.body.challengeToken,
      totp: totpAt(created.totpSecret, totpStep(e2e.clock.now())),
    })
    .expect(200);
  return {
    ...created,
    accessToken: tokens.body.accessToken as string,
    auth: { Authorization: `Bearer ${tokens.body.accessToken}` },
  };
}

describe('admin identity (e2e)', () => {
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

  it('requires password and TOTP, and rejects a replayed TOTP code', async () => {
    const created = await e2e.app.get(AdminAuthService).createAdmin({
      email: 'ops@xendirekt.test',
      fullName: 'Ops',
      role: 'ADMIN',
      createdBy: 'test',
    });
    const code = totpAt(created.totpSecret, totpStep(e2e.clock.now()));

    const first = await e2e.http
      .post('/v1/admin/auth/login')
      .send({ email: 'ops@xendirekt.test', password: created.initialPassword })
      .expect(200);
    await e2e.http
      .post('/v1/admin/auth/totp')
      .send({ challengeToken: first.body.challengeToken, totp: code })
      .expect(200);

    const second = await e2e.http
      .post('/v1/admin/auth/login')
      .send({ email: 'ops@xendirekt.test', password: created.initialPassword })
      .expect(200);
    await e2e.http
      .post('/v1/admin/auth/totp')
      .send({ challengeToken: second.body.challengeToken, totp: code })
      .expect(401)
      .expect((response) => expect(response.body.error.code).toBe('INVALID_CREDENTIALS'));
  });

  it('gives the same answer for unknown emails and wrong passwords, and locks after five failures', async () => {
    const created = await e2e.app.get(AdminAuthService).createAdmin({
      email: 'lock@xendirekt.test',
      fullName: 'Lock',
      role: 'VIEWER',
      createdBy: 'test',
    });
    const unknown = await e2e.http
      .post('/v1/admin/auth/login')
      .send({ email: 'nobody@xendirekt.test', password: 'wrong-password' })
      .expect(401);
    const wrong = await e2e.http
      .post('/v1/admin/auth/login')
      .send({ email: 'lock@xendirekt.test', password: 'wrong-password' })
      .expect(401);
    expect(unknown.body.error.code).toBe(wrong.body.error.code);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await e2e.http
        .post('/v1/admin/auth/login')
        .send({ email: 'lock@xendirekt.test', password: 'wrong-password' })
        .expect(401);
    }
    await e2e.http
      .post('/v1/admin/auth/login')
      .send({ email: 'lock@xendirekt.test', password: created.initialPassword })
      .expect(401);
  });

  it('enforces role permissions on the server (scenario 15)', async () => {
    const viewer = await adminSession(e2e, 'VIEWER');
    await e2e.http.get('/v1/admin/me').set(viewer.auth).expect(200);
    await e2e.http
      .get('/v1/admin/admin-users')
      .set(viewer.auth)
      .expect(403)
      .expect((response) => expect(response.body.error.code).toBe('FORBIDDEN'));
    await e2e.http
      .post('/v1/admin/admin-users')
      .set(viewer.auth)
      .send({ email: 'x@xendirekt.test', fullName: 'X', role: 'ADMIN' })
      .expect(403);
  });

  it('applies role changes and disabling immediately, and admins cannot change themselves', async () => {
    const admin = await adminSession(e2e, 'ADMIN');
    const analyst = await adminSession(e2e, 'RISK_ANALYST');
    await e2e.http
      .patch(`/v1/admin/admin-users/${admin.id}`)
      .set(admin.auth)
      .send({ role: 'VIEWER' })
      .expect(403);
    await e2e.http
      .patch(`/v1/admin/admin-users/${analyst.id}`)
      .set(admin.auth)
      .send({ status: 'DISABLED' })
      .expect(200);
    await e2e.http.get('/v1/admin/me').set(analyst.auth).expect(401);
    const audit = await e2e.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('action', '=', 'admin.updated')
      .executeTakeFirstOrThrow();
    expect(audit.actor_id).toBe(admin.id);
    expect(audit.before).toMatchObject({ status: 'ACTIVE' });
  });

  it('never accepts a tourist token on admin routes, or an admin token on tourist routes', async () => {
    const tourist = await signIn(e2e, 'tourist@example.com');
    const admin = await adminSession(e2e, 'ADMIN');
    await e2e.http.get('/v1/admin/me').set(tourist.auth).expect(401);
    await e2e.http.get('/v1/me').set(admin.auth).expect(401);
  });
});
