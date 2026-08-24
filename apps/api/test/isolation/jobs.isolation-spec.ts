import { getQueueToken } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { AlertFlushService } from '../../src/alerts/alert-flush.service';
import { AuditService } from '../../src/audit/audit.service';
import { JobWorkspaceMissingError } from '../../src/jobs/job-workspace';
import { QUEUES } from '../../src/jobs/jobs.types';
import { PipelineService } from '../../src/jobs/pipeline.service';
import { RetentionService } from '../../src/jobs/retention.service';
import { StoreJobsHandler } from '../../src/jobs/store-jobs.handler';
import { createIsolationFixture, IsolationFixture } from './fixture';

interface AlertBatchJob {
  workspaceId: string;
  webhookId?: string;
  payload: { apps?: { id: string }[] };
}

describe('Job isolation', () => {
  let fixture: IsolationFixture;

  const queue = (name: string): Queue =>
    fixture.app.get<Queue>(getQueueToken(name), { strict: false });

  const jobsOn = (name: string): Promise<Job[]> =>
    queue(name).getJobs(['wait', 'paused', 'delayed', 'waiting-children']);

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it('stamps every daily child with the workspace that scheduled it', async () => {
    await fixture.app.get(PipelineService).fanOutDaily();

    const children = [
      ...(await jobsOn(QUEUES.APP_STORE)),
      ...(await jobsOn(QUEUES.GPLAY)),
    ];
    const byWorkspace = new Map<string, number>();
    for (const job of children) {
      const { workspaceId } = job.data as { workspaceId: string };
      expect([fixture.a.id, fixture.b.id]).toContain(workspaceId);
      byWorkspace.set(workspaceId, (byWorkspace.get(workspaceId) ?? 0) + 1);
    }

    expect(byWorkspace.get(fixture.a.id)).toBeGreaterThan(0);
    expect(byWorkspace.get(fixture.b.id)).toBeGreaterThan(0);
  });

  it('keeps a refresh job pointed at its own workspace app', async () => {
    const refreshes = (await jobsOn(QUEUES.APP_STORE))
      .filter((job) => job.name === 'refresh-app')
      .map((job) => job.data as { appId: string; workspaceId: string });

    for (const job of refreshes) {
      const app = await fixture.db.app.findUniqueOrThrow({
        where: { id: job.appId },
        select: { workspaceId: true },
      });
      expect(app.workspaceId).toBe(job.workspaceId);
    }
  });

  it('fails a store job whose payload carries no workspace', async () => {
    const handler = fixture.app.get(StoreJobsHandler);

    await expect(
      handler.handle({
        name: 'refresh-app',
        id: '1',
        data: { appId: fixture.a.appleAppId },
      } as Job),
    ).rejects.toThrow(JobWorkspaceMissingError);
  });

  it('delivers one alert batch per workspace, each carrying only its own apps', async () => {
    for (const workspace of [fixture.a, fixture.b]) {
      await fixture.db.alertEvent.create({
        data: {
          workspaceId: workspace.id,
          event: 'metadata.changed',
          appId: workspace.appleAppId,
          dedupeKey: `${workspace.id}-metadata`,
          payload: {
            event: 'metadata.changed',
            occurredAt: new Date().toISOString(),
            app: { id: workspace.appleAppId, name: workspace.id },
            changes: [{ field: 'title', before: 'Old', after: workspace.id }],
          },
        },
      });
    }

    const result = await fixture.app
      .get(AlertFlushService)
      .flushEveryWorkspace();
    expect(result.flushed).toBe(2);

    const delivered = (await jobsOn(QUEUES.ALERTS)).map(
      (job) => job.data as AlertBatchJob,
    );
    expect(delivered.length).toBeGreaterThan(0);

    for (const job of delivered) {
      const owner = job.workspaceId === fixture.a.id ? fixture.a : fixture.b;
      const stranger = job.workspaceId === fixture.a.id ? fixture.b : fixture.a;

      expect(JSON.stringify(job.payload)).toContain(owner.appleAppId);
      expect(JSON.stringify(job.payload)).not.toContain(stranger.appleAppId);
    }
  });

  it('targets each webhook from its own workspace only', async () => {
    const delivered = (await jobsOn(QUEUES.ALERTS)).map(
      (job) => job.data as AlertBatchJob,
    );

    for (const job of delivered) {
      if (!job.webhookId) continue;
      const webhook = await fixture.db.webhook.findUniqueOrThrow({
        where: { id: job.webhookId },
        select: { workspaceId: true },
      });
      expect(webhook.workspaceId).toBe(job.workspaceId);
    }
  });

  it('snapshots an audit score into each workspace separately', async () => {
    const before = await fixture.db.auditScore.count();

    await fixture.app.get(AuditService).snapshotAll();

    const rows = await fixture.db.auditScore.findMany({
      select: { app: { select: { workspaceId: true } } },
    });
    expect(rows.length).toBeGreaterThanOrEqual(before);
    expect(new Set(rows.map((row) => row.app.workspaceId))).toEqual(
      new Set([fixture.a.id, fixture.b.id]),
    );
  });

  it('cannot mint one action fingerprint for two workspaces tracking the same app', async () => {
    const fingerprints = await fixture.db.actionItem.findMany({
      select: { workspaceId: true, fingerprint: true, appId: true },
    });

    expect(new Set(fingerprints.map((row) => row.appId)).size).toBe(
      fingerprints.length,
    );
    expect(new Set(fingerprints.map((row) => row.workspaceId))).toEqual(
      new Set([fixture.a.id, fixture.b.id]),
    );
  });

  it('gives each workspace its own category job so neither is deduplicated away', async () => {
    const categories = [
      ...(await jobsOn(QUEUES.APP_STORE)),
      ...(await jobsOn(QUEUES.GPLAY)),
    ].filter((job) => job.name === 'check-category');

    const owners = categories.map(
      (job) => (job.data as { workspaceId: string }).workspaceId,
    );
    expect(new Set(owners)).toEqual(new Set([fixture.a.id, fixture.b.id]));
    for (const job of categories) {
      const { workspaceId } = job.data as { workspaceId: string };
      expect(job.id).toContain(workspaceId);
    }
    expect(new Set(categories.map((job) => job.id)).size).toBe(
      categories.length,
    );
  });

  it('prunes both workspaces by age without touching the wrong rows', async () => {
    const before = await fixture.db.keywordRanking.groupBy({
      by: ['workspaceId'],
      _count: { _all: true },
    });

    await fixture.app.get(RetentionService).prune();

    const after = await fixture.db.keywordRanking.groupBy({
      by: ['workspaceId'],
      _count: { _all: true },
    });
    expect(after).toEqual(before);
  });
});
