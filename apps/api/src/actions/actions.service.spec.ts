import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ACTION_FORMULA_VERSION } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ActionsService } from './actions.service';
import { ListActionsQueryDto } from './dto/list-actions-query.dto';
import { UpdateActionDto } from './dto/update-action.dto';

const DAY_MS = 86_400_000;
const SNOOZE_MAX_DAYS = 90;

const storedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'act_1',
  rule: 'keyword.add_uncovered',
  category: 'metadata',
  status: 'OPEN',
  priority: 'high',
  impact: 71,
  formulaVersion: ACTION_FORMULA_VERSION,
  country: 'us',
  store: 'APP_STORE',
  evidence: {
    rule: 'keyword.add_uncovered',
    opportunity: 66.5,
    indexedFields: ['title'],
    uncoveredFields: ['title'],
  },
  firstSeenAt: new Date('2026-07-20T03:00:00.000Z'),
  lastSeenAt: new Date('2026-07-30T03:00:00.000Z'),
  resolvedAt: null,
  snoozedUntil: null,
  closedAt: null,
  reopenCount: 0,
  note: null,
  aiExplanation: null,
  aiModel: null,
  aiGeneratedAt: null,
  app: { id: 'app_1', name: 'Budget' },
  keyword: { id: 'kw_1', text: 'budget planner' },
  ...overrides,
});

const buildPrisma = (
  current: { id: string; status: string; reopenCount: number } | null = {
    id: 'act_1',
    status: 'OPEN',
    reopenCount: 0,
  },
) => ({
  actionItem: {
    findMany: jest.fn(() => Promise.resolve([storedRow()])),
    findFirst: jest.fn(() => Promise.resolve(current)),
    count: jest.fn(() => Promise.resolve(1)),
    aggregate: jest.fn(() =>
      Promise.resolve({
        _max: { lastSeenAt: new Date('2026-07-30T03:00:00.000Z') },
      }),
    ),
    groupBy: jest.fn(() => Promise.resolve([])),
    update: jest.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve(storedRow({ status: args.data.status })),
    ),
  },
});

const buildQueue = (suppressed: string | null = null) =>
  ({
    getBackend: () => ({
      client: Promise.resolve({
        get: jest.fn(() => Promise.resolve(suppressed)),
      }),
    }),
  }) as unknown as Queue;

const WORKSPACE = 'ws_1';

const serviceFor = (
  prisma: ReturnType<typeof buildPrisma>,
  queue: Queue = buildQueue(),
): ActionsService => {
  const workspace = new WorkspaceContext();
  const service = new ActionsService(
    prisma as unknown as PrismaService,
    {
      get: jest.fn(() => SNOOZE_MAX_DAYS),
    } as unknown as ConfigService<Env, true>,
    queue,
    workspace,
  );
  return new Proxy(service, {
    get: (target, property, receiver) => {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) =>
        workspace.run(WORKSPACE, () =>
          Promise.resolve(
            (value as (...inner: unknown[]) => unknown).apply(target, args),
          ),
        );
    },
  });
};

const query = (overrides: Partial<ListActionsQueryDto> = {}) =>
  Object.assign(new ListActionsQueryDto(), overrides);

const update = (body: Partial<UpdateActionDto>): UpdateActionDto =>
  Object.assign(new UpdateActionDto(), body);

const whereOf = (prisma: ReturnType<typeof buildPrisma>) =>
  (
    prisma.actionItem.findMany.mock.calls[0][0] as unknown as {
      where: Record<string, unknown>;
    }
  ).where;

