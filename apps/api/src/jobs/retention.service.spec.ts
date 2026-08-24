import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { RetentionService } from './retention.service';

type Days = Partial<Record<keyof Env, number>>;

const buildConfig = (days: Days): ConfigService<Env, true> => {
  const values: Days = {
    RETENTION_RANKINGS_DAYS: 365,
    RETENTION_SERP_DAYS: 90,
    RETENTION_SNAPSHOTS_DAYS: 180,
    RETENTION_CATEGORY_RANKS_DAYS: 365,
    RETENTION_CHANGE_EVENTS_DAYS: 0,
    RETENTION_DELIVERIES_DAYS: 30,
    RETENTION_AUDIT_SCORES_DAYS: 0,
    RETENTION_ALERT_EVENTS_DAYS: 30,
    RETENTION_ACTIONS_DAYS: 180,
    RETENTION_BILLING_EVENTS_DAYS: 90,
    ...days,
  };
  return {
    get: jest.fn((key: keyof Env) => values[key]),
  } as unknown as ConfigService<Env, true>;
};

const buildPrisma = () => ({
  keywordRanking: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  serpEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
  categoryRank: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
  changeEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
  alertDelivery: { deleteMany: jest.fn().mockResolvedValue({ count: 6 }) },
  alertEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 9 }) },
  billingEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 11 }) },
  suggestProbe: { deleteMany: jest.fn().mockResolvedValue({ count: 7 }) },
  appSnapshot: {
    findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
  auditScore: { deleteMany: jest.fn().mockResolvedValue({ count: 8 }) },
  actionItem: { deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
});

const crossTenant = new CrossTenantAccess(new WorkspaceContext());

