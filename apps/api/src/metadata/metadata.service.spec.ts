import { Store } from '@prisma/client';
import type { TrackedKeywordItem } from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ScreenshotPolicy } from '../screenshots/screenshot-policy';
import { ScreenshotsService } from '../screenshots/screenshots.service';
import { MetadataService } from './metadata.service';

const tracked = (text: string, country: string): TrackedKeywordItem => ({
  keywordId: `kw_${text}_${country}`,
  text,
  country,
  source: 'MANUAL',
  active: true,
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

const listing = (id: string, title: string) => ({
  id,
  title,
  subtitle: null,
  summary: null,
  description: '',
});

const shot = (snapshotId: string, position: number, caption: string) => ({
  snapshotId,
  workspaceId: 'ws_1',
  position,
  url: `https://is1-ssl.mzstatic.com/image/thumb/${snapshotId}/${position}.jpg`,
  assetKey: `${snapshotId}/${position}`,
  status: 'read',
  caption,
  recipe: null,
  readAt: null,
});

const build = (store: Store) => {
  const listings: Record<string, ReturnType<typeof listing>> = {
    home: listing('snap_us', 'Focus Timer'),
    de: listing('snap_de', 'Fokus Timer'),
  };
  const appSnapshot = {
    findFirst: jest.fn(({ where }: { where: { country: string | null } }) =>
      Promise.resolve(listings[where.country ?? 'home'] ?? null),
    ),
  };
  const snapshotScreenshot = {
    findMany: jest
      .fn()
      .mockResolvedValue([
        shot('snap_us', 1, 'Track every habit'),
        shot('snap_de', 1, 'Gewohnheiten verfolgen'),
      ]),
  };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app_1',
        store,
        name: 'Focus Timer',
        country: 'us',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    appSnapshot,
    snapshotScreenshot,
  } as unknown as PrismaService;
  const keywords = {
    listTracked: jest
      .fn()
      .mockResolvedValue([
        tracked('habit', 'us'),
        tracked('gewohnheiten', 'de'),
        tracked('habit', 'de'),
      ]),
  } as unknown as KeywordsService;
  const policy = {
    state: jest
      .fn()
      .mockReturnValue(store === Store.GOOGLE_PLAY ? 'unsupported' : 'on'),
  } as unknown as ScreenshotPolicy;
  const service = new MetadataService(
    prisma,
    keywords,
    new ScreenshotsService(prisma, policy),
  );
  return { service, appSnapshot, snapshotScreenshot };
};

describe('MetadataService.audit', () => {
  it('reads each listing once and takes its screenshots from that snapshot', async () => {
    const { service, appSnapshot, snapshotScreenshot } = build(Store.APP_STORE);

    const result = await service.audit('app_1');

    expect(appSnapshot.findFirst).toHaveBeenCalledTimes(2);
    expect(snapshotScreenshot.findMany).toHaveBeenCalledTimes(1);
    expect(snapshotScreenshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { snapshotId: { in: ['snap_us', 'snap_de'] } },
      }),
    );
    expect(
      result.coverage.map((row) => [row.text, row.screenshotText]),
    ).toEqual([
      ['habit', { covered: true, positions: [1] }],
      ['gewohnheiten', { covered: true, positions: [1] }],
      ['habit', { covered: false, positions: [] }],
    ]);
  });

  it('never reads screenshots for a google play audit', async () => {
    const { service, appSnapshot, snapshotScreenshot } = build(
      Store.GOOGLE_PLAY,
    );

    const result = await service.audit('app_1');

    expect(appSnapshot.findFirst).toHaveBeenCalledTimes(2);
    expect(snapshotScreenshot.findMany).not.toHaveBeenCalled();
    expect('screenshotText' in result).toBe(false);
  });
});
