import { NotFoundException } from '@nestjs/common';
import { ACTION_FORMULA_VERSION } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActionDetailService } from './action-detail.service';
import { ActionSeriesReader } from './action-series.reader';

const storedRow = {
  id: 'act_1',
  rule: 'keyword.add_uncovered',
  category: 'metadata',
  status: 'DONE',
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
  closedAt: new Date('2026-07-25T03:00:00.000Z'),
  verifiedAt: null,
  reopenCount: 0,
  note: null,
  aiExplanation: null,
  aiModel: null,
  aiGeneratedAt: null,
  app: { id: 'app_1', name: 'Budget' },
  keyword: { id: 'kw_1', text: 'budget planner' },
};

const event = (id: string, type: string, occurredAt: string) => ({
  id,
  type,
  actor: type === 'opened' ? 'system' : 'user',
  status: type === 'opened' ? 'OPEN' : 'DONE',
  priority: 'high',
  impact: 71,
  snoozedUntil: null,
  reason: null,
  occurredAt: new Date(occurredAt),
  user: type === 'opened' ? null : { name: 'Anna' },
});

const TREND = {
  metric: 'position' as const,
  direction: 'lower_is_better' as const,
  depth: 200,
  points: [
    { date: '2026-07-25', checked: true, value: 14 },
    { date: '2026-07-29', checked: true, value: 8 },
  ],
};

const serviceFor = (row: unknown, events: unknown[] = []) => {
  const prisma = {
    actionItem: { findFirst: jest.fn(() => Promise.resolve(row)) },
    actionEvent: { findMany: jest.fn(() => Promise.resolve(events)) },
  };
  const series = { read: jest.fn(() => Promise.resolve(TREND)) };
  return {
    prisma,
    service: new ActionDetailService(
      prisma as unknown as PrismaService,
      series as unknown as ActionSeriesReader,
    ),
  };
};

describe('ActionDetailService', () => {
  it('answers 404 for an action it cannot see', async () => {
    await expect(serviceFor(null).service.get('act_x')).rejects.toThrow(
      new NotFoundException('Action not found'),
    );
  });

  it('returns the item with its events oldest first', async () => {
    const { service, prisma } = serviceFor(storedRow, [
      event('ev_1', 'opened', '2026-07-20T03:00:00.000Z'),
      event('ev_2', 'done', '2026-07-25T03:00:00.000Z'),
      event('ev_3', 'mystery', '2026-07-26T03:00:00.000Z'),
    ]);

    const detail = await service.get('act_1');

    expect(prisma.actionEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actionId: 'act_1' },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(detail).toMatchObject({ id: 'act_1', status: 'DONE' });
    expect(detail.events.map((item) => item.type)).toEqual(['opened', 'done']);
    expect(detail.events[1].actorName).toBe('Anna');
  });

  it('measures the outcome of a done action from its trend', async () => {
    const detail = await serviceFor(storedRow).service.get('act_1');

    expect(detail.trend).toEqual(TREND);
    expect(detail.outcome).toMatchObject({
      before: 14,
      after: 8,
      change: -6,
      verdict: 'improved',
    });
  });

  it('measures no outcome for an action that is not done', async () => {
    const detail = await serviceFor({
      ...storedRow,
      status: 'OPEN',
    }).service.get('act_1');

    expect(detail.trend).toEqual(TREND);
    expect(detail.outcome).toBeNull();
  });
});
