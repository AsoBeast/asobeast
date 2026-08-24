import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyLedger } from '../store-providers/egress/proxy-ledger.service';
import { ProxyPoolHealthReport } from '../store-providers/egress/proxy-pool-health.service';
import { ACCOUNT_MAIL_CHANNEL } from '../alerts/mailer.service';
import {
  ACCOUNT_MAIL_WINDOW_HOURS,
  InstanceMetricsCollector,
} from './instance-metrics.service';
import { instanceMetricsOf } from './metrics.fixture';
import { ResourceMetricsCollector } from './resource-metrics.service';

const NOW = new Date('2026-08-20T12:00:00.000Z');

describe('InstanceMetricsCollector when one measurement fails', () => {
  const build = jest.fn();
  const count = jest.fn();
  const resources = jest.fn();
  const groupBy = jest.fn();
  const workspaceCount = jest.fn();
  const billingEventCount = jest.fn();
  const accountMailGroupBy = jest.fn();

  const collector = new InstanceMetricsCollector(
    {
      workspace: { groupBy, count: workspaceCount },
      billingEvent: { count: billingEventCount },
      alertDelivery: { groupBy: accountMailGroupBy },
    } as unknown as PrismaService,
    {
      becauseThisWorkIsNotOwnedByOneWorkspace: (
        _justification: string,
        work: () => Promise<unknown>,
      ) => work(),
    } as unknown as CrossTenantAccess,
    { build } as unknown as ProxyPoolHealthReport,
    { count } as unknown as ProxyLedger,
    { collect: resources } as unknown as ResourceMetricsCollector,
    { get: () => 0 } as unknown as ConfigService<Env, true>,
    {
      getBackend: () => ({
        client: Promise.resolve({ ping: () => Promise.resolve('PONG') }),
      }),
    } as unknown as Queue,
  );

  beforeEach(() => {
    build.mockReset().mockResolvedValue(instanceMetricsOf().pool);
    count.mockReset().mockResolvedValue(7);
    resources.mockReset().mockResolvedValue(instanceMetricsOf().resources);
    groupBy.mockReset().mockResolvedValue([]);
    workspaceCount.mockReset().mockResolvedValue(0);
    billingEventCount.mockReset().mockResolvedValue(0);
    accountMailGroupBy.mockReset().mockResolvedValue([
      { status: 'delivered', _count: { _all: 4 } },
      { status: 'failed', _count: { _all: 2 } },
      { status: 'skipped', _count: { _all: 1 } },
    ]);
  });

  it('collects everything when nothing fails', async () => {
    const metrics = await collector.collect(NOW);

    expect(metrics.proxyRequests.DATACENTER).toBe(7);
    expect(metrics.resources.databaseBytes).not.toBeNull();
    expect(metrics.pool.enabled).toBe(true);
    expect(metrics.accountMail).toEqual({
      delivered: 4,
      failed: 2,
      skipped: 1,
    });
  });

  it('counts account mail over the last day of the account channel alone', async () => {
    await collector.collect(NOW);

    expect(accountMailGroupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: {
        channel: ACCOUNT_MAIL_CHANNEL,
        createdAt: {
          gte: new Date(
            NOW.getTime() - ACCOUNT_MAIL_WINDOW_HOURS * 60 * 60 * 1000,
          ),
        },
      },
      _count: { _all: true },
    });
  });

  it('ignores an outcome it has no counter for', async () => {
    accountMailGroupBy.mockResolvedValue([
      { status: 'delivered', _count: { _all: 3 } },
      { status: 'queued', _count: { _all: 9 } },
    ]);

    const metrics = await collector.collect(NOW);

    expect(metrics.accountMail).toEqual({
      delivered: 3,
      failed: 0,
      skipped: 0,
    });
  });

  it('reports unreadable account mail as zero and keeps the rest of the scrape', async () => {
    accountMailGroupBy.mockRejectedValue(new Error('relation does not exist'));

    const metrics = await collector.collect(NOW);

    expect(metrics.accountMail).toEqual({
      delivered: 0,
      failed: 0,
      skipped: 0,
    });
    expect(metrics.proxyRequests.DATACENTER).toBe(7);
    expect(metrics.pool.enabled).toBe(true);
  });

  it('reports an unreadable pool as empty and keeps the rest of the scrape', async () => {
    build.mockRejectedValue(new Error('the provider is down'));

    const metrics = await collector.collect(NOW);

    expect(metrics.pool.stores).toEqual([]);
    expect(metrics.pool.alerts).toEqual([]);
    expect(metrics.proxyRequests.DATACENTER).toBe(7);
    expect(metrics.resources.databaseBytes).not.toBeNull();
  });

  it('reports unreadable resources as unmeasured and keeps the rest of the scrape', async () => {
    resources.mockRejectedValue(new Error('no connection'));

    const metrics = await collector.collect(NOW);

    expect(metrics.resources).toEqual({
      databaseBytes: null,
      diskBudgetBytes: 0,
      redisUsedBytes: null,
      redisMaxBytes: null,
    });
    expect(metrics.pool.enabled).toBe(true);
  });

  it('reports unreadable billing totals as zero and keeps the rest of the scrape', async () => {
    groupBy.mockRejectedValue(new Error('relation does not exist'));

    const metrics = await collector.collect(NOW);

    expect(metrics.workspacesByPlan).toEqual({});
    expect(metrics.billingEventsFailed).toBe(0);
    expect(metrics.pool.enabled).toBe(true);
  });

  it('reports unreadable egress counts as zero and keeps the rest of the scrape', async () => {
    count.mockRejectedValue(new Error('no ledger'));

    const metrics = await collector.collect(NOW);

    expect(metrics.proxyRequests).toEqual({ DATACENTER: 0, RESIDENTIAL: 0 });
    expect(metrics.pool.enabled).toBe(true);
  });
});
