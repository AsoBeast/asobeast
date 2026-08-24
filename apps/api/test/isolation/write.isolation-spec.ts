import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '../../src/jobs/jobs.types';
import { createIsolationFixture, IsolationFixture } from './fixture';

describe('Write isolation', () => {
  let fixture: IsolationFixture;

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it('refuses a body that tries to name its own workspace', async () => {
    await fixture.a.agent
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/smuggled',
        events: ['rank.dropped'],
        workspaceId: fixture.b.id,
      })
      .expect(400);

    await expect(
      fixture.db.webhook.count({ where: { workspaceId: fixture.b.id } }),
    ).resolves.toBe(1);
  });

  it('stamps the caller workspace on a create that names none', async () => {
    const created = await fixture.a.agent
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/scoped',
        events: ['rank.dropped'],
      })
      .expect(201);

    const row = await fixture.db.webhook.findUniqueOrThrow({
      where: { id: (created.body as { id: string }).id },
      select: { workspaceId: true },
    });

    expect(row.workspaceId).toBe(fixture.a.id);
  });

  it('answers 404 and changes nothing when updating another workspace webhook', async () => {
    const before = await fixture.db.webhook.findUniqueOrThrow({
      where: { id: fixture.b.webhookId },
    });

    await fixture.a.agent
      .patch(`/webhooks/${fixture.b.webhookId}`)
      .send({ url: 'https://hooks.example.com/hijacked' })
      .expect(404);

    const after = await fixture.db.webhook.findUniqueOrThrow({
      where: { id: fixture.b.webhookId },
    });
    expect(after.url).toBe(before.url);
  });

  it('answers 404 and leaves the row when deleting another workspace webhook', async () => {
    await fixture.a.agent
      .delete(`/webhooks/${fixture.b.webhookId}`)
      .expect(404);

    await expect(
      fixture.db.webhook.count({ where: { id: fixture.b.webhookId } }),
    ).resolves.toBe(1);
  });

  it('answers 404 and leaves the row when deleting another workspace app', async () => {
    await fixture.a.agent.delete(`/apps/${fixture.b.appleAppId}`).expect(404);

    await expect(
      fixture.db.app.count({ where: { id: fixture.b.appleAppId } }),
    ).resolves.toBe(1);
  });

  it('answers 404 when updating another workspace action', async () => {
    await fixture.a.agent
      .patch(`/actions/${fixture.b.actionId}`)
      .send({ status: 'DISMISSED' })
      .expect(404);

    const after = await fixture.db.actionItem.findUniqueOrThrow({
      where: { id: fixture.b.actionId },
      select: { status: true },
    });
    expect(after.status).toBe('OPEN');
  });

  it('refuses to attach a competitor to another workspace app', async () => {
    const before = await fixture.db.app.count({
      where: { primaryAppId: fixture.b.appleAppId },
    });

    await fixture.a.agent
      .post(`/apps/${fixture.b.appleAppId}/competitors`)
      .send({ url: 'https://apps.apple.com/us/app/rival/id999999999' })
      .expect(404);

    await expect(
      fixture.db.app.count({ where: { primaryAppId: fixture.b.appleAppId } }),
    ).resolves.toBe(before);
  });

  it('refuses to add a keyword to another workspace app', async () => {
    await fixture.a.agent
      .post(`/apps/${fixture.b.appleAppId}/keywords`)
      .send({ keywords: ['smuggled phrase'] })
      .expect(404);

    await expect(
      fixture.db.trackedKeyword.count({
        where: {
          app: { workspaceId: fixture.b.id },
          keyword: { text: 'smuggled phrase' },
        },
      }),
    ).resolves.toBe(0);
  });

  it('fails a mixed-ownership link outright rather than partially applying', async () => {
    await fixture.a.agent
      .post(`/apps/${fixture.a.appleAppId}/link`)
      .send({ appId: fixture.b.playAppId })
      .expect(404);

    const [ours, theirs] = await Promise.all([
      fixture.db.app.findUniqueOrThrow({
        where: { id: fixture.a.appleAppId },
        select: { groupId: true },
      }),
      fixture.db.app.findUniqueOrThrow({
        where: { id: fixture.b.playAppId },
        select: { groupId: true },
      }),
    ]);
    expect(ours.groupId).toBeNull();
    expect(theirs.groupId).toBeNull();
    await expect(fixture.db.appGroup.count()).resolves.toBe(0);
  });

  it('refuses to remove a competitor through another workspace app', async () => {
    await fixture.a.agent
      .delete(
        `/apps/${fixture.b.appleAppId}/competitors/${fixture.b.competitorId}`,
      )
      .expect(404);

    await expect(
      fixture.db.app.count({ where: { id: fixture.b.competitorId } }),
    ).resolves.toBe(1);
  });

  it('refuses to write the keyword field of another workspace app', async () => {
    await fixture.a.agent
      .put(`/apps/${fixture.b.appleAppId}/keyword-field`)
      .send({ text: 'smuggled,field' })
      .expect(404);
  });

  it('flushes only the caller outbox and reports only its own counts', async () => {
    for (const workspace of [fixture.a, fixture.b]) {
      await fixture.db.alertEvent.create({
        data: {
          workspaceId: workspace.id,
          event: 'metadata.changed',
          appId: workspace.appleAppId,
          dedupeKey: `${workspace.id}-manual-flush`,
          payload: {
            event: 'metadata.changed',
            occurredAt: new Date().toISOString(),
            app: { id: workspace.appleAppId, name: workspace.id },
            changes: [{ field: 'title', before: 'Old', after: workspace.id }],
          },
        },
      });
    }

    const response = await fixture.a.agent.post('/alerts/flush').expect(201);

    expect(response.body).toMatchObject({ flushed: 1 });
    await expect(
      fixture.db.alertEvent.count({
        where: { workspaceId: fixture.b.id, flushedAt: { not: null } },
      }),
    ).resolves.toBe(0);
  });

  it('queues an action run that names only the caller workspace', async () => {
    const response = await fixture.a.agent.post('/actions/run').expect(202);

    const { jobId } = response.body as { jobId: string };
    expect(jobId).toContain(fixture.a.id);
    expect(jobId).not.toContain(fixture.b.id);

    const job = await fixture.app
      .get<Queue>(getQueueToken(QUEUES.PIPELINE), { strict: false })
      .getJob(jobId);
    expect((job?.data as { workspaceId: string }).workspaceId).toBe(
      fixture.a.id,
    );
  });

  it('cannot move a user into another workspace through any account route', async () => {
    await fixture.a.agent
      .post('/auth/password')
      .send({
        current: 'supersecret1',
        next: 'supersecret2',
        workspaceId: fixture.b.id,
      })
      .expect(400);

    await fixture.a.agent
      .post('/auth/password')
      .send({ current: 'supersecret1', next: 'supersecret2' })
      .expect(200);

    const user = await fixture.db.user.findUniqueOrThrow({
      where: { id: fixture.a.userId },
      select: { workspaceId: true },
    });
    expect(user.workspaceId).toBe(fixture.a.id);
  });
});
