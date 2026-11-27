import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { TrackedKeywordItem } from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMPETITOR_DRAFT_REFUSAL,
  CoveragePreviewService,
} from './coverage-preview.service';

const tracked = (
  text: string,
  country = 'us',
  active = true,
): TrackedKeywordItem => ({
  keywordId: `kw_${text}_${country}`,
  text,
  country,
  source: 'MANUAL',
  active,
  latestPosition: null,
  latestDepth: null,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: null,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
});

const listing = (
  id: string,
  title: string,
  extra: { subtitle?: string; summary?: string } = {},
) => ({
  id,
  title,
  subtitle: extra.subtitle ?? null,
  summary: extra.summary ?? extra.subtitle ?? null,
  description: '',
});

interface Options {
  store?: Store;
  isCompetitor?: boolean;
  missing?: boolean;
  listings?: Record<string, ReturnType<typeof listing>>;
  tracked?: TrackedKeywordItem[];
  competitors?: string[];
  fields?: { localization: string; phrases: string[] }[];
  targets?: string[];
}

const build = (options: Options = {}) => {
  const listings = options.listings ?? {
    home: listing('snap_us', 'Focus Timer', { subtitle: 'Daily goals' }),
  };
  const keywords = options.tracked ?? [
    tracked('focus timer'),
    tracked('daily goals'),
    tracked('habit tracker'),
    tracked('sleep sounds'),
  ];
  const app = {
    id: 'app_1',
    workspaceId: 'ws_1',
    store: options.store ?? Store.APP_STORE,
    country: 'us',
    storeAppId: '1',
    isCompetitor: options.isCompetitor ?? false,
    name: 'Zenly',
  };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(options.missing ? null : app),
      findMany: jest
        .fn()
        .mockResolvedValue(
          (options.competitors ?? []).map((name) => ({ name })),
        ),
    },
    keyword: {
      findMany: jest.fn().mockResolvedValue(
        [...new Set(keywords.map((item) => item.country))].map((country) => ({
          country,
        })),
      ),
    },
    appSnapshot: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { country: string | null; localization: string | null };
        }) =>
          Promise.resolve(
            listings[
              [where.country ?? 'home', where.localization]
                .filter(Boolean)
                .join(':')
            ] ?? null,
          ),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    keywordField: {
      findMany: jest.fn().mockResolvedValue(options.fields ?? []),
    },
    appLocalization: { findMany: jest.fn().mockResolvedValue([]) },
    listingTarget: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.targets ? { slots: options.targets } : null),
    },
  } as unknown as PrismaService;
  const keywordsService = {
    listTracked: jest.fn().mockResolvedValue(keywords),
  } as unknown as KeywordsService;
  return new CoveragePreviewService(prisma, keywordsService);
};

