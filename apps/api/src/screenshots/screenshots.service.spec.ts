import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
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
  app?: { id: string; store: Store } | null;
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
            : { id: 'app_1', store: Store.APP_STORE },
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
      where: { appId: 'app_1' },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        capturedAt: true,
        screenshots: { orderBy: { position: 'asc' } },
      },
    });
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
      app: { id: 'app_2', store: Store.GOOGLE_PLAY },
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
