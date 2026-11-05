import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordDiscoveryPlanner } from './discovery-planner.service';
import { DiscoveryTracker } from './discovery-tracker.service';
import {
  KeywordDiscoveryActions,
  trackTargetOf,
} from './keyword-discovery-actions.service';

const NOW = new Date('2026-11-11T12:00:00Z');

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '42',
};

const stored = {
  keywordId: 'k1',
  source: 'reviews',
  position: 4,
  depth: 50,
  checkedOn: new Date('2026-11-11T00:00:00Z'),
  keyword: { text: 'focus timer', country: 'us' },
};

const build = (found: object | null = { ...app, isCompetitor: false }) => {
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(found),
      update: jest.fn().mockResolvedValue({}),
    },
    keywordDiscovery: {
      findMany: jest.fn().mockResolvedValue([stored]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const tracker = {
    trackRows: jest.fn().mockResolvedValue({ tracked: 1, skipped: 0 }),
    autoTrack: jest.fn().mockResolvedValue(undefined),
  };
  const planner = {
    plan: jest.fn().mockResolvedValue({ queued: 3, resolved: 1 }),
  };
  const actions = new KeywordDiscoveryActions(
    prisma as unknown as PrismaService,
    tracker as unknown as DiscoveryTracker,
    planner as unknown as KeywordDiscoveryPlanner,
  );
  return { actions, prisma, tracker, planner };
};

const whereOf = (prisma: ReturnType<typeof build>['prisma']) =>
  (
    prisma.keywordDiscovery.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ]
  )[0].where;

describe('trackTargetOf', () => {
  it.each([
    [{}],
    [{ allRanked: false }],
    [{ keywordIds: ['k1'], allRanked: true }],
    [{ keywordIds: ['k1'], allRanked: false }],
  ])('refuses %o', (request) => {
    expect(() => trackTargetOf(request)).toThrow(BadRequestException);
  });

  it('accepts ids or every ranked row', () => {
    expect(trackTargetOf({ keywordIds: ['k1'] })).toEqual({
      keywordIds: ['k1'],
      country: undefined,
    });
    expect(trackTargetOf({ allRanked: true, country: 'de' })).toEqual({
      allRanked: true,
      country: 'de',
    });
  });
});

describe('KeywordDiscoveryActions', () => {
  it('tracks only open discoveries of the app among the ids', async () => {
    const { actions, prisma, tracker } = build();
    await expect(
      actions.track('app1', { keywordIds: ['k1', 'foreign'] }),
    ).resolves.toEqual({ tracked: 1, skipped: 0 });
    expect(whereOf(prisma)).toEqual({
      keywordId: { in: ['k1', 'foreign'] },
      appId: 'app1',
      dismissedAt: null,
      keyword: { tracked: { none: { appId: 'app1' } } },
    });
    expect(tracker.trackRows).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      [
        {
          keywordId: 'k1',
          text: 'focus timer',
          country: 'us',
          source: 'reviews',
          position: 4,
          depth: 50,
          checkedOn: '2026-11-11',
        },
      ],
    );
  });

  it('tracks every open ranked row of a market', async () => {
    const { actions, prisma } = build();
    await actions.track('app1', { allRanked: true, country: 'de' });
    expect(whereOf(prisma)).toEqual({
      position: { not: null },
      appId: 'app1',
      dismissedAt: null,
      keyword: { tracked: { none: { appId: 'app1' } }, country: 'de' },
    });
  });

  it('refuses a body without exactly one target before any lookup', async () => {
    const { actions, prisma } = build();
    await expect(actions.track('app1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.app.findFirst).not.toHaveBeenCalled();
  });

  it('dismisses the open rows once and counts them', async () => {
    const { actions, prisma } = build();
    await expect(actions.dismiss('app1', ['k1', 'k2'], NOW)).resolves.toEqual({
      dismissed: 2,
    });
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        keywordId: { in: ['k1', 'k2'] },
        dismissedAt: null,
      },
      data: { dismissedAt: NOW },
    });
  });

  it('refreshes through the planner with the spend of the caller', async () => {
    const { actions, planner } = build();
    const spend = jest.fn().mockResolvedValue(undefined);
    await expect(actions.refresh('app1', spend)).resolves.toEqual({
      queued: 3,
      resolved: 1,
    });
    expect(planner.plan).toHaveBeenCalledWith('app1', spend);
  });

  it('tracks every open ranked row when auto track is switched on', async () => {
    const { actions, prisma, tracker } = build();
    await expect(actions.updateSettings('app1', true)).resolves.toEqual({
      autoTrackRanked: true,
      tracked: 1,
      skipped: 0,
    });
    expect(prisma.app.update).toHaveBeenCalledWith({
      where: { id: 'app1' },
      data: { autoTrackRanked: true },
    });
    expect(whereOf(prisma)).toMatchObject({ position: { not: null } });
    expect(tracker.trackRows).toHaveBeenCalledTimes(1);
  });

  it('leaves the switch off when tracking is refused', async () => {
    const { actions, prisma, tracker } = build();
    const refusal = new Error('keyword room taken');
    tracker.trackRows.mockRejectedValueOnce(refusal);
    await expect(actions.updateSettings('app1', true)).rejects.toBe(refusal);
    expect(prisma.app.update).not.toHaveBeenCalled();
  });

  it('hands the rows a check ranked while the switch was turned on to auto track', async () => {
    const { actions, tracker } = build();
    await actions.updateSettings('app1', true);
    expect(tracker.autoTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      [expect.objectContaining({ keywordId: 'k1', position: 4 })],
    );
  });

  it('tracks nothing when auto track is switched off', async () => {
    const { actions, tracker } = build();
    await expect(actions.updateSettings('app1', false)).resolves.toEqual({
      autoTrackRanked: false,
      tracked: 0,
      skipped: 0,
    });
    expect(tracker.trackRows).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown app and 400 for a competitor', async () => {
    await expect(
      build(null).actions.updateSettings('app1', true),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build({ ...app, isCompetitor: true }).actions.dismiss('app1', ['k1']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