describe('CoveragePreviewService.preview', () => {
  it('refuses a competitor with the draft sentence', async () => {
    await expect(
      build({ isCompetitor: true }).preview('app_1', { title: 'Habit' }),
    ).rejects.toThrow(new BadRequestException(COMPETITOR_DRAFT_REFUSAL));
  });

  it('answers 404 for a missing app', async () => {
    await expect(
      build({ missing: true }).preview('app_1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a subtitle or keyword field for a Google Play app', async () => {
    const service = build({ store: Store.GOOGLE_PLAY });
    const sentence =
      'Google Play has no subtitle or keyword field; draft the short description instead';

    await expect(service.preview('app_1', { subtitle: 'x' })).rejects.toThrow(
      sentence,
    );
    await expect(
      service.preview('app_1', { keywordField: 'x' }),
    ).rejects.toThrow(sentence);
  });

  it('refuses a localization for a Google Play app and a short description for an App Store app', async () => {
    await expect(
      build({ store: Store.GOOGLE_PLAY }).preview('app_1', {
        localization: 'en-US',
      }),
    ).rejects.toThrow(
      'Google Play has no localizations; name the market with country instead',
    );
    await expect(
      build().preview('app_1', { shortDescription: 'x' }),
    ).rejects.toThrow(
      'The App Store has no short description; draft the subtitle instead',
    );
    await expect(build().preview('app_1', { country: 'us' })).rejects.toThrow(
      'An App Store draft names a localization, never a country',
    );
  });

  it('judges the target keywords of the drafted localization', async () => {
    const result = await build({
      targets: ['habit tracker', '', 'focus timer'],
    }).preview('app_1', { title: 'Habit Tracker' });

    expect(result.targets).toEqual([
      expect.objectContaining({
        position: 1,
        role: 'title',
        text: 'habit tracker',
        live: expect.objectContaining({ covered: false }) as unknown,
        draft: expect.objectContaining({ covered: true }) as unknown,
      }),
      expect.objectContaining({
        position: 3,
        role: 'subtitle',
        text: 'focus timer',
        live: expect.objectContaining({ covered: true }) as unknown,
        draft: expect.objectContaining({ covered: false }) as unknown,
      }),
    ]);
  });

  it('answers no targets field for a localization without targets', async () => {
    const result = await build().preview('app_1', { title: 'Habit Tracker' });

    expect(result).not.toHaveProperty('targets');
  });

  it('refuses a country that is not a market of the app', async () => {
    const service = build({ store: Store.GOOGLE_PLAY });

    await expect(service.preview('app_1', { country: 'zz' })).rejects.toThrow(
      'zz is not a Google Play location',
    );
    await expect(service.preview('app_1', { country: 'de' })).rejects.toThrow(
      'DE is not a market of this app',
    );
  });

  it('refuses text over its cap in code points', async () => {
    await expect(
      build().preview('app_1', { title: '❤️'.repeat(600) }),
    ).rejects.toThrow('title must be at most 1000 characters');
  });

  it('defaults to the home localization on the App Store and the home country on Google Play', async () => {
    const appStore = await build().preview('app_1', {});
    const play = await build({ store: Store.GOOGLE_PLAY }).preview('app_1', {});

    expect(appStore).toMatchObject({ localization: 'en-US', markets: ['us'] });
    expect('country' in appStore).toBe(false);
    expect(play).toMatchObject({ country: 'us', markets: ['us'] });
    expect('localization' in play).toBe(false);
  });

  it('judges an unshipped localization without throwing', async () => {
    const result = await build().preview('app_1', {
      localization: 'it',
      title: 'Minuteur',
    });

    expect(result).toMatchObject({
      localization: 'it',
      markets: [],
      waitingMarkets: [],
      keywords: [],
    });
    expect(result.fields[0]).toMatchObject({
      field: 'title',
      value: 'Minuteur',
    });
  });

  it('lints the draft with the same context as the audit', async () => {
    const result = await build({ competitors: ['Forest'] }).preview('app_1', {
      keywordField: 'forest,habit',
    });

    const field = result.fields.find((entry) => entry.field === 'keywordField');
    expect(field?.issues.map((issue) => issue.rule)).toContain(
      'contains-competitor-brand',
    );
  });

  it('counts each change and judges only active keywords', async () => {
    const result = await build({
      tracked: [
        tracked('focus timer'),
        tracked('daily goals'),
        tracked('habit tracker'),
        tracked('sleep sounds'),
        tracked('paused phrase', 'us', false),
      ],
    }).preview('app_1', { title: 'Habit Tracker' });

    expect(result.keywords.map((row) => [row.change, row.text])).toEqual([
      ['lost', 'focus timer'],
      ['gained', 'habit tracker'],
      ['missing', 'sleep sounds'],
      ['kept', 'daily goals'],
    ]);
    expect(result.counts).toEqual({ lost: 1, gained: 1, missing: 1, kept: 1 });
  });

  it('counts a word a waiting market tracks as used', async () => {
    const result = await build({
      tracked: [tracked('focus timer'), tracked('habit tracker', 'gb')],
    }).preview('app_1', {
      localization: 'en-GB',
      subtitle: 'habit planner',
    });

    expect(result).toMatchObject({ markets: [], waitingMarkets: ['gb'] });
    expect(result.wastedWords).toEqual([
      { word: 'planner', reason: 'unused', fields: ['subtitle'] },
    ]);
  });

  it('reports the wasted words of the draft and never the brand', async () => {
    const result = await build().preview('app_1', {
      title: 'Zenly Habit Tracker',
      subtitle: 'Daily goals habit',
    });

    expect(result.wastedWords).toEqual([
      { word: 'habit', reason: 'repeated', fields: ['title', 'subtitle'] },
    ]);
  });
});