describe('ActionsService reads', () => {
  it('defaults to open and snoozed sorted by impact then age', async () => {
    const prisma = buildPrisma();

    const result = await serviceFor(prisma).list(query());

    expect(whereOf(prisma).status).toEqual({ in: ['OPEN', 'SNOOZED'] });
    expect(
      (
        prisma.actionItem.findMany.mock.calls[0][0] as unknown as {
          orderBy: unknown;
        }
      ).orderBy,
    ).toEqual([{ impact: 'desc' }, { firstSeenAt: 'asc' }, { id: 'asc' }]);
    expect(result.total).toBe(1);
    expect(result.generatedAt).toBe('2026-07-30T03:00:00.000Z');
  });

  it('narrows by every supported filter', async () => {
    const prisma = buildPrisma();

    await serviceFor(prisma).list(
      query({
        status: ['DONE'],
        priority: ['critical'],
        rule: ['keyword.defend'],
        category: 'competition',
        country: 'de',
        store: 'GOOGLE_PLAY',
        appId: 'app_9',
      }),
    );

    expect(whereOf(prisma)).toMatchObject({
      status: { in: ['DONE'] },
      priority: { in: ['critical'] },
      rule: { in: ['keyword.defend'] },
      category: 'competition',
      country: 'de',
      store: 'GOOGLE_PLAY',
      appId: 'app_9',
    });
  });

  it('scopes to the path app id over the query app id', async () => {
    const prisma = buildPrisma();

    await serviceFor(prisma).list(query({ appId: 'app_query' }), 'app_path');

    expect(whereOf(prisma).appId).toBe('app_path');
  });

  it('reports no generation timestamp before the first run', async () => {
    const prisma = buildPrisma();
    prisma.actionItem.aggregate = jest.fn(() =>
      Promise.resolve({ _max: { lastSeenAt: null } }),
    ) as unknown as typeof prisma.actionItem.aggregate;
    prisma.actionItem.findMany = jest.fn(() =>
      Promise.resolve([] as ReturnType<typeof storedRow>[]),
    );
    prisma.actionItem.count = jest.fn(() => Promise.resolve(0));

    const result = await serviceFor(prisma).list(query());

    expect(result).toEqual({ items: [], total: 0, generatedAt: null });
  });

  it('returns a degraded row rather than throwing', async () => {
    const prisma = buildPrisma();
    prisma.actionItem.findMany = jest.fn(() =>
      Promise.resolve([storedRow({ evidence: 'broken' })]),
    );

    const result = await serviceFor(prisma).list(query());

    expect(result.items[0]).toMatchObject({ degraded: true, evidence: null });
  });

  it('summarizes counts by status, priority, category and rule', async () => {
    const prisma = buildPrisma();
    prisma.actionItem.groupBy = jest
      .fn<Promise<never[]>, []>()
      .mockResolvedValueOnce([
        { status: 'OPEN', _count: { _all: 4 } },
        { status: 'SNOOZED', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { priority: 'critical', _count: { _all: 2 } },
        { priority: 'low', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([{ category: 'metadata', _count: { _all: 5 } }])
      .mockResolvedValueOnce([
        { rule: 'keyword.add_uncovered', _count: { _all: 5 } },
        { rule: 'mystery', _count: { _all: 9 } },
      ]);

    const summary = await serviceFor(prisma).summary();

    expect(summary).toMatchObject({
      open: 4,
      snoozed: 1,
      byPriority: { critical: 2, high: 0, medium: 0, low: 3 },
      topRules: [{ rule: 'keyword.add_uncovered', count: 5 }],
    });
    expect(summary.byCategory.metadata).toBe(5);
    expect(summary.byCategory.hygiene).toBe(0);
  });

  it('reports the suppression count recorded by the last run', async () => {
    const summary = await serviceFor(buildPrisma(), buildQueue('7')).summary();

    expect(summary.suppressedByCap).toBe(7);
  });

  it('reports zero suppression before any run and on unusable values', async () => {
    for (const stored of [null, '', 'many', '-1']) {
      const summary = await serviceFor(
        buildPrisma(),
        buildQueue(stored),
      ).summary();

      expect(summary.suppressedByCap).toBe(0);
    }
  });

  it('never fails a summary because the run key is unreachable', async () => {
    const queue = {
      getBackend: () => ({ client: Promise.reject(new Error('redis down')) }),
    } as unknown as Queue;

    await expect(
      serviceFor(buildPrisma(), queue).summary(),
    ).resolves.toMatchObject({ suppressedByCap: 0 });
  });
});

describe('ActionsService transitions', () => {
  const future = (days: number): string =>
    new Date(Date.now() + days * DAY_MS).toISOString();

  it('rejects an unknown action with 404', async () => {
    const prisma = buildPrisma(null);

    await expect(
      serviceFor(prisma).update('missing', update({ status: 'DONE' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes a done action and clears its other timestamps', async () => {
    const prisma = buildPrisma();

    await serviceFor(prisma).update('act_1', update({ status: 'DONE' }));

    const data = prisma.actionItem.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'DONE',
      resolvedAt: null,
      snoozedUntil: null,
    });
    expect(data.closedAt).toBeInstanceOf(Date);
  });

  it('stores a trimmed note', async () => {
    const prisma = buildPrisma();

    await serviceFor(prisma).update(
      'act_1',
      update({ status: 'DISMISSED', note: '  not relevant  ' }),
    );

    expect(
      (
        prisma.actionItem.update.mock.calls[0][0] as unknown as {
          data: { note: string };
        }
      ).data.note,
    ).toBe('not relevant');
  });

  it('snoozes to a future date within the maximum', async () => {
    const prisma = buildPrisma();

    await serviceFor(prisma).update(
      'act_1',
      update({ status: 'SNOOZED', snoozedUntil: future(7) }),
    );

    const data = prisma.actionItem.update.mock.calls[0][0].data;
    expect(data.snoozedUntil).toBeInstanceOf(Date);
    expect(data.closedAt).toBeNull();
  });

  it('accepts a snooze one day inside the maximum and rejects one past it', async () => {
    const service = serviceFor(buildPrisma());

    await expect(
      service.update(
        'act_1',
        update({
          status: 'SNOOZED',
          snoozedUntil: future(SNOOZE_MAX_DAYS - 1),
        }),
      ),
    ).resolves.toBeDefined();
    await expect(
      service.update(
        'act_1',
        update({
          status: 'SNOOZED',
          snoozedUntil: future(SNOOZE_MAX_DAYS + 1),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a snooze in the past and a snooze without the status', async () => {
    const service = serviceFor(buildPrisma());

    await expect(
      service.update(
        'act_1',
        update({ status: 'SNOOZED', snoozedUntil: future(-1) }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('act_1', update({ status: 'SNOOZED' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(
        'act_1',
        update({ status: 'DONE', snoozedUntil: future(7) }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to close a system-resolved action', async () => {
    const service = serviceFor(
      buildPrisma({ id: 'act_1', status: 'RESOLVED', reopenCount: 0 }),
    );

    await expect(
      service.update('act_1', update({ status: 'DONE' })),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.update('act_1', update({ status: 'DISMISSED' })),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.update(
        'act_1',
        update({ status: 'SNOOZED', snoozedUntil: future(7) }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('clears resolvedAt whenever an action is snoozed', async () => {
    const prisma = buildPrisma({
      id: 'act_1',
      status: 'OPEN',
      reopenCount: 0,
    });

    await serviceFor(prisma).update(
      'act_1',
      update({ status: 'SNOOZED', snoozedUntil: future(7) }),
    );

    expect(prisma.actionItem.update.mock.calls[0][0].data).toMatchObject({
      status: 'SNOOZED',
      closedAt: null,
      resolvedAt: null,
    });
  });

  it('reopens a closed action and increments the reopen count', async () => {
    for (const status of ['DONE', 'DISMISSED', 'RESOLVED']) {
      const prisma = buildPrisma({ id: 'act_1', status, reopenCount: 1 });

      await serviceFor(prisma).update('act_1', update({ status: 'OPEN' }));

      expect(prisma.actionItem.update.mock.calls[0][0].data).toMatchObject({
        status: 'OPEN',
        closedAt: null,
        resolvedAt: null,
        snoozedUntil: null,
        reopenCount: { increment: 1 },
      });
    }
  });

  it('never counts waking a snoozed action as a reopen', async () => {
    const prisma = buildPrisma({
      id: 'act_1',
      status: 'SNOOZED',
      reopenCount: 0,
    });

    await serviceFor(prisma).update('act_1', update({ status: 'OPEN' }));

    expect(prisma.actionItem.update.mock.calls[0][0].data).not.toHaveProperty(
      'reopenCount',
    );
  });
});
