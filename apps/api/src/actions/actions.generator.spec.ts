import { ConfigService } from '@nestjs/config';
import {
  ACTION_FORMULA_VERSION,
  ActionRule,
  DailyBudget,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ActionContext, ActionContextLoader } from './action-context';
import { ACTION_REOPEN_AFTER_DAYS } from './action-lifecycle';
import { ActionDetector, DetectedAction } from './action-rule';
import { ActionsGenerator } from './actions.generator';

const mockDetectors: ActionDetector[] = [];

jest.mock('./action-rule', () => ({
  get ACTION_DETECTORS() {
    return mockDetectors;
  },
}));

const NOW = new Date('2026-07-30T03:00:00.000Z');
const DAY_MS = 86_400_000;

const budget: DailyBudget = {
  apps: 1,
  keywords: 10,
  categories: 0,
  reviews: 1,
  total: 12,
  capacityPerDay: 100,
  utilization: 0.12,
  stores: [],
};

const emptyContext = (): ActionContext => ({
  workspaceId: 'ws_default',
  apps: [],
  budget,
  reviewScoreMax: 2,
  rankDropThreshold: 5,
});

const detection = (
  rule: ActionRule,
  overrides: Partial<DetectedAction> = {},
): DetectedAction => ({
  rule,
  appId: 'app_1',
  store: 'APP_STORE',
  country: 'us',
  keywordId: 'kw_1',
  discriminator: null,
  terms: { reach: 0.8, severity: 0.8, confidence: 0.8 },
  evidence: {
    rule: 'keyword.add_uncovered',
    opportunity: 80,
    traffic: null,
    difficulty: null,
    volume: 80,
    relevance: 80,
    latestPosition: null,
    indexedFields: ['title'],
    uncoveredFields: ['title'],
    keywordFieldCharsFree: null,
    scoreProvenance: null,
  },
  ...overrides,
});

const useDetectors = (
  entries: Array<{ rule: ActionRule; detect: () => DetectedAction[] }>,
): void => {
  mockDetectors.splice(0, mockDetectors.length, ...entries);
};

interface Row {
  id: string;
  fingerprint: string;
  rule: string;
  status: string;
  lastSeenAt: Date;
  snoozedUntil: Date | null;
  reopenCount: number;
}

type CreatedRow = { fingerprint: string; keywordId: string | null };

const buildPrisma = (rows: Row[] = []) => {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<{
    where: { id: string };
    data: Record<string, unknown>;
  }> = [];

  const actionItem = {
    findMany: jest.fn((args: { select?: Record<string, boolean> }) => {
      if (args.select?.firstSeenAt) {
        return Promise.resolve(
          created.map((row, index) => ({
            id: `created_${index}`,
            fingerprint: row.fingerprint as string,
            firstSeenAt: NOW,
          })),
        );
      }
      return Promise.resolve(rows);
    }),
    create: jest.fn((args: { data: Record<string, unknown> }) => {
      created.push(args.data);
      return args;
    }),
    update: jest.fn(
      (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updated.push(args);
        return args;
      },
    ),
  };

  return {
    created: created as unknown as CreatedRow[],
    updated,
    actionItem,
    withTransaction: jest.fn(
      (run: (tx: { actionItem: typeof actionItem }) => Promise<unknown>) =>
        run({ actionItem }),
    ),
  };
};

const buildConfig = (cap: number): ConfigService<Env, true> =>
  ({ get: jest.fn(() => cap) }) as unknown as ConfigService<Env, true>;

const generatorFor = (
  context: ActionContext,
  prisma: ReturnType<typeof buildPrisma>,
  cap = 20,
): ActionsGenerator =>
  new ActionsGenerator(prisma as unknown as PrismaService, buildConfig(cap), {
    load: jest.fn(() => Promise.resolve(context)),
  } as unknown as ActionContextLoader);

const fingerprintOf = async (): Promise<string> => {
  const prisma = buildPrisma();
  await generatorFor(emptyContext(), prisma).generateForWorkspace(budget, NOW);
  return prisma.created[0].fingerprint;
};

const storedRow = (fingerprint: string, overrides: Partial<Row>): Row[] => [
  {
    id: 'act_1',
    fingerprint,
    rule: 'keyword.add_uncovered',
    status: 'OPEN',
    lastSeenAt: NOW,
    snoozedUntil: null,
    reopenCount: 0,
    ...overrides,
  },
];

