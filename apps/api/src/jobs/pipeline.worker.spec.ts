import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { ActionsGenerator } from '../actions/actions.generator';
import { ActionsNotifier } from '../actions/actions.notifier';
import { AlertFlushService } from '../alerts/alert-flush.service';
import { AuditService } from '../audit/audit.service';
import { Env } from '../config/env';
import { ErrorTracking } from '../observability/error-tracking.service';
import { DailyBudgetService } from './daily-budget.service';
import { DigestDispatcher } from './digest.dispatcher';
import { actionsSuppressedKey, JOBS, LAST_DAILY_RUN_KEY } from './jobs.types';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { PublishedStatusService } from '../store-providers/canary/published-status.service';
import { StoreCanaryService } from '../store-providers/canary/store-canary.service';
import { ProxyPoolMaintenance } from '../store-providers/egress/proxy-pool.maintenance';
import { PipelineService } from './pipeline.service';
import { PipelineWorker } from './pipeline.worker';
import { AccountDeletionService } from '../account/account-deletion.service';
import { RetentionService } from './retention.service';

describe('PipelineWorker', () => {
  const payload = {
    date: '2026-07-27',
    apps: 2,
    keywords: 3,
    categories: 4,
    reviews: 1,
  };
  const result = { flushed: 8, channels: 2, notifications: 3 };
  const generation = {
    opened: 2,
    refreshed: 1,
    reopened: 0,
    resolved: 3,
    touched: 0,
    suppressedByCap: 4,
    durationMs: 12,
    openedActions: [],
  };
  const budget = { total: 12, utilization: 0.12 };
  const WORKSPACES = ['ws_one', 'ws_two'];

  const build = (
    poolEnabled = false,
    canaryCron = '0 2,8,14,20 * * *',
    statusEnabled = false,
  ) => {
    const client = { set: jest.fn().mockResolvedValue('OK') };
    const pipelineQueue = {
      upsertJobScheduler: jest
        .fn<Promise<void>, [string, unknown, { name: string }]>()
        .mockResolvedValue(undefined),
      removeJobScheduler: jest.fn().mockResolvedValue(true),
      getBackend: () => ({ client: Promise.resolve(client) }),
    };
    const proxyPool = {
      enabled: poolEnabled,
      cron: '0 2 * * *',
      run: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'CRON_STORE_CANARY' ? canaryCron : `value:${key}`,
      ),
    };
    const pipeline = {
      fanOutDaily: jest.fn().mockResolvedValue(payload),
      fanOutScoring: jest.fn().mockResolvedValue(0),
      estimateDailyBudget: jest.fn().mockResolvedValue(budget),
    };
    const retention = { prune: jest.fn().mockResolvedValue(undefined) };
    const digest = { run: jest.fn().mockResolvedValue(undefined) };
    const audit = { snapshotAll: jest.fn().mockResolvedValue(undefined) };
    const alertFlush = {
      flushEveryWorkspace: jest.fn().mockResolvedValue(result),
    };
    const actions = {
      generateForWorkspace: jest.fn().mockResolvedValue(generation),
    };
    const actionsNotifier = { notify: jest.fn().mockResolvedValue(0) };
    const workspace = new WorkspaceContext();
    const crossTenant = new CrossTenantAccess(workspace);
    const fanOut = new WorkspaceFanOut(
      {
        workspace: {
          findMany: jest
            .fn()
            .mockResolvedValue(WORKSPACES.map((id) => ({ id }))),
        },
      } as unknown as PrismaService,
      workspace,
      crossTenant,
    );
    const deletion = { eraseDue: jest.fn().mockResolvedValue([]) };
    const storeCanary = { run: jest.fn().mockResolvedValue({}) };
    const tracking = { capture: jest.fn() };
    const publishedStatus = {
      enabled: statusEnabled,
      cron: '17 * * * *',
      run: jest.fn().mockResolvedValue(undefined),
    };
    const worker = new PipelineWorker(
      pipelineQueue as unknown as Queue,
      config as unknown as ConfigService<Env, true>,
      pipeline as unknown as PipelineService,
      {
        estimate: pipeline.estimateDailyBudget,
      } as unknown as DailyBudgetService,
      retention as unknown as RetentionService,
      deletion as unknown as AccountDeletionService,
      digest as unknown as DigestDispatcher,
      audit as unknown as AuditService,
      alertFlush as unknown as AlertFlushService,
      actions as unknown as ActionsGenerator,
      actionsNotifier as unknown as ActionsNotifier,
      crossTenant,
      workspace,
      fanOut,
      proxyPool as unknown as ProxyPoolMaintenance,
      storeCanary as unknown as StoreCanaryService,
      publishedStatus as unknown as PublishedStatusService,
      tracking as unknown as ErrorTracking,
    );
    return {
      worker,
      pipelineQueue,
      client,
      pipeline,
      retention,
      deletion,
      digest,
      audit,
      alertFlush,
      actions,
      actionsNotifier,
      proxyPool,
      storeCanary,
      publishedStatus,
      tracking,
    };
  };

  const job = (name: string, data: unknown = {}): Job =>
    ({ name, data }) as Job;

  const completionWrites = (client: { set: jest.Mock }): number =>
    (client.set.mock.calls as unknown[][]).filter(
      ([key]) => key === LAST_DAILY_RUN_KEY,
    ).length;

  it('registers the pipeline schedulers without an independent alert flush', async () => {
    const { worker, pipelineQueue } = build();

    await worker.onModuleInit();

    expect(
      pipelineQueue.upsertJobScheduler.mock.calls.map(([key]) => key),
    ).toEqual([
      'daily',
      'weekly',
      'retention',
      'digest',
      'audit',
      'store-canary',
    ]);
    expect(
      pipelineQueue.upsertJobScheduler.mock.calls.map(
        ([, , data]) => data.name,
      ),
    ).toEqual([
      JOBS.DAILY,
      JOBS.SCORING,
      JOBS.RETENTION,
      JOBS.DIGEST,
      JOBS.AUDIT_SNAPSHOT,
      JOBS.STORE_CANARY,
    ]);
  });

  it('schedules the store canary an hour before the daily run', async () => {
    const { worker, pipelineQueue } = build();

    await worker.onModuleInit();

    expect(pipelineQueue.upsertJobScheduler).toHaveBeenCalledWith(
      'store-canary',
      { pattern: '0 2,8,14,20 * * *', tz: 'UTC' },
      { name: JOBS.STORE_CANARY },
    );
  });

  it('removes the canary scheduler when its pattern is emptied', async () => {
    const { worker, pipelineQueue } = build(false, '');

    await worker.onModuleInit();

    expect(
      pipelineQueue.upsertJobScheduler.mock.calls.map(([key]) => key),
    ).not.toContain('store-canary');
    expect(pipelineQueue.removeJobScheduler).toHaveBeenCalledWith(
      'store-canary',
    );
  });

  it('probes the stores when the canary job runs', async () => {
    const { worker, storeCanary } = build();

    await worker.process(job(JOBS.STORE_CANARY));

    expect(storeCanary.run).toHaveBeenCalledTimes(1);
  });

  it('schedules no status poll while no status url is configured', async () => {
    const { worker, pipelineQueue } = build();

    await worker.onModuleInit();

    expect(
      pipelineQueue.upsertJobScheduler.mock.calls.map(([key]) => key),
    ).not.toContain('store-status');
    expect(pipelineQueue.removeJobScheduler).toHaveBeenCalledWith(
      'store-status',
    );
  });

  it('schedules the status poll once a status url is configured', async () => {
    const { worker, pipelineQueue } = build(false, '0 2 * * *', true);

    await worker.onModuleInit();

    expect(pipelineQueue.upsertJobScheduler).toHaveBeenCalledWith(
      'store-status',
      { pattern: '17 * * * *', tz: 'UTC' },
      { name: JOBS.STORE_STATUS },
    );
  });

  it('reports an exhausted job to error tracking rather than throwing', () => {
    const { worker, tracking } = build();

    worker.onFailed(
      { name: JOBS.STORE_CANARY, queueName: 'pipeline', finishedOn: 1 } as Job,
      new Error('canary failed'),
    );

    expect(tracking.capture).toHaveBeenCalledTimes(1);
  });

  it('polls the published status when the status job runs', async () => {
    const { worker, publishedStatus } = build(false, '0 2 * * *', true);

    await worker.process(job(JOBS.STORE_STATUS));

    expect(publishedStatus.run).toHaveBeenCalledTimes(1);
  });

  it('schedules no pool sync while no proxy provider is configured', async () => {
    const { worker, pipelineQueue } = build();

    await worker.onModuleInit();

    expect(
      pipelineQueue.upsertJobScheduler.mock.calls.map(([key]) => key),
    ).not.toContain('proxy-sync');
    expect(pipelineQueue.removeJobScheduler).toHaveBeenCalledWith('proxy-sync');
  });

  it('schedules the pool sync once a proxy provider is configured', async () => {
    const { worker, pipelineQueue } = build(true);

    await worker.onModuleInit();

    expect(pipelineQueue.upsertJobScheduler).toHaveBeenCalledWith(
      'proxy-sync',
      { pattern: '0 2 * * *', tz: 'UTC' },
      { name: JOBS.PROXY_SYNC },
    );
  });

  it('runs pool maintenance when the sync job runs', async () => {
    const { worker, proxyPool } = build(true);

    await worker.process(job(JOBS.PROXY_SYNC));

    expect(proxyPool.run).toHaveBeenCalledTimes(1);
  });

  it('lets the daily scheduler branch only add the flow', async () => {
    const { worker, pipeline, alertFlush, client } = build();

    await worker.process(job(JOBS.DAILY));

    expect(pipeline.fanOutDaily).toHaveBeenCalledTimes(1);
    expect(alertFlush.flushEveryWorkspace).not.toHaveBeenCalled();
    expect(completionWrites(client)).toBe(0);
  });

  it('flushes and records completion only in the finalizer branch', async () => {
    const { worker, pipeline, alertFlush, client } = build();

    await worker.process(job(JOBS.DAILY_COMPLETE, payload));

    expect(pipeline.fanOutDaily).not.toHaveBeenCalled();
    expect(alertFlush.flushEveryWorkspace).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(
      LAST_DAILY_RUN_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
    const completionCall = client.set.mock.calls.findIndex(
      ([key]) => key === LAST_DAILY_RUN_KEY,
    );
    expect(
      alertFlush.flushEveryWorkspace.mock.invocationCallOrder[0],
    ).toBeLessThan(client.set.mock.invocationCallOrder[completionCall]);
  });

  it('does not fan out or write completion when the flush fails', async () => {
    const { worker, pipeline, alertFlush, client } = build();
    alertFlush.flushEveryWorkspace.mockRejectedValueOnce(
      new Error('delivery unavailable'),
    );

    await expect(
      worker.process(job(JOBS.DAILY_COMPLETE, payload)),
    ).rejects.toThrow('delivery unavailable');

    expect(pipeline.fanOutDaily).not.toHaveBeenCalled();
    expect(completionWrites(client)).toBe(0);
  });

  it('retries finalization after a completion timestamp failure', async () => {
    const { worker, pipeline, alertFlush, client } = build();
    client.set.mockImplementation((key: string) =>
      key === LAST_DAILY_RUN_KEY && completionWrites(client) === 1
        ? Promise.reject(new Error('redis write failed'))
        : Promise.resolve('OK'),
    );
    const finalizer = job(JOBS.DAILY_COMPLETE, payload);

    await expect(worker.process(finalizer)).rejects.toThrow(
      'redis write failed',
    );
    await expect(worker.process(finalizer)).resolves.toBeUndefined();

    expect(alertFlush.flushEveryWorkspace).toHaveBeenCalledTimes(2);
    expect(completionWrites(client)).toBe(2);
    expect(pipeline.fanOutDaily).not.toHaveBeenCalled();
  });

  it('preserves the scoring, retention, digest and audit branches', async () => {
    const { worker, pipeline, retention, digest, audit } = build();

    await worker.process(job(JOBS.SCORING));
    await worker.process(job(JOBS.RETENTION));
    await worker.process(job(JOBS.DIGEST));
    await worker.process(job(JOBS.AUDIT_SNAPSHOT));

    expect(pipeline.fanOutScoring).toHaveBeenCalledTimes(1);
    expect(retention.prune).toHaveBeenCalledTimes(1);
    expect(digest.run).toHaveBeenCalledTimes(1);
    expect(audit.snapshotAll).toHaveBeenCalledTimes(1);
  });

  it('erases workspaces past their deletion grace period before pruning', async () => {
    const { worker, retention, deletion } = build();

    await worker.process(job(JOBS.RETENTION));

    expect(deletion.eraseDue).toHaveBeenCalledTimes(1);
    expect(deletion.eraseDue.mock.invocationCallOrder[0]).toBeLessThan(
      retention.prune.mock.invocationCallOrder[0],
    );
  });

  it('runs the interactive job only for the workspace that queued it', async () => {
    const { worker, actions, alertFlush, client } = build();

    await worker.process(job(JOBS.ACTIONS, { workspaceId: 'ws_two' }));

    expect(actions.generateForWorkspace).toHaveBeenCalledTimes(1);
    expect(actions.generateForWorkspace).toHaveBeenCalledWith(budget);
    expect(alertFlush.flushEveryWorkspace).not.toHaveBeenCalled();
    expect(completionWrites(client)).toBe(0);
    expect(client.set).toHaveBeenCalledWith(
      actionsSuppressedKey('ws_two'),
      '4',
    );
  });

  it('refuses an interactive action job that carries no workspace', async () => {
    const { worker, actions } = build();

    await expect(worker.process(job(JOBS.ACTIONS))).rejects.toThrow(
      'carries no workspaceId',
    );
    expect(actions.generateForWorkspace).not.toHaveBeenCalled();
  });

  it('keys the suppression counter per workspace on the scheduled run', async () => {
    const { worker, actions, client } = build();

    await worker.process(job(JOBS.DAILY_COMPLETE, payload));

    expect(actions.generateForWorkspace).toHaveBeenCalledTimes(
      WORKSPACES.length,
    );
    for (const workspaceId of WORKSPACES) {
      expect(client.set).toHaveBeenCalledWith(
        actionsSuppressedKey(workspaceId),
        '4',
      );
    }
  });

  it('generates actions before the flush so new ones ride the same report', async () => {
    const { worker, actions, alertFlush } = build();

    await worker.process(job(JOBS.DAILY_COMPLETE, payload));

    expect(
      actions.generateForWorkspace.mock.invocationCallOrder[0],
    ).toBeLessThan(alertFlush.flushEveryWorkspace.mock.invocationCallOrder[0]);
  });

  it('never lets a failing generator hold alert delivery hostage', async () => {
    const { worker, actions, alertFlush, client } = build();
    actions.generateForWorkspace.mockRejectedValueOnce(
      new Error('detector exploded'),
    );

    await expect(
      worker.process(job(JOBS.DAILY_COMPLETE, payload)),
    ).resolves.toBeUndefined();

    expect(alertFlush.flushEveryWorkspace).toHaveBeenCalledTimes(1);
    expect(completionWrites(client)).toBe(1);
  });

  it('never lets a failing budget estimate hold alert delivery hostage', async () => {
    const { worker, pipeline, actions, alertFlush } = build();
    pipeline.estimateDailyBudget.mockRejectedValue(new Error('no redis'));

    await expect(
      worker.process(job(JOBS.DAILY_COMPLETE, payload)),
    ).resolves.toBeUndefined();

    expect(actions.generateForWorkspace).not.toHaveBeenCalled();
    expect(alertFlush.flushEveryWorkspace).toHaveBeenCalledTimes(1);
  });

  it('keeps generating for later workspaces after one of them fails', async () => {
    const { worker, actions, actionsNotifier, alertFlush } = build();
    actions.generateForWorkspace.mockRejectedValueOnce(
      new Error('detector exploded'),
    );

    await expect(
      worker.process(job(JOBS.DAILY_COMPLETE, payload)),
    ).resolves.toBeUndefined();

    expect(actions.generateForWorkspace).toHaveBeenCalledTimes(
      WORKSPACES.length,
    );
    expect(actionsNotifier.notify).toHaveBeenCalledTimes(1);
    expect(alertFlush.flushEveryWorkspace).toHaveBeenCalledTimes(1);
  });

  it('reports the generation counts in the completion log line', async () => {
    const { worker } = build();
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await worker.process(job(JOBS.DAILY_COMPLETE, payload));

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"actionsOpened":4'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"actionsResolved":6'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"actionsSuppressed":8'),
    );
    log.mockRestore();
  });

  it('reports null counts when generation failed', async () => {
    const { worker, actions } = build();
    actions.generateForWorkspace.mockRejectedValueOnce(new Error('boom'));
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await worker.process(job(JOBS.DAILY_COMPLETE, payload));

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"actionsOpened":null'),
    );
    jest.restoreAllMocks();
  });

  it('notifies on newly opened actions before the flush', async () => {
    const { worker, actionsNotifier, alertFlush } = build();

    await worker.process(job(JOBS.DAILY_COMPLETE, payload));

    expect(actionsNotifier.notify).toHaveBeenCalledWith(
      generation.openedActions,
    );
    expect(actionsNotifier.notify.mock.invocationCallOrder[0]).toBeLessThan(
      alertFlush.flushEveryWorkspace.mock.invocationCallOrder[0],
    );
  });

  it('never lets a failing notifier hold alert delivery hostage', async () => {
    const { worker, actionsNotifier, alertFlush, client } = build();
    actionsNotifier.notify.mockRejectedValueOnce(new Error('no webhooks'));

    await expect(
      worker.process(job(JOBS.DAILY_COMPLETE, payload)),
    ).resolves.toBeUndefined();

    expect(alertFlush.flushEveryWorkspace).toHaveBeenCalledTimes(1);
    expect(completionWrites(client)).toBe(1);
  });

  it('rejects an unknown pipeline job', async () => {
    const { worker } = build();

    await expect(worker.process(job('unknown'))).rejects.toThrow(
      'Unknown pipeline job unknown',
    );
  });
});
