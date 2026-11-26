import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { WorkspaceContext } from '../../common/tenancy/workspace-context';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordPairTracker } from '../keyword-pair-tracker';
import { KeywordsService } from '../keywords.service';
import { COMPETITOR_HAS_NO_LOCALIZATIONS } from '../keywords.support';
import {
  ListingTargetsService,
  TARGETS_ON_APP_STORE_ONLY,
} from './listing-targets.service';

const APP = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
  isCompetitor: false,
};

const build = (app: typeof APP | null = APP) => {
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    keyword: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ country: 'us' }, { country: 'gb' }]),
    },
    listingTarget: {
      findUnique: jest.fn().mockResolvedValue({
        slots: ['habit tracker'],
        updatedAt: new Date('2026-11-25T00:00:00.000Z'),
      }),
    },
  };
  const keywords = { listTracked: jest.fn().mockResolvedValue([]) };
  const pairs = {
    plan: jest.fn().mockResolvedValue({
      plan: { results: [], additions: [] },
      quota: null,
      marketListings: 0,
    }),
    write: jest.fn().mockResolvedValue(0),
    quotaAfterWrite: jest.fn().mockResolvedValue(null),
  };
  const workspace = { require: jest.fn(() => 'ws') };
  const service = new ListingTargetsService(
    prisma as unknown as PrismaService,
    keywords as unknown as KeywordsService,
    pairs as unknown as KeywordPairTracker,
    workspace as unknown as WorkspaceContext,
  );
  return { prisma, keywords, pairs, service };
};

describe('ListingTargetsService.read', () => {
  it('answers the stored slots and the markets reading the localization', async () => {
    const { service, keywords } = build();

    const result = await service.read('app1', 'en-US');

    expect(result).toMatchObject({
      appId: 'app1',
      localization: 'en-US',
      readers: ['us'],
      updatedAt: '2026-11-25T00:00:00.000Z',
    });
    expect(result.slots[0]).toMatchObject({
      text: 'habit tracker',
      untrackedIn: ['us'],
    });
    expect(keywords.listTracked).toHaveBeenCalledWith(
      'app1',
      undefined,
      undefined,
      { brandFacts: true },
    );
  });

  it('refuses a competitor', async () => {
    const { service } = build({ ...APP, isCompetitor: true });

    await expect(service.read('app1', 'en-US')).rejects.toThrow(
      new BadRequestException(COMPETITOR_HAS_NO_LOCALIZATIONS),
    );
  });

  it('refuses a Google Play app', async () => {
    const { service } = build({ ...APP, store: Store.GOOGLE_PLAY });

    await expect(service.read('app1', 'en-US')).rejects.toThrow(
      new BadRequestException(TARGETS_ON_APP_STORE_ONLY),
    );
  });

  it('answers 404 for a missing app', async () => {
    const { service } = build(null);

    await expect(service.read('app1', 'en-US')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ListingTargetsService.save', () => {
  it('refuses a duplicate before planning anything', async () => {
    const { service, pairs } = build();

    await expect(
      service.save('app1', 'en-US', { slots: ['focus', 'Focus'] }),
    ).rejects.toThrow(
      new BadRequestException('Targets 1 and 2 are both "focus"'),
    );
    expect(pairs.plan).not.toHaveBeenCalled();
    expect(pairs.write).not.toHaveBeenCalled();
  });

  it('plans only the phrases new to the stored list in every reader market', async () => {
    const { service, pairs } = build();

    await service.save('app1', 'en-US', {
      slots: ['habit tracker', 'focus timer'],
    });

    expect(pairs.plan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      [{ keyword: 'focus timer', country: 'us' }],
      'us',
    );
  });

  it('plans every slot when asked to track the missing ones', async () => {
    const { service, pairs } = build();

    await service.save('app1', 'en-US', {
      slots: ['habit tracker', 'focus timer'],
      trackMissing: true,
    });

    expect(pairs.plan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      [
        { keyword: 'habit tracker', country: 'us' },
        { keyword: 'focus timer', country: 'us' },
      ],
      'us',
    );
  });

  it('answers the phrases over the keyword limit as not tracked', async () => {
    const { service, pairs } = build();
    pairs.plan.mockResolvedValue({
      plan: {
        results: [
          {
            index: 0,
            keyword: 'focus timer',
            country: 'us',
            status: 'overQuota',
          },
        ],
        additions: [],
      },
      quota: null,
      marketListings: 0,
    });

    const result = await service.save('app1', 'en-US', {
      slots: ['focus timer'],
    });

    expect(result.notTracked).toEqual([
      { text: 'focus timer', country: 'us', reason: 'keywordLimit' },
    ]);
    expect(result.tracked).toBe(0);
  });
});
