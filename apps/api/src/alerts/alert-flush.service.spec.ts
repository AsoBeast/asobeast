import { ConfigService } from '@nestjs/config';
import { Prisma, Store } from '@prisma/client';
import { FlowJob, FlowProducer } from 'bullmq';
import {
  AlertBatchPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ALERT_DELIVERY_JOB_OPTIONS } from './alert-delivery-flow';
import { AlertFlushService } from './alert-flush.service';
import { MailerService } from './mailer.service';

const claimedAt = new Date('2026-07-22T11:00:00.000Z');
const createdAt = new Date('2026-07-22T09:00:00.000Z');
const rankPayload: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'app1', name: 'App One' },
  keyword: { id: 'kw1', text: 'game' },
  from: 3,
  to: 12,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};
const competitorPayload: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-22T10:30:00.000Z',
  app: { id: 'competitor1', name: 'Rival', isCompetitor: true },
  changes: [{ field: 'title', before: 'Old', after: 'New' }],
};

const claimRow = (
  id: string,
  overrides: { claimedAt?: Date | null; flushedAt?: Date | null } = {},
) => ({
  id,
  event: rankPayload.event,
  appId: rankPayload.app.id,
  payload: rankPayload,
  createdAt,
  claimedAt:
    overrides.claimedAt === undefined ? claimedAt : overrides.claimedAt,
  flushedAt: overrides.flushedAt === undefined ? null : overrides.flushedAt,
});

const serializableError = () =>
  new Prisma.PrismaClientKnownRequestError('serialization', {
    code: 'P2034',
    clientVersion: '7.8.0',
  });

interface ClaimUpdateArgs {
  where: { flushedAt: null; flushId: null };
  data: { flushId: string; claimedAt: Date };
}

interface ClaimLoadArgs {
  where: { flushId: string };
  distinct?: string[];
}

type ClaimLoader = (args: ClaimLoadArgs) => Promise<unknown[]>;

interface CompleteArgs {
  where: { flushId: string; flushedAt: null };
  data: { flushedAt: Date };
}

function batchPayload(flow: FlowJob): AlertBatchPayload {
  const data: unknown = flow.data;
  if (typeof data !== 'object' || data === null) {
    throw new Error('expected delivery data');
  }
  const payload: unknown = Reflect.get(data, 'payload');
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Reflect.get(payload, 'event') !== 'alerts.batch'
  ) {
    throw new Error('expected batch payload');
  }
  return payload as AlertBatchPayload;
}

function buildHarness() {
  const claimUpdates: ClaimUpdateArgs[] = [];
  const loadedClaims: string[] = [];
  const completionUpdates: CompleteArgs[] = [];
  const bulkCalls: FlowJob[][] = [];
  const transactionOptions: Array<{
    isolationLevel: Prisma.TransactionIsolationLevel;
  }> = [];
  const transaction = {
    alertEvent: {
      findMany: jest
        .fn<(args: object) => Promise<Array<{ flushId: string | null }>>>()
        .mockResolvedValue([{ flushId: 'claim-1' }]),
      updateMany: jest.fn((args: ClaimUpdateArgs) => {
        claimUpdates.push(args);
        return Promise.resolve({ count: 0 });
      }),
    },
  };
  let workspaceIds = [DEFAULT_WORKSPACE_ID];
  let subscribedWebhooks: { id: string; events: string[] }[] = [];
  const flushedWorkspaces: (string | undefined)[] = [];
  let claimLoader: ClaimLoader = (args) => {
    loadedClaims.push(args.where.flushId);
    return Promise.resolve([claimRow('row-1')]);
  };
  const alertEvent = {
    findMany: jest.fn((args: ClaimLoadArgs) =>
      args.distinct
        ? Promise.resolve(workspaceIds.map((workspaceId) => ({ workspaceId })))
        : claimLoader(args),
    ),
    updateMany: jest.fn((args: CompleteArgs) => {
      completionUpdates.push(args);
      return Promise.resolve({ count: 1 });
    }),
    count: jest.fn<(args: object) => Promise<number>>().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
  };
  const prisma = {
    withTransaction: jest.fn(
      (
        callback: (value: typeof transaction) => Promise<string[]>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) => {
        transactionOptions.push(options);
        return callback(transaction);
      },
    ),
    alertEvent,
    app: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'app1',
          name: 'App One',
          store: Store.APP_STORE,
          country: 'us',
          isCompetitor: false,
          primaryAppId: null,
        },
      ]),
    },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
    webhook: {
      findMany: jest.fn(() => {
        flushedWorkspaces.push(workspace.current);
        return Promise.resolve(subscribedWebhooks);
      }),
    },
    emailAlert: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const addBulk = jest.fn((flows: FlowJob[]) => {
    bulkCalls.push(flows);
    return Promise.resolve([]);
  });
  const flowProducer = { addBulk } as unknown as FlowProducer;
  const workspace = new WorkspaceContext();
  const getConfig = jest.fn<(key: string) => unknown>();
  const config = { get: getConfig } as unknown as ConfigService<Env, true>;
  const mailer = { enabled: true } as MailerService;
  const service = new AlertFlushService(
    prisma as unknown as PrismaService,
    mailer,
    config,
    flowProducer,
    workspace,
    new CrossTenantAccess(workspace),
  );
  return {
    service,
    prisma,
    transaction,
    alertEvent,
    setClaimLoader: (loader: ClaimLoader) => {
      claimLoader = loader;
    },
    setWorkspaces: (ids: string[]) => {
      workspaceIds = ids;
    },
    setWebhooks: (rows: { id: string; events: string[] }[]) => {
      subscribedWebhooks = rows;
    },
    flushedWorkspaces,
    workspace,
    addBulk,
    mailer,
    claimUpdates,
    loadedClaims,
    completionUpdates,
    bulkCalls,
    transactionOptions,
    getConfig,
  };
}

