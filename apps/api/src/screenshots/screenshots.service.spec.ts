import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { UnknownStorefrontError } from '@asobeast/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScreenshotPolicy } from './screenshot-policy';
import { ScreenshotsService } from './screenshots.service';

const captured = new Date('2026-10-07T03:00:00.000Z');

const row = (position: number, status: string, caption: string | null) => ({
  snapshotId: 'snap_1',
  workspaceId: 'ws_1',
  position,
  url: `https://is1-ssl.mzstatic.com/image/thumb/p/${position}.jpg/392x696bb.jpg`,
  assetKey: `https://is1-ssl.mzstatic.com/image/thumb/p/${position}.jpg`,
  status,
  caption,
  recipe: null,
  readAt: null,
});

const build = (options: {
  app?: { id: string; store: Store; country: string } | null;
  snapshot?: unknown;
  state?: 'on' | 'off' | 'unsupported';
}) => {
  const prisma = {
    app: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'app' in options
            ? options.app
            : { id: 'app_1', store: Store.APP_STORE, country: 'us' },
        ),
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue(options.snapshot ?? null),
    },
  } as unknown as PrismaService;
  const policy = {
    state: jest.fn().mockReturnValue(options.state ?? 'on'),
  } as unknown as ScreenshotPolicy;
  return { service: new ScreenshotsService(prisma, policy), prisma };
};

describe('ScreenshotsService.forApp', () => {
  it('answers 404 for an app the workspace does not own', async () => {
    const { service } = build({ app: null });

    await expect(service.forApp('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists the latest snapshot screenshots in order with their captions', async () => {
    const { service } = build({
      snapshot: {
        id: 'snap_1',
        capturedAt: captured,
        screenshots: [
          row(1, 'read', 'Track every habit'),
          row(2, 'blank', null),
        ],
      },
    });

    await expect(service.forApp('app_1')).resolves.toEqual({
      appId: 'app_1',
      store: 'APP_STORE',
      snapshotId: 'snap_1',
      capturedAt: '2026-10-07T03:00:00.000Z',
      reading: 'on',
      country: 'us',
      screenshots: [
        {
          position: 1,
          url: row(1, '', null).url,
          caption: 'Track every habit',
          status: 'read',
        },
        {
          position: 2,
          url: row(2, '', null).url,
          caption: null,
          status: 'blank',
        },
      ],
    });
  });

  it('asks for the newest snapshot with its screenshots ordered by position', async () => {
    const { service, prisma } = build({ snapshot: null });

    await service.forApp('app_1');

    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledWith({
      where: { appId: 'app_1', country: null },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        capturedAt: true,
        screenshots: { orderBy: { position: 'asc' } },
      },
    });
  });

  it('reads the newest snapshot of a market listing', async () => {
    const { service, prisma } = build({
      snapshot: { id: 'snap_de', capturedAt: captured, screenshots: [] },
    });

    await expect(service.forApp('app_1', 'de')).resolves.toMatchObject({
      snapshotId: 'snap_de',
      country: 'de',
    });
    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appId: 'app_1', country: 'de' } }),
    );
  });

  it('reads the home listing when the home storefront is named', async () => {
    const { service, prisma } = build({ snapshot: null });

    await expect(service.forApp('app_1', 'us')).resolves.toMatchObject({
      snapshotId: null,
      country: 'us',
    });
    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appId: 'app_1', country: null } }),
    );
  });

  it('answers 404 for a market without a captured listing', async () => {
    const { service } = build({ snapshot: null });

    await expect(service.forApp('app_1', 'fr')).rejects.toThrow(
      new NotFoundException('No listing captured for fr'),
    );
  });

  it('refuses a market that is not a storefront of the store', async () => {
    const { service } = build({ snapshot: null });

    await expect(service.forApp('app_1', 'zz')).rejects.toBeInstanceOf(
      UnknownStorefrontError,
    );
  });

  it('answers an app with no snapshot as an empty list', async () => {
    const { service } = build({ snapshot: null });

    await expect(service.forApp('app_1')).resolves.toMatchObject({
      snapshotId: null,
      capturedAt: null,
      screenshots: [],
    });
  });

  it('reports the reading state of the store', async () => {
    const { service } = build({
      app: { id: 'app_2', store: Store.GOOGLE_PLAY, country: 'us' },
      state: 'unsupported',
    });

    await expect(service.forApp('app_2')).resolves.toMatchObject({
      store: 'GOOGLE_PLAY',
      reading: 'unsupported',
    });
  });

  it('never leaks the asset key, recipe or workspace of a row', async () => {
    const { service } = build({
      snapshot: {
        id: 'snap_1',
        capturedAt: captured,
        screenshots: [row(1, 'read', 'x')],
      },
    });

    const { screenshots } = await service.forApp('app_1');

    expect(Object.keys(screenshots[0]).sort()).toEqual([
      'caption',
      'position',
      'status',
      'url',
    ]);
  });
});
