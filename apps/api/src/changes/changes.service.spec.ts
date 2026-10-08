import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UnknownStorefrontError } from '@asobeast/shared';
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

const keyed = (...keys: string[]) =>
  keys.map((key) => ({ key, url: `${key}/392x696bb.jpg` }));

describe('ChangesService', () => {
  let service: ChangesService;
  const createMany = jest.fn();
  const changeEventFindFirst = jest.fn();
  const findMany = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const appFindMany = jest.fn();
  const dispatch = jest.fn();

  beforeEach(async () => {
    createMany.mockReset();
    changeEventFindFirst.mockReset().mockResolvedValue(null);
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
            changeEvent: {
              createMany,
              findMany,
              findFirst: changeEventFindFirst,
            },
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

  describe('recordMarketRefresh', () => {
    it('persists each change with its market and dispatches no alert', async () => {
      const changes = await service.recordMarketRefresh(
        'app_1',
        { home: 'us', market: 'de' },
        makeSnapshot({ title: 'Alt' }),
        makeSnapshot({ title: 'Neu' }),
      );

      expect(changes).toEqual([
        { field: 'title', before: 'Alt', after: 'Neu' },
      ]);
      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            appId: 'app_1',
            country: 'de',
            field: 'title',
            before: 'Alt',
            after: 'Neu',
          },
        ],
      });
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('files a change of the home market under the home timeline', async () => {
      await service.recordMarketRefresh(
        'app_1',
        { home: 'us', market: 'us' },
        makeSnapshot({ title: 'Alt' }),
        makeSnapshot({ title: 'Neu' }),
      );

      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            appId: 'app_1',
            country: null,
            field: 'title',
            before: 'Alt',
            after: 'Neu',
          },
        ],
      });
    });

    it('writes nothing for the first listing of a market', async () => {
      const changes = await service.recordMarketRefresh(
        'app_1',
        { home: 'us', market: 'de' },
        null,
        makeSnapshot(),
      );

      expect(changes).toEqual([]);
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('timeline', () => {
    const primary = {
      id: 'app_1',
      country: 'us',
      store: 'APP_STORE',
      competitors: [{ id: 'comp_1' }],
    };

    const eventRow = (country: string | null) => ({
      id: 'ev_1',
      appId: 'app_1',
      country,
      field: 'title',
      before: 'A',
      after: 'B',
      capturedAt: new Date('2026-07-09T00:00:00Z'),
      app: { name: 'Mine', isCompetitor: false, country: 'us' },
    });

    it('filters the timeline to the market it is asked for', async () => {
      findFirst.mockResolvedValue(primary);
      findMany.mockResolvedValue([]);

      await service.timeline('app_1', 90, 'de');

      const args = findMany.mock.calls[0][0] as {
        where: { country: string | null };
      };
      expect(args.where.country).toBe('de');
    });

    it('filters the timeline to the home listing when no market is named', async () => {
      findFirst.mockResolvedValue(primary);
      findMany.mockResolvedValue([]);

      await service.timeline('app_1', 90);

      const args = findMany.mock.calls[0][0] as {
        where: { country: string | null };
      };
      expect(args.where.country).toBeNull();
    });

    it('names the market of each event', async () => {
      findFirst.mockResolvedValue(primary);
      findMany.mockResolvedValue([eventRow(null), eventRow('de')]);

      const result = await service.timeline('app_1', 90, 'de');

      expect(result.events.map((event) => event.country)).toEqual(['us', 'de']);
    });

    it('refuses a market that is not a storefront of the store', async () => {
      findFirst.mockResolvedValue(primary);

      await expect(service.timeline('app_1', 90, 'zz')).rejects.toBeInstanceOf(
        UnknownStorefrontError,
      );
    });

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
    it('lists recent changes from the home listing only', async () => {
      appFindMany.mockResolvedValue([{ id: 'app_1' }]);
      findMany.mockResolvedValue([]);

      await service.recent(20);

      const args = findMany.mock.calls[0][0] as {
        where: { country: string | null };
      };
      expect(args.where.country).toBeNull();
    });

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

  describe('screenshot changes', () => {
    it('persists the detail of a change next to its field', async () => {
      const prev = makeSnapshot({
        screenshotsCount: 3,
        screenshots: keyed('a', 'b', 'c'),
      });
      const next = makeSnapshot({
        screenshotsCount: 3,
        screenshots: keyed('a', 'x', 'c'),
        title: 'New title',
      });

      await service.recordRefresh('app_1', prev, next);

      const [{ data }] = createMany.mock.calls[0] as [
        { data: Array<Record<string, unknown>> },
      ];
      expect(data).toHaveLength(2);
      const title = data.find((row) => row.field === 'title');
      const images = data.find((row) => row.field === 'screenshotImages');
      expect(title && 'detail' in title).toBe(false);
      expect(images).toMatchObject({
        appId: 'app_1',
        before: '3 screenshots',
        after: '3 screenshots, 1 replaced',
        detail: {
          kind: 'images',
          added: [2],
          removed: [2],
        },
      });
    });

    it('sends alerts the field and the two readable values only', async () => {
      const prev = makeSnapshot({
        screenshotsCount: 3,
        screenshots: keyed('a', 'b', 'c'),
      });
      const next = makeSnapshot({
        screenshotsCount: 3,
        screenshots: keyed('a', 'x', 'c'),
      });

      await service.recordRefresh('app_1', prev, next);

      const [payload] = dispatch.mock.calls[0] as [
        { changes: Array<Record<string, unknown>> },
      ];
      expect(payload.changes).toEqual([
        {
          field: 'screenshotImages',
          before: '3 screenshots',
          after: '3 screenshots, 1 replaced',
        },
      ]);
    });

    it('returns the detail on a timeline item and leaves it out when there is none', async () => {
      findFirst.mockResolvedValue({ id: 'app_1', competitors: [] });
      const detail = { kind: 'captions', added: ['B'], removed: ['A'] };
      findMany.mockResolvedValue([
        {
          id: 'ev_2',
          appId: 'app_1',
          field: 'screenshotCaptions',
          before: 'A',
          after: 'B',
          detail,
          capturedAt: new Date('2026-07-10T00:00:00Z'),
          app: { name: 'Mine', isCompetitor: false },
        },
        {
          id: 'ev_1',
          appId: 'app_1',
          field: 'title',
          before: 'A',
          after: 'B',
          detail: null,
          capturedAt: new Date('2026-07-09T00:00:00Z'),
          app: { name: 'Mine', isCompetitor: false },
        },
      ]);

      const { events } = await service.timeline('app_1', 90);

      expect(events[0].detail).toEqual(detail);
      expect('detail' in events[1]).toBe(false);
    });

    const captionChange = {
      appId: 'app_1',
      since: new Date('2026-10-07T03:00:00.000Z'),
      before: ['A', 'B'],
      after: ['A', 'C'],
      added: ['C'],
      removed: ['B'],
    };

    it('records a caption change with the captions as readable text', async () => {
      await service.recordCaptionChange(captionChange);

      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            appId: 'app_1',
            field: 'screenshotCaptions',
            before: 'A | B',
            after: 'A | C',
            detail: { kind: 'captions', added: ['C'], removed: ['B'] },
            capturedAt: captionChange.since,
          },
        ],
      });
      const [payload] = dispatch.mock.calls[0] as [
        { changes: Array<Record<string, unknown>> },
      ];
      expect(payload.changes).toEqual([
        { field: 'screenshotCaptions', before: 'A | B', after: 'A | C' },
      ]);
    });

    it('truncates long caption text like every other long value and keeps the captions whole in the detail', async () => {
      const long = (letter: string) => letter.repeat(200);
      await service.recordCaptionChange({
        ...captionChange,
        before: [long('a'), long('b')],
        after: [long('a'), long('c')],
        added: [long('c')],
        removed: [long('b')],
      });

      const [{ data }] = createMany.mock.calls[0] as [
        {
          data: Array<{
            before: string;
            after: string;
            detail: { added: string[]; removed: string[] };
          }>;
        },
      ];
      expect(data[0].before).toBe(`${long('a')} | ${'b'.repeat(97)}…`);
      expect(data[0].after).toBe(`${long('a')} | ${'c'.repeat(97)}…`);
      expect(data[0].detail).toMatchObject({
        added: [long('c')],
        removed: [long('b')],
      });
      const [payload] = dispatch.mock.calls[0] as [
        { changes: Array<{ before: string; after: string }> },
      ];
      expect(payload.changes[0].after).toBe(data[0].after);
    });

    it('writes a null side when every caption is gone', async () => {
      await service.recordCaptionChange({
        ...captionChange,
        before: ['A'],
        after: [],
        added: [],
        removed: ['A'],
      });

      const [{ data }] = createMany.mock.calls[0] as [
        { data: Array<{ before: string | null; after: string | null }> },
      ];
      expect(data[0]).toMatchObject({ before: 'A', after: null });
    });

    it('records a caption change once per snapshot', async () => {
      changeEventFindFirst.mockResolvedValue({ id: 'ev_1' });

      await service.recordCaptionChange(captionChange);

      expect(changeEventFindFirst).toHaveBeenCalledWith({
        where: {
          appId: 'app_1',
          country: null,
          field: 'screenshotCaptions',
          capturedAt: captionChange.since,
        },
        select: { id: true },
      });
      expect(createMany).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