describe('RetentionService', () => {
  it('issues no delete for a disabled rule', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_RANKINGS_DAYS: 0 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(prisma.keywordRanking.deleteMany).not.toHaveBeenCalled();
    expect(deleted.keywordRanking).toBe(0);
  });

  it('computes the cutoff at UTC midnight minus the retention window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_RANKINGS_DAYS: 10 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    await service.prune();

    const [{ where }] = prisma.keywordRanking.deleteMany.mock.calls[0] as [
      { where: { date: { lt: Date } } },
    ];
    expect(where.date.lt).toEqual(new Date('2026-07-03T00:00:00.000Z'));
    jest.useRealTimers();
  });

  it('always keeps the newest snapshot id per app', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({}),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    await service.prune();

    expect(prisma.appSnapshot.findMany).toHaveBeenCalledWith({
      distinct: ['appId'],
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    const [{ where }] = prisma.appSnapshot.deleteMany.mock.calls[0] as [
      { where: { id: { notIn: string[] } } },
    ];
    expect(where.id).toEqual({ notIn: ['a', 'b'] });
  });

  it('prunes the alert delivery log with its own knob', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_DELIVERIES_DAYS: 30 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(deleted.alertDelivery).toBe(6);
    const [{ where }] = prisma.alertDelivery.deleteMany.mock.calls[0] as [
      { where: { createdAt: { lt: Date } } },
    ];
    expect(where.createdAt.lt).toEqual(new Date('2026-06-13T00:00:00.000Z'));
    jest.useRealTimers();
  });

  it('keeps deliveries forever when the knob is zero', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_DELIVERIES_DAYS: 0 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(prisma.alertDelivery.deleteMany).not.toHaveBeenCalled();
    expect(deleted.alertDelivery).toBe(0);
  });

  it('prunes only flushed alert events by their own knob', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_ALERT_EVENTS_DAYS: 30 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(deleted.alertEvent).toBe(9);
    const [{ where }] = prisma.alertEvent.deleteMany.mock.calls[0] as [
      { where: { flushedAt: { not: null; lt: Date } } },
    ];
    expect(where.flushedAt.lt).toEqual(new Date('2026-06-13T00:00:00.000Z'));
    expect(where.flushedAt.not).toBeNull();
    jest.useRealTimers();
  });

  it('prunes audit scores by their own knob', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_AUDIT_SCORES_DAYS: 365 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(deleted.auditScore).toBe(8);
    const [{ where }] = prisma.auditScore.deleteMany.mock.calls[0] as [
      { where: { date: { lt: Date } } },
    ];
    expect(where.date.lt).toEqual(new Date('2025-07-13T00:00:00.000Z'));
    jest.useRealTimers();
  });

  it('keeps audit scores forever when the knob is zero', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_AUDIT_SCORES_DAYS: 0 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(prisma.auditScore.deleteMany).not.toHaveBeenCalled();
    expect(deleted.auditScore).toBe(0);
  });

  it('prunes stored stripe payloads by their own knob', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_BILLING_EVENTS_DAYS: 90 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(deleted.billingEvent).toBe(11);
    const [{ where }] = prisma.billingEvent.deleteMany.mock.calls[0] as [
      { where: { receivedAt: { lt: Date } } },
    ];
    expect(where.receivedAt.lt).toEqual(new Date('2026-04-14T00:00:00.000Z'));
    jest.useRealTimers();
  });

  it('keeps stored stripe payloads forever when the knob is zero', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_BILLING_EVENTS_DAYS: 0 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(prisma.billingEvent.deleteMany).not.toHaveBeenCalled();
    expect(deleted.billingEvent).toBe(0);
  });

  it('runs remaining pruners when one fails', async () => {
    const prisma = buildPrisma();
    prisma.keywordRanking.deleteMany.mockRejectedValue(new Error('boom'));
    const service = new RetentionService(
      buildConfig({}),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(deleted.keywordRanking).toBeUndefined();
    expect(prisma.serpEntry.deleteMany).toHaveBeenCalled();
    expect(deleted.serpEntry).toBe(2);
  });

  it('rethrows when every pruner fails', async () => {
    const prisma = buildPrisma();
    const boom = () => Promise.reject(new Error('boom'));
    prisma.keywordRanking.deleteMany.mockImplementation(boom);
    prisma.serpEntry.deleteMany.mockImplementation(boom);
    prisma.categoryRank.deleteMany.mockImplementation(boom);
    prisma.changeEvent.deleteMany.mockImplementation(boom);
    prisma.alertDelivery.deleteMany.mockImplementation(boom);
    prisma.alertEvent.deleteMany.mockImplementation(boom);
    prisma.suggestProbe.deleteMany.mockImplementation(boom);
    prisma.appSnapshot.deleteMany.mockImplementation(boom);
    prisma.auditScore.deleteMany.mockImplementation(boom);
    prisma.actionItem.deleteMany.mockImplementation(boom);
    prisma.billingEvent.deleteMany.mockImplementation(boom);
    const service = new RetentionService(
      buildConfig({
        RETENTION_CHANGE_EVENTS_DAYS: 30,
        RETENTION_AUDIT_SCORES_DAYS: 365,
      }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    await expect(service.prune()).rejects.toThrow(
      'data retention failed for every table',
    );
  });
});

describe('RetentionService action pruning', () => {
  it('prunes only closed actions by closedAt or resolvedAt', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_ACTIONS_DAYS: 180 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(deleted.actionItem).toBe(10);
    const [{ where }] = prisma.actionItem.deleteMany.mock.calls[0] as [
      {
        where: {
          status: { in: string[] };
          OR: Array<Record<string, unknown>>;
        };
      },
    ];
    const cutoff = new Date('2026-01-14T00:00:00.000Z');
    expect(where.status.in).toEqual(['DONE', 'DISMISSED', 'RESOLVED']);
    expect(where.OR).toEqual([
      { closedAt: { lt: cutoff } },
      { closedAt: null, resolvedAt: { lt: cutoff } },
    ]);
    jest.useRealTimers();
  });

  it('never prunes open or snoozed actions by age', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_ACTIONS_DAYS: 1 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    await service.prune();

    const [{ where }] = prisma.actionItem.deleteMany.mock.calls[0] as [
      { where: { status: { in: string[] } } },
    ];
    expect(where.status.in).not.toContain('OPEN');
    expect(where.status.in).not.toContain('SNOOZED');
  });

  it('keeps actions forever when the knob is zero', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_ACTIONS_DAYS: 0 }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    expect(prisma.actionItem.deleteMany).not.toHaveBeenCalled();
    expect(deleted.actionItem).toBe(0);
  });

  it('deletes nothing when every window is set to retain forever', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({
        RETENTION_RANKINGS_DAYS: 0,
        RETENTION_SERP_DAYS: 0,
        RETENTION_SNAPSHOTS_DAYS: 0,
        RETENTION_CATEGORY_RANKS_DAYS: 0,
        RETENTION_CHANGE_EVENTS_DAYS: 0,
        RETENTION_DELIVERIES_DAYS: 0,
        RETENTION_AUDIT_SCORES_DAYS: 0,
        RETENTION_ALERT_EVENTS_DAYS: 0,
        RETENTION_ACTIONS_DAYS: 0,
        RETENTION_BILLING_EVENTS_DAYS: 0,
      }),
      prisma as unknown as PrismaService,
      crossTenant,
    );

    const deleted = await service.prune();

    const { suggestProbe, ...configurable } = deleted;
    expect(Object.values(configurable).every((count) => count === 0)).toBe(
      true,
    );
    expect(suggestProbe).toBeGreaterThanOrEqual(0);
    for (const table of [
      prisma.keywordRanking,
      prisma.serpEntry,
      prisma.categoryRank,
      prisma.changeEvent,
      prisma.appSnapshot,
      prisma.alertDelivery,
      prisma.alertEvent,
      prisma.auditScore,
      prisma.actionItem,
      prisma.billingEvent,
    ]) {
      expect(table.deleteMany).not.toHaveBeenCalled();
    }
  });
});
