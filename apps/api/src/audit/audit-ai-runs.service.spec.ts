import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { AuditAiRunsService } from './audit-ai-runs.service';
import { AuditService } from './audit.service';
import {
  CreativeInputs,
  creativeFingerprint,
} from './creative/creative-observations';
import { RUN_NOT_QUEUED_MESSAGE, StoredRun } from './audit-run-state';

const NOW = new Date('2026-09-17T14:00:00.000Z');
const EARLIER = new Date('2026-09-17T13:50:00.000Z');
const WORKSPACE = 'ws-1';
const MODEL = 'gpt-5.6-luna';

const INPUTS: CreativeInputs = {
  store: 'APP_STORE',
  country: 'us',
  title: 'Where Am I?',
  iconUrl: 'https://cdn/icon.png',
  screenshotUrls: ['s1.png'],
  competitorIconUrls: [],
};

const FINGERPRINT = creativeFingerprint(INPUTS, MODEL);

const minutesAgo = (minutes: number): Date =>
  new Date(NOW.getTime() - minutes * 60_000);

interface Options {
  app?: { id: string; isCompetitor: boolean } | null;
  configured?: boolean;
  inputs?: Partial<CreativeInputs>;
  insight?: Partial<StoredRun & { inputHash: string | null }> | null;
}

const build = (options: Options = {}) => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    auditInsight: {
      findUnique: jest.fn().mockResolvedValue(
        options.insight === undefined || options.insight === null
          ? null
          : {
              runState: 'completed',
              runError: null,
              requestedAt: null,
              generatedAt: null,
              inputHash: null,
              ...options.insight,
            },
      ),
      upsert: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const loader = {
    app: jest.fn().mockImplementation(() => {
      const app =
        options.app === undefined
          ? { id: 'a', isCompetitor: false }
          : options.app;
      if (app === null) {
        throw new NotFoundException('App a not found');
      }
      return Promise.resolve(app);
    }),
    creativeInputs: jest
      .fn()
      .mockResolvedValue({ ...INPUTS, ...options.inputs }),
  };
  const auditAi = {
    model: options.configured === false ? null : MODEL,
    observe: jest.fn(),
  };
  const audit = { recordToday: jest.fn().mockResolvedValue(undefined) };
  const workspace = {
    scopeFor: jest.fn().mockReturnValue({ workspaceId: WORKSPACE }),
  };
  const service = new AuditAiRunsService(
    prisma as unknown as PrismaService,
    loader as unknown as AuditContextLoader,
    auditAi as unknown as AuditAiService,
    audit as unknown as AuditService,
    workspace as unknown as WorkspaceContext,
    queue as unknown as Queue,
  );
  return { service, queue, prisma, loader, auditAi, audit };
};

