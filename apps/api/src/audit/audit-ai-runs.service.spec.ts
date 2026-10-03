import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { AiAllowanceExceededError } from '../ai/ai-allowance.errors';
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
  competitorIcons: [],
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
    observeReserved: jest.fn(),
    reserve: jest.fn().mockResolvedValue('call_1'),
    release: jest.fn().mockResolvedValue(undefined),
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
      build({ app: null }).service.request('x', 'usr_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a competitor row', async () => {
    await expect(
      build({ app: { id: 'a', isCompetitor: true } }).service.request(
        'a',
        'usr_1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses without a key', async () => {
    await expect(
      build({ configured: false }).service.request('a', 'usr_1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a listing with nothing to analyze', async () => {
    await expect(
      build({
        inputs: { iconUrl: null, screenshotUrls: [] },
      }).service.request('a', 'usr_1'),
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

    await expect(service.request('a', 'usr_1')).resolves.toEqual({
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

    await expect(service.request('a', 'usr_1')).resolves.toMatchObject({
      state: 'running',
      reused: false,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues one deduplicated job otherwise', async () => {
    const { service, queue, prisma } = build({
      insight: { runState: 'failed', requestedAt: minutesAgo(30) },
    });

    await expect(service.request('a', 'usr_1')).resolves.toMatchObject({
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
      {
        workspaceId: WORKSPACE,
        appId: 'a',
        requestedAt: NOW.toISOString(),
        aiCallId: 'call_1',
      },
      expect.objectContaining({
        deduplication: { id: `audit-creative~a~${NOW.getTime()}` },
        attempts: 2,
      }),
    );
  });

  it('fails the queued run and rethrows when the job cannot be queued', async () => {
    const { service, queue, prisma } = build();
    const outage = new Error('redis unavailable');
    queue.add.mockRejectedValue(outage);

    await expect(service.request('a', 'usr_1')).rejects.toBe(outage);
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

    await expect(service.request('a', 'usr_1')).rejects.toBe(outage);
  });

  it('queues again for a completed analysis of changed creative', async () => {
    const { service, queue } = build({
      insight: {
        runState: 'completed',
        inputHash: 'stale',
        generatedAt: EARLIER,
      },
    });

    await expect(service.request('a', 'usr_1')).resolves.toMatchObject({
      state: 'queued',
      reused: false,
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('reserves after the reuse and active checks and queues the reservation with the run', async () => {
    const queued = build();
    await queued.service.request('a', 'usr_1');
    expect(queued.auditAi.reserve).toHaveBeenCalledTimes(1);
    expect(queued.auditAi.reserve).toHaveBeenCalledWith('a', 'usr_1');
    expect(
      queued.loader.creativeInputs.mock.invocationCallOrder[0],
    ).toBeLessThan(queued.auditAi.reserve.mock.invocationCallOrder[0]);
    expect(queued.queue.add).toHaveBeenCalledWith(
      JOBS.AUDIT_CREATIVE,
      expect.objectContaining({ aiCallId: 'call_1' }),
      expect.anything(),
    );

    for (const insight of [
      { runState: 'completed', inputHash: FINGERPRINT, generatedAt: EARLIER },
      { runState: 'running', requestedAt: minutesAgo(9) },
    ]) {
      const { service, auditAi } = build({ insight });
      await service.request('a', 'usr_1');
      expect(auditAi.reserve).not.toHaveBeenCalled();
    }
  });

  it('queues nothing when the allowance is spent', async () => {
    const { service, auditAi, prisma, queue } = build();
    const refusal = new AiAllowanceExceededError(
      {
        plan: 'indie',
        limit: 200,
        used: 200,
        resetsAt: '2026-10-01T00:00:00.000Z',
        upgradeTo: 'ultimate',
      },
      60,
    );
    auditAi.reserve.mockRejectedValue(refusal);

    await expect(service.request('a', 'usr_1')).rejects.toBe(refusal);
    expect(prisma.auditInsight.upsert).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('releases the reservation when the run cannot be queued', async () => {
    const { service, auditAi, queue, prisma } = build();
    const outage = new Error('redis unavailable');
    queue.add.mockRejectedValue(outage);

    await expect(service.request('a', 'usr_1')).rejects.toBe(outage);
    expect(auditAi.release).toHaveBeenCalledWith('call_1');
    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith({
      where: { appId: 'a', requestedAt: NOW, runState: 'queued' },
      data: { runState: 'failed', runError: RUN_NOT_QUEUED_MESSAGE },
    });
  });
});

describe('AuditAiRunsService.start', () => {
  it('claims only the active run the job was queued for', async () => {
    const { service, prisma } = build();

    await expect(service.start('a', EARLIER)).resolves.toBe(true);
    expect(prisma.auditInsight.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'a',
        requestedAt: EARLIER,
        runState: { in: ['queued', 'running'] },
      },
      data: { runState: 'running' },
    });
  });

  it('declines when that run is no longer active', async () => {
    const { service, prisma } = build();
    prisma.auditInsight.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.start('a', EARLIER)).resolves.toBe(false);
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

describe('AuditAiRunsService reservations', () => {
  const observations = { icon: null, screenshots: [], consistentStyle: null };

  it('charges the reservation a queued run carries', async () => {
    const { service, auditAi } = build();
    auditAi.observeReserved.mockResolvedValue(observations);

    await service.execute('a', EARLIER, 'call_1');

    expect(auditAi.observeReserved).toHaveBeenCalledWith(INPUTS, 'call_1');
    expect(auditAi.observe).not.toHaveBeenCalled();
  });

  it('spends a call for a run queued without a reservation', async () => {
    const { service, auditAi } = build();
    auditAi.observe.mockResolvedValue(observations);

    await service.execute('a', EARLIER);

    expect(auditAi.observe).toHaveBeenCalledWith(INPUTS, 'a', null);
  });

  it('releases the reservation of a failed or abandoned run', async () => {
    const { service, auditAi } = build();

    await service.fail('a', EARLIER, 'x', 'call_1');
    await service.abandon('call_2');
    await service.abandon(undefined);

    expect(auditAi.release.mock.calls).toEqual([['call_1'], ['call_2']]);
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
