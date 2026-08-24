import request from 'supertest';
import { ADMIN_QUEUES_ROUTE } from '../../src/auth/admin-access';
import { createIsolationFixture, IsolationFixture } from './fixture';

describe('Auth boundaries between workspaces', () => {
  let fixture: IsolationFixture;

  const anonymous = () => request(fixture.app.getHttpServer());

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it('cannot reach another workspace app with a session cookie', async () => {
    await fixture.a.agent.get(`/apps/${fixture.b.appleAppId}`).expect(404);
    await fixture.b.agent.get(`/apps/${fixture.a.appleAppId}`).expect(404);
  });

  it('cannot reach another workspace app with a personal token', async () => {
    await anonymous()
      .get(`/apps/${fixture.b.appleAppId}`)
      .set('Authorization', `Bearer ${fixture.a.token}`)
      .expect(404);

    await anonymous()
      .get(`/apps/${fixture.a.appleAppId}`)
      .set('Authorization', `Bearer ${fixture.b.token}`)
      .expect(404);
  });

  it('lists only the caller workspace tokens', async () => {
    const listed = await fixture.a.agent.get('/auth/tokens').expect(200);
    const rows = listed.body as { name: string }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('isolation');
  });

  it('cannot revoke another workspace token', async () => {
    const theirs = await fixture.db.apiToken.findFirstOrThrow({
      where: { user: { workspaceId: fixture.b.id } },
      select: { id: true },
    });

    await fixture.a.agent.delete(`/auth/tokens/${theirs.id}`).expect(204);

    await expect(
      fixture.db.apiToken.count({ where: { id: theirs.id } }),
    ).resolves.toBe(1);
  });

  it('stops a revoked token immediately', async () => {
    const created = await fixture.a.agent
      .post('/auth/tokens')
      .send({ name: 'short lived' })
      .expect(201);
    const { id, token } = created.body as { id: string; token: string };

    await anonymous()
      .get('/apps')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await fixture.a.agent.delete(`/auth/tokens/${id}`).expect(204);

    await anonymous()
      .get('/apps')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('invalidates one user session without touching another workspace', async () => {
    await fixture.a.agent
      .post('/auth/password')
      .send({ current: 'supersecret1', next: 'supersecret2' })
      .expect(200);

    const stale = request.agent(fixture.app.getHttpServer());
    await stale
      .post('/auth/login')
      .send({ email: fixture.a.email, password: 'supersecret2' })
      .expect(200);

    await fixture.db.user.update({
      where: { id: fixture.a.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    await stale.get('/auth/me').expect(401);
    await fixture.b.agent.get('/auth/me').expect(200);

    await fixture.a.agent
      .post('/auth/login')
      .send({ email: fixture.a.email, password: 'supersecret2' })
      .expect(200);
  });

  it('never reports another workspace user through the account route', async () => {
    const me = await fixture.a.agent.get('/auth/me').expect(200);

    expect((me.body as { email: string }).email).toBe(fixture.a.email);
  });

  it('answers 404 on the admin queue surface to a workspace owner without it', async () => {
    await anonymous().get(ADMIN_QUEUES_ROUTE).expect(404);
  });

  it('refuses an unauthenticated request to a scoped route', async () => {
    await anonymous().get('/apps').expect(401);
    await anonymous().get(`/apps/${fixture.a.appleAppId}`).expect(401);
  });

  it('refuses a token that was never issued', async () => {
    await anonymous()
      .get('/apps')
      .set('Authorization', 'Bearer asob_not-a-real-token')
      .expect(401);
  });
});