describe('AuditAiRunsService.request', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('refuses an unknown app', async () => {
    await expect(
      build({ app: null }).service.request('x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a competitor row', async () => {
    await expect(
      build({ app: { id: 'a', isCompetitor: true } }).service.request('a'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses without a key', async () => {
    await expect(
      build({ configured: false }).service.request('a'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a listing with nothing to analyze', async () => {
    await expect(
      build({
        inputs: { iconUrl: null, screenshotUrls: [] },
      }).service.request('a'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('reuses a completed analysis of the same creative without queuing', async () => {
    const { service, queue } = build({
      insight: {
        runState: 'completed',
        inputHash: FINGERPRINT,
        generatedAt: EARLIER,
      },
    });

    await expect(service.request('a')).resolves.toEqual({
      state: 'completed',
      reused: true,
      requestedAt: null,
      finishedAt: EARLIER.toISOString(),
      error: null,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns an active run younger than 10 minutes without queuing another', async () => {
    const { service, queue } = build({
      insight: { runState: 'running', requestedAt: minutesAgo(9) },
    });

    await expect(service.request('a')).resolves.toMatchObject({
      state: 'running',
      reused: false,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues one deduplicated job otherwise', async () => {
    const { service, queue, prisma } = build({
      insight: { runState: 'failed', requestedAt: minutesAgo(30) },
    });

    await expect(service.request('a')).resolves.toMatchObject({
      state: 'queued',
      reused: false,
      requestedAt: NOW.toISOString(),
    });
    const [[queuedUpsert]] = prisma.auditInsight.upsert.mock.calls as Array<
      [{ update: Record<string, unknown> }]
    >;
    expect(queuedUpsert.update).toEqual({
      runState: 'queued',
      requestedAt: NOW,
      runError: null,
    });
    expect(queue.add).toHaveBeenCalledWith(
      JOBS.AUDIT_CREATIVE,
      { workspaceId: WORKSPACE, appId: 'a' },
      expect.objectContaining({
        deduplication: { id: 'audit-creative~a', keepLastIfActive: true },
        attempts: 2,
      }),
    );
  });

  it('fails the queued run and rethrows when the job cannot be queued', async () => {
    const { service, queue, prisma } = build();
    const outage = new Error('redis unavailable');
    queue.add.mockRejectedValue(outage);

    await expect(service.request('a')).rejects.toBe(outage);
    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith({
      where: { appId: 'a', requestedAt: NOW, runState: 'queued' },
      data: { runState: 'failed', runError: RUN_NOT_QUEUED_MESSAGE },
    });
  });

  it('rethrows the queue error when the run cannot be marked failed', async () => {
    const { service, queue, prisma } = build();
    const outage = new Error('redis unavailable');
    queue.add.mockRejectedValue(outage);
    prisma.auditInsight.updateMany.mockRejectedValue(new Error('db down'));

    await expect(service.request('a')).rejects.toBe(outage);
  });

  it('queues again for a completed analysis of changed creative', async () => {
    const { service, queue } = build({
      insight: {
        runState: 'completed',
        inputHash: 'stale',
        generatedAt: EARLIER,
      },
    });

    await expect(service.request('a')).resolves.toMatchObject({
      state: 'queued',
      reused: false,
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});

describe('AuditAiRunsService.start', () => {
  it('claims the active run and returns its request time', async () => {
    const { service, prisma } = build({
      insight: { runState: 'queued', requestedAt: EARLIER },
    });

    await expect(service.start('a')).resolves.toEqual(EARLIER);
    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'a',
        requestedAt: EARLIER,
        runState: { in: ['queued', 'running'] },
      },
      data: { runState: 'running' },
    });
  });

  it.each([
    ['no row', null],
    ['a completed run', { runState: 'completed', requestedAt: EARLIER }],
    ['a failed run', { runState: 'failed', requestedAt: EARLIER }],
  ])('skips %s', async (_label, insight) => {
    const { service, prisma } = build({ insight });

    await expect(service.start('a')).resolves.toBeNull();
    expect(prisma.auditInsight.updateMany).not.toHaveBeenCalled();
  });
});

describe('AuditAiRunsService.execute', () => {
  const observations = { icon: null, screenshots: [], consistentStyle: null };

  it('stores the observations on the run it claimed and records today', async () => {
    const { service, prisma, auditAi, audit } = build();
    auditAi.observe.mockResolvedValue(observations);

    await service.execute('a', EARLIER);

    const [[update]] = prisma.auditInsight.updateMany.mock.calls as Array<
      [
        {
          where: { appId: string; requestedAt: Date };
          data: { runState: string; inputHash: string; model: string };
        },
      ]
    >;
    expect(update.where).toEqual({ appId: 'a', requestedAt: EARLIER });
    expect(update.data).toMatchObject({
      runState: 'completed',
      inputHash: FINGERPRINT,
      model: MODEL,
    });
    expect(audit.recordToday).toHaveBeenCalledWith('a');
  });

  it('discards the result when a newer request replaced the run', async () => {
    const { service, prisma, auditAi, audit } = build();
    auditAi.observe.mockResolvedValue(observations);
    prisma.auditInsight.updateMany.mockResolvedValue({ count: 0 });

    await service.execute('a', EARLIER);

    expect(audit.recordToday).not.toHaveBeenCalled();
  });

  it('completes the run when recording the daily score fails', async () => {
    const { service, prisma, auditAi, audit } = build();
    auditAi.observe.mockResolvedValue(observations);
    audit.recordToday.mockRejectedValue(new Error('db down'));

    await expect(service.execute('a', EARLIER)).resolves.toBeUndefined();
    const [[completion]] = prisma.auditInsight.updateMany.mock.calls as Array<
      [{ where: unknown; data: { runState: string } }]
    >;
    expect(completion.where).toEqual({ appId: 'a', requestedAt: EARLIER });
    expect(completion.data.runState).toBe('completed');
  });
});

describe('AuditAiRunsService.fail', () => {
  it('only overwrites the same run while it is still active', async () => {
    const { service, prisma } = build();

    await service.fail('a', EARLIER, 'OpenAI is rate limiting requests.');

    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'a',
        requestedAt: EARLIER,
        runState: { in: ['queued', 'running'] },
      },
      data: {
        runState: 'failed',
        runError: 'OpenAI is rate limiting requests.',
      },
    });
  });
});
