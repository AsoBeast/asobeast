import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import request from 'supertest';
import { QUEUES } from '../../src/jobs/jobs.types';
import { createIsolationFixture, IsolationFixture } from './fixture';

describe('Adversarial isolation attempts', () => {
  let fixture: IsolationFixture;

  const anonymous = () => request(fixture.app.getHttpServer());

  const jobIds = async (): Promise<string[]> => {
    const queues = [QUEUES.APP_STORE, QUEUES.GPLAY].map((name) =>
      fixture.app.get<Queue>(getQueueToken(name), { strict: false }),
    );
    const jobs = await Promise.all(
      queues.map((queue) =>
        queue.getJobs(['wait', 'paused', 'delayed', 'waiting-children']),
      ),
    );
    return jobs
      .flat()
      .map((job) => job.id ?? '')
      .sort();
  };

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it('answers the same 404 for a guessed id as for a real one it does not own', async () => {
    const guessed = await fixture.a.agent.get('/apps/cmnotarealappid00000000');
    const real = await fixture.a.agent.get(`/apps/${fixture.b.appleAppId}`);

    expect(guessed.status).toBe(404);
    expect(real.status).toBe(404);
  });

  it('ignores a workspace named in a query string', async () => {
    const response = await fixture.a.agent
      .get('/apps')
      .query({ workspaceId: fixture.b.id })
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain(fixture.b.appleAppId);
  });

  it('ignores a workspace named in a header', async () => {
    const response = await fixture.a.agent
      .get('/apps')
      .set('X-Workspace-Id', fixture.b.id)
      .set('X-Workspace', fixture.b.id)
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain(fixture.b.appleAppId);
  });

  it('refuses a cross-tenant id nested inside an object the validator sees last', async () => {
    await fixture.a.agent
      .patch(
        `/apps/${fixture.a.appleAppId}/keywords/${fixture.b.privateKeywordId}`,
      )
      .send({ active: false })
      .expect(404);

    const untouched = await fixture.db.trackedKeyword.findFirstOrThrow({
      where: { keywordId: fixture.b.privateKeywordId },
      select: { active: true },
    });
    expect(untouched.active).toBe(true);
  });

  it('refuses to remove a keyword tracked by the other workspace', async () => {
    await fixture.a.agent
      .delete(`/apps/${fixture.b.appleAppId}/keywords/${fixture.b.keywordId}`)
      .expect(404);

    await expect(
      fixture.db.trackedKeyword.count({
        where: { appId: fixture.b.appleAppId, keywordId: fixture.b.keywordId },
      }),
    ).resolves.toBe(1);
  });

  it('keeps a shared keyword read from naming the other workspace apps', async () => {
    const response = await fixture.a.agent
      .get(`/keywords/${fixture.a.keywordId}/serp`)
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain(fixture.b.appleAppId);
  });

  it('refuses a serp read for a keyword the caller does not track', async () => {
    await fixture.db.serpEntry.create({
      data: {
        keywordId: fixture.b.privateKeywordId,
        date: new Date('2026-01-01T00:00:00.000Z'),
        position: 1,
        storeAppId: 'secret-store-app',
        title: 'Secret listing',
      },
    });

    const response = await fixture.a.agent.get(
      `/keywords/${fixture.b.privateKeywordId}/serp`,
    );

    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain('secret-store-app');
  });

  it('refuses an on-demand score for a keyword the caller does not track', async () => {
    const before = await jobIds();

    await fixture.a.agent
      .post(`/keywords/${fixture.b.privateKeywordId}/score`)
      .expect(404);

    const after = await jobIds();
    expect(after).toEqual(before);
    expect(after.some((id) => id.includes(fixture.b.privateKeywordId))).toBe(
      false,
    );
  });

  it('refuses a ranking that claims one workspace while pointing at another app', async () => {
    await expect(
      fixture.db.keywordRanking.create({
        data: {
          appId: fixture.b.appleAppId,
          workspaceId: fixture.a.id,
          keywordId: fixture.a.keywordId,
          date: new Date('2020-02-02T00:00:00.000Z'),
          position: 1,
          depth: 200,
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses an action that claims one workspace while pointing at another app', async () => {
    await expect(
      fixture.db.actionItem.create({
        data: {
          workspaceId: fixture.a.id,
          appId: fixture.b.appleAppId,
          rule: 'keyword.defend',
          category: 'regression',
          store: 'APP_STORE',
          country: 'us',
          fingerprint: 'mismatched-ownership',
          status: 'OPEN',
          priority: 'high',
          impact: 60,
          formulaVersion: 'v1',
          evidence: {},
          lastSeenAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses a competitor whose primary app belongs to the other workspace', async () => {
    await expect(
      fixture.db.app.create({
        data: {
          workspaceId: fixture.a.id,
          store: 'APP_STORE',
          storeAppId: 'smuggled-competitor',
          country: 'us',
          isCompetitor: true,
          primaryAppId: fixture.b.appleAppId,
        },
      }),
    ).rejects.toThrow();
  });

  it('survives a delete racing a read from the other workspace', async () => {
    const [deleted, read] = await Promise.all([
      fixture.b.agent.delete(`/apps/${fixture.b.playAppId}`),
      fixture.a.agent.get('/apps'),
    ]);

    expect(deleted.status).toBe(204);
    expect(read.status).toBe(200);
    expect(JSON.stringify(read.body)).not.toContain(fixture.b.playAppId);
    await expect(
      fixture.db.app.count({ where: { workspaceId: fixture.a.id } }),
    ).resolves.toBeGreaterThan(0);
  });

  it('cannot register a second account into an existing workspace', async () => {
    const response = await anonymous().post('/auth/register').send({
      email: 'intruder@example.com',
      password: 'supersecret1',
      workspaceId: fixture.a.id,
    });

    expect([400, 403]).toContain(response.status);
    await expect(
      fixture.db.user.count({ where: { workspaceId: fixture.a.id } }),
    ).resolves.toBe(1);
  });

  it('refuses an expired session even when a valid token exists', async () => {
    await fixture.db.user.update({
      where: { id: fixture.b.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    await fixture.b.agent.get('/apps').expect(401);
    await anonymous()
      .get('/apps')
      .set('Authorization', `Bearer ${fixture.b.token}`)
      .expect(200);
  });

  it('exports only the caller workspace rows while the other workspace writes', async () => {
    const [exported] = await Promise.all([
      fixture.a.agent.get(`/apps/${fixture.a.appleAppId}/rankings`).expect(200),
      fixture.db.keywordRanking.create({
        data: {
          appId: fixture.b.appleAppId,
          workspaceId: fixture.b.id,
          keywordId: fixture.b.keywordId,
          date: new Date('2020-01-01T00:00:00.000Z'),
          position: 99,
          depth: 200,
        },
      }),
    ]);

    const positions = (
      exported.body as { series: { points: { position: number | null }[] }[] }
    ).series.flatMap((serie) => serie.points.map((point) => point.position));

    expect(positions).not.toContain(99);
  });
});
