import { ConfigService } from '@nestjs/config';
import { ACTION_FORMULA_VERSION, ActionRule } from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ActionContext, ActionContextLoader } from './action-context';
import { ActionEventInput, ActionEventRecorder } from './action-events';
import {
  actionContext,
  dailyBudget,
  contextApp,
  ruleSampleContext,
} from './rules/rule-context.fixture';
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

const budget = dailyBudget();

const emptyContext = (): ActionContext =>
  actionContext([], { workspaceId: 'ws_default' });

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
  appId: string;
  status: string;
  priority: string;
  impact: number;
  lastSeenAt: Date;
  closedAt: Date | null;
  verifiedAt: Date | null;
  snoozedUntil: Date | null;
  reopenCount: number;
}

type CreatedRow = { fingerprint: string; keywordId: string | null };

const buildPrisma = (rows: Row[] = []) => {
  const created: Array<Record<string, unknown>> = [];
  const events: ActionEventInput[] = [];
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
      return Promise.resolve({ id: `created-${created.length - 1}` });
    }),
    update: jest.fn(
      (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updated.push(args);
        return args;
      },
    ),
  };

  const actionEvent = {
    createMany: jest.fn((args: { data: ActionEventInput[] }) => {
      events.push(...args.data);
      return Promise.resolve({ count: args.data.length });
    }),
  };

  return {
    created: created as unknown as CreatedRow[],
    updated,
    events,
    actionItem,
    withTransaction: jest.fn(
      (
        run: (tx: {
          actionItem: typeof actionItem;
          actionEvent: typeof actionEvent;
        }) => Promise<unknown>,
      ) => run({ actionItem, actionEvent }),
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
  new ActionsGenerator(
    prisma as unknown as PrismaService,
    buildConfig(cap),
    {
      load: jest.fn(() => Promise.resolve(context)),
    } as unknown as ActionContextLoader,
    new ActionEventRecorder(),
  );

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
    appId: 'app_1',
    status: 'OPEN',
    priority: 'high',
    impact: 70,
    lastSeenAt: NOW,
    closedAt: null,
    verifiedAt: null,
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
        appId: 'app_1',
        status: 'OPEN',
        priority: 'high',
        impact: 70,
        lastSeenAt: new Date(NOW.getTime() - DAY_MS),
        closedAt: null,
        verifiedAt: null,
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
        appId: 'app_1',
        status: 'OPEN',
        priority: 'high',
        impact: 70,
        lastSeenAt: NOW,
        closedAt: null,
        verifiedAt: null,
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
        lastSeenAt: new Date(NOW.getTime() - DAY_MS),
        closedAt: new Date(
          NOW.getTime() - (ACTION_REOPEN_AFTER_DAYS - 1) * DAY_MS,
        ),
      }),
    );
    const outside = buildPrisma(
      storedRow(fingerprint, {
        status: 'DONE',
        lastSeenAt: new Date(NOW.getTime() - DAY_MS),
        closedAt: new Date(NOW.getTime() - ACTION_REOPEN_AFTER_DAYS * DAY_MS),
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

  it('reopens a done row closed fourteen days ago that was touched yesterday', async () => {
    const fingerprint = await fingerprintOf();
    const prisma = buildPrisma(
      storedRow(fingerprint, {
        status: 'DONE',
        lastSeenAt: new Date(NOW.getTime() - DAY_MS),
        closedAt: new Date(NOW.getTime() - ACTION_REOPEN_AFTER_DAYS * DAY_MS),
      }),
    );

    const result = await generatorFor(
      emptyContext(),
      prisma,
    ).generateForWorkspace(budget, NOW);

    expect(result).toMatchObject({ reopened: 1, touched: 0 });
    expect(prisma.updated[0].data).toMatchObject({ status: 'OPEN' });
  });

  describe('reopening drops the previous episode ai summary', () => {
    const cleared = {
      aiExplanation: null,
      aiModel: null,
      aiGeneratedAt: null,
    };

    it('clears the ai fields when a resolved row reopens', async () => {
      const fingerprint = await fingerprintOf();
      const prisma = buildPrisma(
        storedRow(fingerprint, { status: 'RESOLVED' }),
      );

      await generatorFor(emptyContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(prisma.updated[0].data).toMatchObject({
        status: 'OPEN',
        ...cleared,
      });
    });

    it('clears the ai fields when a done row reopens', async () => {
      const fingerprint = await fingerprintOf();
      const prisma = buildPrisma(
        storedRow(fingerprint, {
          status: 'DONE',
          closedAt: new Date(NOW.getTime() - ACTION_REOPEN_AFTER_DAYS * DAY_MS),
        }),
      );

      await generatorFor(emptyContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(prisma.updated[0].data).toMatchObject({
        status: 'OPEN',
        ...cleared,
      });
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

  describe('lifecycle events', () => {
    it('records an opened event for a new action with its scored priority', async () => {
      const prisma = buildPrisma();

      await generatorFor(emptyContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(prisma.events).toEqual([
        {
          workspaceId: 'ws_default',
          actionId: 'created-0',
          appId: 'app_1',
          type: 'opened',
          actor: 'system',
          userId: null,
          status: 'OPEN',
          priority: 'critical',
          impact: 80,
          snoozedUntil: null,
          reason: null,
          occurredAt: NOW,
        },
      ]);
    });

    it('records a resolved event with the stored priority and impact', async () => {
      useDetectors([{ rule: 'keyword.add_uncovered', detect: () => [] }]);
      const prisma = buildPrisma(storedRow('abc', {}));

      await generatorFor(emptyContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(prisma.events).toEqual([
        expect.objectContaining({
          actionId: 'act_1',
          type: 'resolved',
          status: 'RESOLVED',
          priority: 'high',
          impact: 70,
        }),
      ]);
    });

    it('records nothing for a refreshed or touched row', async () => {
      const fingerprint = await fingerprintOf();
      for (const status of ['OPEN', 'DONE', 'DISMISSED']) {
        const prisma = buildPrisma(storedRow(fingerprint, { status }));

        await generatorFor(emptyContext(), prisma).generateForWorkspace(
          budget,
          NOW,
        );

        expect(prisma.events).toEqual([]);
      }
    });

    it('records a woke event when an expired snooze opens again', async () => {
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

      expect(prisma.events).toEqual([
        expect.objectContaining({ actionId: 'act_1', type: 'woke' }),
      ]);
    });

    it('records a reopened event when a resolved row fires again', async () => {
      const fingerprint = await fingerprintOf();
      const prisma = buildPrisma(
        storedRow(fingerprint, { status: 'RESOLVED' }),
      );

      await generatorFor(emptyContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(prisma.events).toEqual([
        expect.objectContaining({
          actionId: 'act_1',
          type: 'reopened',
          status: 'OPEN',
        }),
      ]);
    });

    it('records nothing for rows whose detector crashed', async () => {
      useDetectors([
        {
          rule: 'keyword.add_uncovered',
          detect: () => {
            throw new Error('boom');
          },
        },
      ]);
      const prisma = buildPrisma(storedRow('abc', {}));

      await generatorFor(emptyContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(prisma.events).toEqual([]);
      expect(prisma.withTransaction).not.toHaveBeenCalled();
    });
  });

  describe('verification', () => {
    it('verifies a done row whose rule was evaluated and did not fire', async () => {
      useDetectors([{ rule: 'keyword.add_uncovered', detect: () => [] }]);
      const prisma = buildPrisma(storedRow('abc', { status: 'DONE' }));

      const result = await generatorFor(
        emptyContext(),
        prisma,
      ).generateForWorkspace(budget, NOW);

      expect(result).toMatchObject({ verified: 1, resolved: 0 });
      expect(prisma.updated[0].data).toEqual({ verifiedAt: NOW });
      expect(prisma.events).toEqual([
        expect.objectContaining({
          actionId: 'act_1',
          type: 'verified',
          status: 'DONE',
        }),
      ]);
    });

    it('leaves a done row untouched when its detector crashed', async () => {
      useDetectors([
        {
          rule: 'keyword.add_uncovered',
          detect: () => {
            throw new Error('boom');
          },
        },
      ]);
      const prisma = buildPrisma(storedRow('abc', { status: 'DONE' }));

      const result = await generatorFor(
        emptyContext(),
        prisma,
      ).generateForWorkspace(budget, NOW);

      expect(result.verified).toBe(0);
      expect(prisma.updated).toEqual([]);
    });

    it('reopens a verified row that fires again and clears its verification', async () => {
      const fingerprint = await fingerprintOf();
      const prisma = buildPrisma(
        storedRow(fingerprint, {
          status: 'DONE',
          closedAt: new Date(NOW.getTime() - 3 * DAY_MS),
          verifiedAt: new Date(NOW.getTime() - DAY_MS),
        }),
      );

      const result = await generatorFor(
        emptyContext(),
        prisma,
      ).generateForWorkspace(budget, NOW);

      expect(result.reopened).toBe(1);
      expect(prisma.updated[0].data).toMatchObject({
        status: 'OPEN',
        verifiedAt: null,
      });
      expect(prisma.events).toEqual([
        expect.objectContaining({ type: 'reopened' }),
      ]);
    });
  });

  describe('withheld detections', () => {
    const withheld = (): DetectedAction =>
      detection('keyword.add_uncovered', { withheld: true });

    it('keeps an open row open when its subject is withheld', async () => {
      const fingerprint = await fingerprintOf();
      useDetectors([
        { rule: 'keyword.add_uncovered', detect: () => [withheld()] },
      ]);
      const prisma = buildPrisma(storedRow(fingerprint, {}));

      const result = await generatorFor(
        emptyContext(),
        prisma,
      ).generateForWorkspace(budget, NOW);

      expect(result).toMatchObject({ resolved: 0, refreshed: 0 });
      expect(prisma.updated).toEqual([]);
    });

    it('does not verify a done row whose subject is withheld', async () => {
      const fingerprint = await fingerprintOf();
      useDetectors([
        { rule: 'keyword.add_uncovered', detect: () => [withheld()] },
      ]);
      const prisma = buildPrisma(storedRow(fingerprint, { status: 'DONE' }));

      const result = await generatorFor(
        emptyContext(),
        prisma,
      ).generateForWorkspace(budget, NOW);

      expect(result.verified).toBe(0);
      expect(prisma.updated).toEqual([]);
    });

    it('never creates or counts a withheld detection', async () => {
      useDetectors([
        { rule: 'keyword.add_uncovered', detect: () => [withheld()] },
      ]);
      const prisma = buildPrisma();

      const result = await generatorFor(
        emptyContext(),
        prisma,
        0,
      ).generateForWorkspace(budget, NOW);

      expect(result).toMatchObject({ opened: 0, suppressedByCap: 0 });
      expect(prisma.created).toEqual([]);
    });
  });

  describe('new rules leave the existing rules alone', () => {
    const realDetectors =
      jest.requireActual<typeof import('./action-rule')>(
        './action-rule',
      ).ACTION_DETECTORS;
    const NEW_RULES: ActionRule[] = [
      'keyword.push_to_top10',
      'metadata.fix_lint',
      'rank.investigate_unexplained_drop',
      'competitor.investigate_overtake',
      'reviews.investigate_rating_decline',
      'reviews.reply_negative',
      'listing.ship_update',
    ];

    const createdRules = async (detectors: readonly ActionDetector[]) => {
      mockDetectors.splice(0, mockDetectors.length, ...detectors);
      const prisma = buildPrisma();
      await generatorFor(ruleSampleContext(), prisma).generateForWorkspace(
        budget,
        NOW,
      );
      return (
        prisma.created as unknown as Array<{
          fingerprint: string;
          rule: string;
        }>
      )
        .filter((row) => !NEW_RULES.includes(row.rule as ActionRule))
        .map((row) => row.fingerprint)
        .sort();
    };

    it('detects the same existing actions with the new detectors registered', async () => {
      const withNew = await createdRules(realDetectors);
      const withoutNew = await createdRules(
        realDetectors.filter((detector) => !NEW_RULES.includes(detector.rule)),
      );

      expect(withNew).toEqual(withoutNew);
      expect(withNew.length).toBeGreaterThan(0);
    });

    it('leaves a decline row alone once a review theme explains it', async () => {
      const decline = realDetectors.filter(
        (detector) => detector.rule === 'reviews.investigate_rating_decline',
      );
      mockDetectors.splice(0, mockDetectors.length, ...decline);
      const reviewAt = (daysAgo: number, index: number) =>
        new Date(NOW.getTime() - (daysAgo + index / 10) * 86_400_000);
      const scored = (
        scores: number[],
        daysAgo: number,
        version: string,
        text = 'fine',
      ) =>
        scores.map((score, index) => ({
          id: `rev_${daysAgo}_${version}_${text}_${index}`,
          score,
          title: null,
          text,
          version,
          reviewedAt: reviewAt(daysAgo, index),
          repliedAt: null,
          replyCheckedAt: null,
        }));
      const declining = (themed: boolean): ActionContext =>
        actionContext([
          contextApp({
            latestVersion: '4.2.0',
            previousVersion: themed ? '4.1.0' : null,
            reviews: [
              ...scored([1, 1, 2], 1, '4.2.0', 'crashes on launch every time'),
              ...scored([5, 4, 4, 4, 4], 2, '4.2.0'),
              ...scored([1], 20, '4.1.0', 'too many adverts'),
              ...scored([5, 5, 5, 5, 5], 21, '4.1.0'),
            ],
          }),
        ]);
      const first = buildPrisma();
      await generatorFor(declining(false), first).generateForWorkspace(
        budget,
        NOW,
      );
      const fingerprint = first.created[0].fingerprint;

      for (const status of ['OPEN', 'DONE'] as const) {
        const prisma = buildPrisma(
          storedRow(fingerprint, {
            rule: 'reviews.investigate_rating_decline',
            status,
          }),
        );
        const result = await generatorFor(
          declining(true),
          prisma,
        ).generateForWorkspace(budget, NOW);

        expect(result).toMatchObject({ resolved: 0, verified: 0, opened: 0 });
        expect(prisma.updated).toEqual([]);
      }
    });

    it('keeps an open push action open once its results turn volatile', async () => {
      const push = realDetectors.filter(
        (detector) => detector.rule === 'keyword.push_to_top10',
      );
      mockDetectors.splice(0, mockDetectors.length, ...push);
      const first = buildPrisma();
      await generatorFor(ruleSampleContext(), first).generateForWorkspace(
        budget,
        NOW,
      );
      const sample = ruleSampleContext();
      const volatile: ActionContext = {
        ...sample,
        apps: sample.apps.map((app) => ({
          ...app,
          volatilityByKeyword: new Map([['kw_push', 60]]),
        })),
      };
      const prisma = buildPrisma(
        storedRow(first.created[0].fingerprint, {
          rule: 'keyword.push_to_top10',
        }),
      );

      const result = await generatorFor(volatile, prisma).generateForWorkspace(
        budget,
        NOW,
      );

      expect(result).toMatchObject({ opened: 0, resolved: 0, refreshed: 0 });
      expect(prisma.updated).toEqual([]);
    });
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