describe('AlertFlushService', () => {
  it('reports pending and claimed rows against the daily pipeline trigger', async () => {
    const harness = buildHarness();
    const lastFlush = new Date('2026-07-22T12:00:00.000Z');
    harness.alertEvent.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    harness.alertEvent.findFirst.mockResolvedValue({ flushedAt: lastFlush });
    harness.getConfig.mockImplementation((key) =>
      key === 'ALERT_DELIVERY' ? 'batched' : '0 3 * * *',
    );

    await expect(harness.service.status()).resolves.toEqual({
      mode: 'batched',
      pipelineCron: '0 3 * * *',
      trigger: 'daily_pipeline_completion',
      lastFlushAt: lastFlush.toISOString(),
      pending: 4,
      claimed: 2,
    });
    expect(harness.alertEvent.count.mock.calls).toEqual([
      [{ where: { flushedAt: null, flushId: null } }],
      [{ where: { flushedAt: null, flushId: { not: null } } }],
    ]);
  });

  it('reports a never-flushed empty outbox', async () => {
    const harness = buildHarness();
    harness.alertEvent.count.mockResolvedValue(0);
    harness.alertEvent.findFirst.mockResolvedValue(null);
    harness.getConfig.mockImplementation((key) =>
      key === 'ALERT_DELIVERY' ? 'instant' : '15 2 * * *',
    );

    await expect(harness.service.status()).resolves.toMatchObject({
      mode: 'instant',
      lastFlushAt: null,
      pending: 0,
      claimed: 0,
    });
  });

  it('returns an empty result when no unfinished or pending rows exist', async () => {
    const harness = buildHarness();
    harness.transaction.alertEvent.findMany.mockResolvedValue([]);
    harness.transaction.alertEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 0,
      channels: 0,
      notifications: 0,
    });
    expect(harness.loadedClaims).toEqual([]);
  });

  it('claims pending rows in one serializable entry transaction', async () => {
    const harness = buildHarness();
    harness.transaction.alertEvent.findMany.mockResolvedValue([]);
    harness.transaction.alertEvent.updateMany.mockImplementation(
      (args: ClaimUpdateArgs) => {
        harness.claimUpdates.push(args);
        return Promise.resolve({ count: 1 });
      },
    );

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 0,
      notifications: 0,
    });
    expect(harness.transactionOptions).toEqual([
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ]);
    const claimUpdate = harness.claimUpdates[0];
    expect(claimUpdate.where).toEqual({
      flushedAt: null,
      flushId: null,
    });
    expect(claimUpdate.data.flushId).toEqual(expect.any(String));
    expect(claimUpdate.data.claimedAt).toBeInstanceOf(Date);
    const claimId = claimUpdate.data.flushId;
    expect(harness.loadedClaims).toEqual([claimId]);
  });

  it('processes unfinished claims oldest first before the new claim', async () => {
    const harness = buildHarness();
    harness.transaction.alertEvent.findMany.mockResolvedValue([
      { flushId: 'old-1' },
      { flushId: 'old-1' },
      { flushId: 'old-2' },
    ]);
    harness.transaction.alertEvent.updateMany.mockResolvedValue({ count: 1 });
    const claimRows = [
      [claimRow('old-row-1')],
      [claimRow('old-row-2')],
      [claimRow('new-row')],
    ];
    harness.setClaimLoader((args) => {
      harness.loadedClaims.push(args.where.flushId);
      return Promise.resolve(claimRows.shift() ?? []);
    });

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 3,
      channels: 0,
      notifications: 0,
    });
    const requested = harness.loadedClaims;
    expect(requested.slice(0, 2)).toEqual(['old-1', 'old-2']);
    expect(requested[2]).not.toBe('old-1');
    expect(requested[2]).not.toBe('old-2');
  });

  it('continues processing later claims before surfacing a claim failure', async () => {
    const harness = buildHarness();
    harness.transaction.alertEvent.findMany.mockResolvedValue([
      { flushId: 'poisoned-claim' },
      { flushId: 'healthy-claim' },
    ]);
    harness.setClaimLoader((args) => {
      harness.loadedClaims.push(args.where.flushId);
      return Promise.resolve([
        claimRow(`${args.where.flushId}-row`, {
          claimedAt: args.where.flushId === 'poisoned-claim' ? null : claimedAt,
        }),
      ]);
    });

    await expect(harness.service.flushEveryWorkspace()).rejects.toThrow(
      'alert flush claim poisoned-claim failed: alert flush claim poisoned-claim has invalid timestamps',
    );
    expect(harness.loadedClaims).toEqual(['poisoned-claim', 'healthy-claim']);
    expect(harness.completionUpdates.map(({ where }) => where.flushId)).toEqual(
      ['healthy-claim'],
    );
  });

  it('uses the fixed claim timestamp and stable scoped job ID', async () => {
    const harness = buildHarness();
    harness.setWebhooks([{ id: 'webhook-1', events: ['rank.dropped'] }]);

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 1,
      notifications: 1,
    });
    const delivery = harness.bulkCalls[0][0];
    const batch = batchPayload(delivery);
    expect(batch.occurredAt).toBe(claimedAt.toISOString());
    expect(batch.window.to).toBe(claimedAt.toISOString());
    expect(delivery.opts?.jobId).toBe(
      'flush~claim-1~webhook~webhook-1~owned_apps',
    );
  });

  it('creates deterministic IDs for email and webhook channels', async () => {
    const harness = buildHarness();
    harness.setWebhooks([{ id: 'webhook-1', events: ['rank.dropped'] }]);
    harness.prisma.emailAlert.findMany.mockResolvedValue([
      { id: 'email-1', events: ['rank.dropped'] },
    ]);

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 2,
      notifications: 2,
    });
    expect(harness.bulkCalls[0].map(({ opts }) => opts?.jobId)).toEqual([
      'flush~claim-1~webhook~webhook-1~owned_apps',
      'flush~claim-1~email~email-1~owned_apps',
    ]);
  });

  it('creates an owned child before the competitor parent with canonical options', async () => {
    const harness = buildHarness();
    harness.setClaimLoader(() =>
      Promise.resolve([
        claimRow('row-1'),
        {
          id: 'row-2',
          event: competitorPayload.event,
          appId: competitorPayload.app.id,
          payload: competitorPayload,
          createdAt,
          claimedAt,
          flushedAt: null,
        },
      ]),
    );
    harness.prisma.app.findMany.mockResolvedValue([
      {
        id: 'app1',
        name: 'App One',
        store: Store.APP_STORE,
        country: 'us',
        isCompetitor: false,
        primaryAppId: null,
      },
      {
        id: 'competitor1',
        name: 'Rival',
        store: Store.APP_STORE,
        country: 'us',
        isCompetitor: true,
        primaryAppId: 'app1',
      },
    ]);
    harness.setWebhooks([
      { id: 'webhook-1', events: ['rank.dropped', 'metadata.changed'] },
    ]);
    harness.alertEvent.updateMany.mockResolvedValue({ count: 2 });

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 2,
      channels: 1,
      notifications: 2,
    });
    expect(harness.addBulk).toHaveBeenCalledTimes(1);
    const parent = harness.bulkCalls[0][0];
    const child = parent.children?.[0];
    expect(batchPayload(parent).scope).toBe('competitors');
    expect(parent.opts).toEqual({
      ...ALERT_DELIVERY_JOB_OPTIONS,
      jobId: 'flush~claim-1~webhook~webhook-1~competitors',
    });
    if (!child) throw new Error('expected owned child');
    expect(batchPayload(child).scope).toBe('owned_apps');
    expect(child?.opts).toEqual({
      ...ALERT_DELIVERY_JOB_OPTIONS,
      jobId: 'flush~claim-1~webhook~webhook-1~owned_apps',
      removeDependencyOnFailure: true,
    });
  });

  it('completes no-subscriber and unmatched claims', async () => {
    const harness = buildHarness();
    harness.setWebhooks([{ id: 'webhook-1', events: ['review.negative'] }]);

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 0,
      notifications: 0,
    });
    expect(harness.addBulk).not.toHaveBeenCalled();
    expect(harness.completionUpdates[0].where.flushId).toBe('claim-1');
  });

  it('does not query email subscriptions when mail is disabled', async () => {
    const harness = buildHarness();
    Object.defineProperty(harness.mailer, 'enabled', { value: false });

    await harness.service.flushEveryWorkspace();

    expect(harness.prisma.emailAlert.findMany).not.toHaveBeenCalled();
  });

  it('leaves the claim unfinished when queue insertion fails', async () => {
    const harness = buildHarness();
    harness.setWebhooks([{ id: 'webhook-1', events: ['rank.dropped'] }]);
    harness.addBulk.mockRejectedValue(new Error('queue unavailable'));

    await expect(harness.service.flushEveryWorkspace()).rejects.toThrow(
      'queue unavailable',
    );
    expect(harness.alertEvent.updateMany).not.toHaveBeenCalled();
  });

  it('reuses the job ID after a crash following queue insertion', async () => {
    const harness = buildHarness();
    harness.setWebhooks([{ id: 'webhook-1', events: ['rank.dropped'] }]);
    harness.alertEvent.updateMany
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ count: 1 });

    await expect(harness.service.flushEveryWorkspace()).rejects.toThrow(
      'database unavailable',
    );
    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 1,
      notifications: 1,
    });
    expect(harness.bulkCalls.flat().map(({ opts }) => opts?.jobId)).toEqual([
      'flush~claim-1~webhook~webhook-1~owned_apps',
      'flush~claim-1~webhook~webhook-1~owned_apps',
    ]);
  });

  it('retries serialization conflicts with a fixed bound', async () => {
    const harness = buildHarness();
    harness.prisma.withTransaction
      .mockRejectedValueOnce(serializableError())
      .mockRejectedValueOnce(serializableError());

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 0,
      notifications: 0,
    });
    expect(harness.prisma.withTransaction).toHaveBeenCalledTimes(3);
  });

  it('surfaces serialization conflicts after the retry bound', async () => {
    const harness = buildHarness();
    harness.prisma.withTransaction.mockRejectedValue(serializableError());

    const failure = await harness.service
      .flushEveryWorkspace()
      .catch((error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      'workspace ws_default failed to flush',
    );
    expect((failure as Error).cause).toMatchObject({ code: 'P2034' });
    expect(harness.prisma.withTransaction).toHaveBeenCalledTimes(3);
  });

  it('rejects missing and mixed claim timestamps', async () => {
    const missing = buildHarness();
    missing.setClaimLoader(() =>
      Promise.resolve([claimRow('row-1', { claimedAt: null })]),
    );
    await expect(missing.service.flushEveryWorkspace()).rejects.toThrow(
      'invalid timestamps',
    );

    const mixed = buildHarness();
    mixed.setClaimLoader(() =>
      Promise.resolve([
        claimRow('row-1'),
        claimRow('row-2', {
          claimedAt: new Date('2026-07-22T11:01:00.000Z'),
        }),
      ]),
    );
    await expect(mixed.service.flushEveryWorkspace()).rejects.toThrow(
      'invalid timestamps',
    );
  });

  it('treats a concurrently completed whole claim as success', async () => {
    const harness = buildHarness();
    harness.setClaimLoader(() =>
      Promise.resolve([claimRow('row-1', { flushedAt: new Date() })]),
    );

    await expect(harness.service.flushEveryWorkspace()).resolves.toEqual({
      flushed: 1,
      channels: 0,
      notifications: 0,
    });
    expect(harness.addBulk).not.toHaveBeenCalled();
  });

  it('rejects partially completed claims and completion mismatches', async () => {
    const partial = buildHarness();
    partial.setClaimLoader(() =>
      Promise.resolve([
        claimRow('row-1', { flushedAt: new Date() }),
        claimRow('row-2'),
      ]),
    );
    await expect(partial.service.flushEveryWorkspace()).rejects.toThrow(
      'partially completed',
    );

    const mismatch = buildHarness();
    mismatch.setClaimLoader(() =>
      Promise.resolve([claimRow('row-1'), claimRow('row-2')]),
    );
    mismatch.alertEvent.updateMany.mockResolvedValue({ count: 1 });
    mismatch.alertEvent.count.mockResolvedValue(1);
    await expect(mismatch.service.flushEveryWorkspace()).rejects.toThrow(
      'completion mismatch',
    );
  });

  it('flushes each workspace on its own claim', async () => {
    const harness = buildHarness();
    harness.setWorkspaces(['ws_a', 'ws_b']);
    harness.setWebhooks([{ id: 'webhook-1', events: ['rank.dropped'] }]);

    await expect(harness.service.flushEveryWorkspace()).resolves.toMatchObject({
      flushed: 2,
    });

    expect(harness.flushedWorkspaces).toEqual(['ws_a', 'ws_b']);
    expect(harness.prisma.withTransaction).toHaveBeenCalledTimes(2);
    expect(
      harness.bulkCalls
        .flat()
        .map((flow) => (flow.data as { workspaceId: string }).workspaceId),
    ).toEqual(['ws_a', 'ws_b']);
  });

  it('keeps flushing later workspaces after one fails', async () => {
    const harness = buildHarness();
    harness.setWorkspaces(['ws_a', 'ws_b']);
    harness.setClaimLoader(() =>
      Promise.resolve([
        claimRow('row-1', {
          claimedAt: harness.workspace.current === 'ws_a' ? null : claimedAt,
        }),
      ]),
    );

    await expect(harness.service.flushEveryWorkspace()).rejects.toThrow(
      'invalid timestamps',
    );
    expect(harness.flushedWorkspaces).toEqual(['ws_b']);
  });

  it('aggregates the failures when more than one workspace fails', async () => {
    const harness = buildHarness();
    harness.setWorkspaces(['ws_a', 'ws_b']);
    harness.setClaimLoader(() =>
      Promise.resolve([claimRow('row-1', { claimedAt: null })]),
    );

    await expect(harness.service.flushEveryWorkspace()).rejects.toThrow(
      AggregateError,
    );
    await expect(harness.service.flushEveryWorkspace()).rejects.toThrow(
      'multiple workspaces failed to flush',
    );
  });

  it('refuses a tenant flush that carries no workspace scope', async () => {
    const harness = buildHarness();

    await expect(harness.service.flush()).rejects.toThrow(
      'No workspace in scope for an alert flush',
    );
    expect(harness.prisma.withTransaction).not.toHaveBeenCalled();
  });

  it('flushes only the caller workspace when scoped by a request', async () => {
    const harness = buildHarness();
    harness.setWorkspaces(['ws_a', 'ws_b']);
    harness.setWebhooks([{ id: 'webhook-1', events: ['rank.dropped'] }]);

    await expect(
      harness.workspace.run('ws_b', () => harness.service.flush()),
    ).resolves.toMatchObject({ flushed: 1 });

    expect(harness.flushedWorkspaces).toEqual(['ws_b']);
    expect(harness.prisma.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('names each failing workspace even when the cause is not an error', async () => {
    const harness = buildHarness();
    harness.setWorkspaces(['ws_a', 'ws_b']);
    harness.prisma.withTransaction.mockRejectedValue('serialization gave up');

    const failure = await harness.service
      .flushEveryWorkspace()
      .catch((error: AggregateError) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error: Error) => error.message),
    ).toEqual([
      'workspace ws_a failed to flush: serialization gave up',
      'workspace ws_b failed to flush: serialization gave up',
    ]);
  });
});
