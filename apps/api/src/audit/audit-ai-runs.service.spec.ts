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
import { StoredRun } from './audit-run-state';

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
      [{ update: { runState: string; runError: string | null } }]
    >;
    expect(queuedUpsert.update).toMatchObject({
      runState: 'queued',
      runError: null,
    });
    expect(queue.add).toHaveBeenCalledWith(
      JOBS.AUDIT_CREATIVE,
      { workspaceId: WORKSPACE, appId: 'a' },
      expect.objectContaining({
        deduplication: { id: 'audit-creative~a' },
        attempts: 2,
      }),
    );
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

describe('AuditAiRunsService.execute', () => {
  it('marks running, stores the observations and records today', async () => {
    const { service, prisma, auditAi, audit } = build();
    const observations = {
      icon: null,
      screenshots: [],
      consistentStyle: null,
    };
    auditAi.observe.mockResolvedValue(observations);

    await service.execute('a');

    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { runState: 'running' },
      }),
    );
    const [[upsert]] = prisma.auditInsight.upsert.mock.calls as Array<
      [{ update: { runState: string; inputHash: string } }]
    >;
    expect(upsert.update.runState).toBe('completed');
    expect(upsert.update.inputHash).toBe(FINGERPRINT);
    expect(audit.recordToday).toHaveBeenCalledWith('a');
  });
});

describe('AuditAiRunsService.fail', () => {
  it('only overwrites a run that is still active', async () => {
    const { service, prisma } = build();

    await service.fail('a', 'OpenAI is rate limiting requests.');

    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith({
      where: { appId: 'a', runState: { in: ['queued', 'running'] } },
      data: {
        runState: 'failed',
        runError: 'OpenAI is rate limiting requests.',
      },
    });
  });
});