describe('ActionsGenerator', () => {
  beforeEach(() => {
    useDetectors([
      {
        rule: 'keyword.add_uncovered',
        detect: () => [detection('keyword.add_uncovered')],
      },
    ]);
  });

  it('does nothing on an empty workspace', async () => {
    useDetectors([{ rule: 'keyword.add_uncovered', detect: () => [] }]);
    const prisma = buildPrisma();

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result).toMatchObject({
      opened: 0,
      refreshed: 0,
      reopened: 0,
      resolved: 0,
      suppressedByCap: 0,
      openedActions: [],
    });
    expect(prisma.withTransaction).not.toHaveBeenCalled();
  });

  it('creates a stored action with its category, version and priority', async () => {
    const prisma = buildPrisma();

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result.opened).toBe(1);
    expect(prisma.created[0]).toMatchObject({
      appId: 'app_1',
      rule: 'keyword.add_uncovered',
      category: 'metadata',
      status: 'OPEN',
      priority: 'critical',
      impact: 80,
      formulaVersion: ACTION_FORMULA_VERSION,
      firstSeenAt: NOW,
      lastSeenAt: NOW,
    });
    expect(result.openedActions).toEqual([
      expect.objectContaining({
        rule: 'keyword.add_uncovered',
        priority: 'critical',
        impact: 80,
        reopened: false,
      }),
    ]);
  });

  it('is idempotent: a second run on unchanged data opens nothing', async () => {
    const fingerprint = await fingerprintOf();
    const prisma = buildPrisma(storedRow(fingerprint, {}));

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result).toMatchObject({
      opened: 0,
      refreshed: 1,
      reopened: 0,
      resolved: 0,
    });
    expect(prisma.created).toHaveLength(0);
    expect(prisma.updated[0].data).not.toHaveProperty('firstSeenAt');
  });

  it('resolves an open row its rule stopped producing', async () => {
    useDetectors([{ rule: 'keyword.add_uncovered', detect: () => [] }]);
    const prisma = buildPrisma(
      storedRow('abc', { lastSeenAt: new Date(NOW.getTime() - DAY_MS) }),
    );

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result.resolved).toBe(1);
    expect(prisma.updated[0].data).toMatchObject({
      status: 'RESOLVED',
      resolvedAt: NOW,
      snoozedUntil: null,
    });
  });

  it('leaves rows untouched when their detector crashed', async () => {
    useDetectors([
      {
        rule: 'keyword.add_uncovered',
        detect: () => {
          throw new Error('boom');
        },
      },
      { rule: 'keyword.defend', detect: () => [] },
    ]);
    const prisma = buildPrisma([
      ...storedRow('abc', { lastSeenAt: new Date(NOW.getTime() - DAY_MS) }),
      {
        id: 'act_2',
        fingerprint: 'def',
        rule: 'keyword.defend',
        status: 'OPEN',
        lastSeenAt: new Date(NOW.getTime() - DAY_MS),
        snoozedUntil: null,
        reopenCount: 0,
      },
    ]);

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result.resolved).toBe(1);
    expect(prisma.updated.map((write) => write.where.id)).toEqual(['act_2']);
  });

  it('caps only new rows per app and reports the suppression count', async () => {
    useDetectors([
      {
        rule: 'keyword.add_uncovered',
        detect: () =>
          Array.from({ length: 5 }, (_, index) =>
            detection('keyword.add_uncovered', {
              keywordId: `kw_${index}`,
              terms: {
                reach: 1 - index / 10,
                severity: 0.5,
                confidence: 0.5,
              },
            }),
          ),
      },
    ]);
    const prisma = buildPrisma();

    const result = await generatorFor(
      emptyContext(),
      prisma,
      2,
    ).generateForWorkspace(budget, NOW);

    expect(result.opened).toBe(2);
    expect(result.suppressedByCap).toBe(3);
    expect(
      (prisma.created as unknown as Array<{ keywordId: string }>).map(
        (row) => row.keywordId,
      ),
    ).toEqual(['kw_0', 'kw_1']);
  });

  it('always refreshes existing open rows even past the cap', async () => {
    useDetectors([
      {
        rule: 'keyword.add_uncovered',
        detect: () =>
          Array.from({ length: 3 }, (_, index) =>
            detection('keyword.add_uncovered', { keywordId: `kw_${index}` }),
          ),
      },
    ]);
    const probe = buildPrisma();
    await generatorFor(emptyContext(), probe, 3).generateForWorkspace(
      budget,
      NOW,
    );

    const prisma = buildPrisma(
      probe.created.map((row, index) => ({
        id: `act_${index}`,
        fingerprint: row.fingerprint,
        rule: 'keyword.add_uncovered',
        status: 'OPEN',
        lastSeenAt: NOW,
        snoozedUntil: null,
        reopenCount: 0,
      })),
    );

    const result = await generatorFor(
      emptyContext(),
      prisma,
      1,
    ).generateForWorkspace(budget, NOW);

    expect(result).toMatchObject({
      refreshed: 3,
      opened: 0,
      suppressedByCap: 0,
    });
  });

  it('touches a done row inside the reopen gap and reopens it beyond', async () => {
    const fingerprint = await fingerprintOf();
    const inside = buildPrisma(
      storedRow(fingerprint, {
        status: 'DONE',
        lastSeenAt: new Date(
          NOW.getTime() - (ACTION_REOPEN_AFTER_DAYS - 1) * DAY_MS,
        ),
      }),
    );
    const outside = buildPrisma(
      storedRow(fingerprint, {
        status: 'DONE',
        lastSeenAt: new Date(NOW.getTime() - ACTION_REOPEN_AFTER_DAYS * DAY_MS),
      }),
    );

    const touched = await generatorFor(
      emptyContext(),
      inside,
    ).generateForWorkspace(budget, NOW);
    const reopened = await generatorFor(
      emptyContext(),
      outside,
    ).generateForWorkspace(budget, NOW);

    expect(touched).toMatchObject({ touched: 1, reopened: 0, opened: 0 });
    expect(inside.updated[0].data).toEqual({ lastSeenAt: NOW });
    expect(reopened).toMatchObject({ reopened: 1, touched: 0 });
    expect(outside.updated[0].data).toMatchObject({
      status: 'OPEN',
      reopenCount: 1,
      closedAt: null,
      resolvedAt: null,
    });
  });

  it('never reopens a dismissed row, however long it keeps firing', async () => {
    const fingerprint = await fingerprintOf();
    const prisma = buildPrisma(
      storedRow(fingerprint, {
        status: 'DISMISSED',
        lastSeenAt: new Date(NOW.getTime() - 365 * DAY_MS),
      }),
    );

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result).toMatchObject({ touched: 1, reopened: 0, opened: 0 });
    expect(prisma.updated[0].data).toEqual({ lastSeenAt: NOW });
  });

  it('wakes a snoozed row whose wake date has passed', async () => {
    const fingerprint = await fingerprintOf();
    const prisma = buildPrisma(
      storedRow(fingerprint, {
        status: 'SNOOZED',
        snoozedUntil: new Date(NOW.getTime() - DAY_MS),
      }),
    );

    await generatorFor(emptyContext(), prisma).generateForWorkspace(
      budget,
      NOW,
    );

    expect(prisma.updated[0].data).toMatchObject({
      status: 'OPEN',
      snoozedUntil: null,
    });
  });

  it('keeps a still-snoozed row snoozed while refreshing its evidence', async () => {
    const fingerprint = await fingerprintOf();
    const prisma = buildPrisma(
      storedRow(fingerprint, {
        status: 'SNOOZED',
        snoozedUntil: new Date(NOW.getTime() + DAY_MS),
      }),
    );

    await generatorFor(emptyContext(), prisma).generateForWorkspace(
      budget,
      NOW,
    );

    expect(prisma.updated[0].data).toMatchObject({
      status: 'SNOOZED',
      lastSeenAt: NOW,
    });
    expect(prisma.updated[0].data).not.toHaveProperty('snoozedUntil');
  });

  it('records how long the run took', async () => {
    useDetectors([{ rule: 'keyword.add_uncovered', detect: () => [] }]);

    const result = await generatorFor(
      emptyContext(),
      buildPrisma(),
    ).generateForWorkspace(budget, NOW);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
