import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceMetricsCollector } from './resource-metrics.service';

const INFO = [
  '# Memory',
  'used_memory:104857600',
  'used_memory_human:100.00M',
  'maxmemory:201326592',
  'maxmemory_policy:noeviction',
].join('\r\n');

describe('ResourceMetricsCollector', () => {
  const queryRaw = jest.fn();
  const info = jest.fn<Promise<string>, [string]>();

  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _justification: string,
      work: () => Promise<unknown>,
    ) => work(),
  } as unknown as CrossTenantAccess;
  const queue = {
    getBackend: () => ({ client: Promise.resolve({ info }) }),
  } as unknown as Queue;

  const build = (diskBudgetBytes = 0): ResourceMetricsCollector =>
    new ResourceMetricsCollector(
      prisma,
      crossTenant,
      {
        get: () => diskBudgetBytes,
      } as unknown as ConfigService<Env, true>,
      queue,
    );

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([{ size: 11_534_336n }]);
    info.mockReset().mockResolvedValue(INFO);
  });

  it('reports the database size as a number, not a bigint', async () => {
    await expect(build().collect()).resolves.toMatchObject({
      databaseBytes: 11_534_336,
    });
  });

  it('reads used and maximum memory out of the redis info block', async () => {
    await expect(build().collect()).resolves.toMatchObject({
      redisUsedBytes: 104_857_600,
      redisMaxBytes: 201_326_592,
    });
    expect(info).toHaveBeenCalledWith('memory');
  });

  it('reports the budget an operator declared', async () => {
    await expect(build(500_000_000).collect()).resolves.toMatchObject({
      diskBudgetBytes: 500_000_000,
    });
  });

  it('reports an unlimited redis as a maximum of zero', async () => {
    info.mockResolvedValue('# Memory\r\nused_memory:1024\r\nmaxmemory:0\r\n');

    await expect(build().collect()).resolves.toMatchObject({
      redisMaxBytes: 0,
    });
  });

  it('leaves the database size unmeasured when the query fails', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(build().collect()).resolves.toMatchObject({
      databaseBytes: null,
      redisUsedBytes: 104_857_600,
    });
  });

  it('leaves memory unmeasured when redis does not answer', async () => {
    info.mockRejectedValue(new Error('no redis'));

    await expect(build().collect()).resolves.toMatchObject({
      databaseBytes: 11_534_336,
      redisUsedBytes: null,
      redisMaxBytes: null,
    });
  });

  it('leaves memory unmeasured when the info block omits the fields', async () => {
    info.mockResolvedValue('# Memory\r\nmem_fragmentation_ratio:1.2\r\n');

    await expect(build().collect()).resolves.toMatchObject({
      redisUsedBytes: null,
      redisMaxBytes: null,
    });
  });

  it('never mistakes a field that merely ends the same way', async () => {
    info.mockResolvedValue(
      '# Memory\r\nused_memory_rss:999\r\nused_memory:512\r\nmaxmemory:1024\r\n',
    );

    await expect(build().collect()).resolves.toMatchObject({
      redisUsedBytes: 512,
    });
  });
});
