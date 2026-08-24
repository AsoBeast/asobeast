import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import { DiffableChangeSnapshot } from './change-detector';
import { ChangesService } from './changes.service';

function makeSnapshot(
  overrides: Partial<DiffableChangeSnapshot> = {},
): DiffableChangeSnapshot {
  return {
    title: 'My App',
    subtitle: 'A subtitle',
    summary: 'A summary',
    description: 'A description',
    version: '1.0.0',
    price: 0,
    screenshotsCount: 5,
    iconUrl: 'https://cdn/icon-1.png',
    releaseNotes: 'Initial release.',
    ...overrides,
  };
}

describe('ChangesService', () => {
  let service: ChangesService;
  const createMany = jest.fn();
  const findMany = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const appFindMany = jest.fn();
  const dispatch = jest.fn();

  beforeEach(async () => {
    createMany.mockReset();
    findMany.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
    appFindMany.mockReset();
    dispatch.mockReset();
    findUnique.mockResolvedValue({ name: 'Mine', isCompetitor: false });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChangesService,
        {
          provide: PrismaService,
          useValue: {
            changeEvent: { createMany, findMany },
            app: { findFirst, findUnique, findMany: appFindMany },
          },
        },
        { provide: AlertsDispatcher, useValue: { dispatch } },
      ],
    }).compile();
    service = moduleRef.get(ChangesService);
  });

  it('persists a row per detected change and returns them', async () => {
    const prev = makeSnapshot({ title: 'Old' });
    const next = makeSnapshot({ title: 'New', version: '1.1.0' });

    const changes = await service.recordRefresh('app_1', prev, next);

    expect(changes).toEqual([
      { field: 'title', before: 'Old', after: 'New' },
      { field: 'version', before: '1.0.0', after: '1.1.0' },
    ]);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { appId: 'app_1', field: 'title', before: 'Old', after: 'New' },
        { appId: 'app_1', field: 'version', before: '1.0.0', after: '1.1.0' },
      ],
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'metadata.changed',
        app: { id: 'app_1', name: 'Mine', isCompetitor: false },
        changes,
      }),
    );
  });

  it('writes nothing and dispatches nothing when there are no changes', async () => {
    const changes = await service.recordRefresh(
      'app_1',
      makeSnapshot(),
      makeSnapshot(),
    );

    expect(changes).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('writes nothing for the first snapshot', async () => {
    const changes = await service.recordRefresh('app_1', null, makeSnapshot());

    expect(changes).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
  });

  describe('timeline', () => {
    it('throws for an unknown app', async () => {
      findFirst.mockResolvedValue(null);
      await expect(service.timeline('missing', 90)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('queries own and competitor events and maps them', async () => {
      findFirst.mockResolvedValue({
        id: 'app_1',
        competitors: [{ id: 'comp_1' }],
      });
      findMany.mockResolvedValue([
        {
          id: 'ev_2',
          appId: 'comp_1',
          field: 'subtitle',
          before: 'Old',
          after: 'New',
          capturedAt: new Date('2026-07-10T00:00:00Z'),
          app: { name: 'Rival', isCompetitor: true },
        },
        {
          id: 'ev_1',
          appId: 'app_1',
          field: 'title',
          before: 'A',
          after: 'B',
          capturedAt: new Date('2026-07-09T00:00:00Z'),
          app: { name: 'Mine', isCompetitor: false },
        },
      ]);

      const result = await service.timeline('app_1', 90);

      const args = findMany.mock.calls[0][0] as {
        where: { appId: { in: string[] } };
        orderBy: unknown;
        take: number;
      };
      expect(args.where.appId.in).toEqual(['app_1', 'comp_1']);
      expect(args.orderBy).toEqual({ capturedAt: 'desc' });
      expect(args.take).toBe(200);
      expect(result.events).toEqual([
        {
          id: 'ev_2',
          appId: 'comp_1',
          appName: 'Rival',
          isCompetitor: true,
          field: 'subtitle',
          before: 'Old',
          after: 'New',
          capturedAt: '2026-07-10T00:00:00.000Z',
        },
        {
          id: 'ev_1',
          appId: 'app_1',
          appName: 'Mine',
          isCompetitor: false,
          field: 'title',
          before: 'A',
          after: 'B',
          capturedAt: '2026-07-09T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('recent', () => {
    it('queries workspace events newest first with the given limit', async () => {
      appFindMany.mockResolvedValue([{ id: 'app_1' }, { id: 'comp_1' }]);
      findMany.mockResolvedValue([
        {
          id: 'ev_1',
          appId: 'comp_1',
          field: 'title',
          before: 'A',
          after: 'B',
          capturedAt: new Date('2026-07-11T00:00:00Z'),
          app: { name: 'Rival', isCompetitor: true },
        },
      ]);

      const result = await service.recent(20);

      const args = findMany.mock.calls[0][0] as {
        where: { appId: { in: string[] } };
        orderBy: unknown;
        take: number;
      };
      expect(args.where.appId.in).toEqual(['app_1', 'comp_1']);
      expect(args.orderBy).toEqual({ capturedAt: 'desc' });
      expect(args.take).toBe(20);
      expect(result.events).toEqual([
        {
          id: 'ev_1',
          appId: 'comp_1',
          appName: 'Rival',
          isCompetitor: true,
          field: 'title',
          before: 'A',
          after: 'B',
          capturedAt: '2026-07-11T00:00:00.000Z',
        },
      ]);
    });
  });
});
