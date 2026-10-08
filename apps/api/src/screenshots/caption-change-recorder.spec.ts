import type { ChangesService } from '../changes/changes.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CaptionChangeRecorder } from './caption-change-recorder';

const CAPTURED = new Date('2026-10-07T03:00:00.000Z');
const HOME = { home: 'us', market: 'us' };
const snapshot = {
  id: 'snap_2',
  appId: 'app_1',
  capturedAt: CAPTURED,
  listing: HOME,
};

const row = (status: string, caption: string | null) => ({ status, caption });

const NEXT_CAPTURED = new Date('2026-10-08T03:00:00.000Z');

const build = (options: {
  current?: unknown[];
  previous?: unknown[];
  previousSnapshot?: { id: string } | null;
  next?: unknown[];
  nextSnapshot?: { id: string; capturedAt: Date } | null;
}) => {
  const rowsOf: Record<string, unknown[]> = {
    snap_1: options.previous ?? [],
    snap_2: options.current ?? [],
    snap_3: options.next ?? [],
  };
  const findMany = jest.fn(({ where }: { where: { snapshotId: string } }) =>
    Promise.resolve(rowsOf[where.snapshotId] ?? []),
  );
  const findFirst = jest.fn(
    ({ where }: { where: { capturedAt: { lt?: Date; gt?: Date } } }) =>
      Promise.resolve(
        where.capturedAt.lt
          ? 'previousSnapshot' in options
            ? options.previousSnapshot
            : { id: 'snap_1' }
          : (options.nextSnapshot ?? null),
      ),
  );
  const recordCaptionChange = jest.fn().mockResolvedValue(undefined);
  const recorder = new CaptionChangeRecorder(
    {
      snapshotScreenshot: { findMany },
      appSnapshot: { findFirst },
    } as unknown as PrismaService,
    { recordCaptionChange } as unknown as ChangesService,
  );
  return { recorder, findMany, findFirst, recordCaptionChange };
};

describe('CaptionChangeRecorder.record', () => {
  it('records one change with the captions that appeared and disappeared', async () => {
    const { recorder, recordCaptionChange } = build({
      previous: [row('read', 'Plan your week'), row('read', 'Keep this')],
      current: [row('read', 'Plan your day'), row('read', 'Keep this')],
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).toHaveBeenCalledWith({
      appId: 'app_1',
      listing: HOME,
      since: CAPTURED,
      before: ['Plan your week', 'Keep this'],
      after: ['Plan your day', 'Keep this'],
      added: ['Plan your day'],
      removed: ['Plan your week'],
    });
  });

  it('looks for the newest snapshot captured before this one', async () => {
    const { recorder, findFirst } = build({
      previous: [row('read', 'a')],
      current: [row('read', 'a')],
    });

    await recorder.record(snapshot);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: null,
        localization: null,
        capturedAt: { lt: CAPTURED },
      },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
  });

  it('records nothing when the captions did not change', async () => {
    const { recorder, recordCaptionChange } = build({
      previous: [row('read', 'Same')],
      current: [row('read', 'Same')],
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).not.toHaveBeenCalled();
  });

  it('records nothing when there is no earlier snapshot', async () => {
    const { recorder, recordCaptionChange } = build({
      current: [row('read', 'a')],
      previousSnapshot: null,
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).not.toHaveBeenCalled();
  });

  it('records nothing when the earlier snapshot has no screenshots recorded', async () => {
    const { recorder, recordCaptionChange } = build({
      current: [row('read', 'a')],
      previous: [],
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).not.toHaveBeenCalled();
  });

  it.each(['pending', 'failed', 'skipped'])(
    'records nothing while a screenshot of this snapshot is %s',
    async (status) => {
      const { recorder, recordCaptionChange } = build({
        previous: [row('read', 'a')],
        current: [row('read', 'b'), row(status, null)],
      });

      await recorder.record(snapshot);

      expect(recordCaptionChange).not.toHaveBeenCalled();
    },
  );

  it('records nothing when a screenshot of the earlier snapshot failed to read', async () => {
    const { recorder, recordCaptionChange } = build({
      previous: [row('read', 'a'), row('failed', null)],
      current: [row('read', 'b')],
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).not.toHaveBeenCalled();
  });

  it('counts a blank screenshot as settled and as no caption', async () => {
    const { recorder, recordCaptionChange } = build({
      previous: [row('read', 'Plan your week'), row('blank', null)],
      current: [row('blank', null), row('blank', null)],
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).toHaveBeenCalledWith(
      expect.objectContaining({ removed: ['Plan your week'], added: [] }),
    );
  });

  it('compares a market snapshot with the snapshots of that market only', async () => {
    const { recorder, findFirst, recordCaptionChange } = build({
      previous: [row('read', 'Plane deine Woche')],
      current: [row('read', 'Plane deinen Tag')],
    });
    const listing = { home: 'us', market: 'de' };

    await recorder.record({ ...snapshot, listing });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: 'de',
        localization: null,
        capturedAt: { lt: CAPTURED },
      },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: 'de',
        localization: null,
        capturedAt: { gt: CAPTURED },
      },
      orderBy: { capturedAt: 'asc' },
      select: { id: true, capturedAt: true },
    });
    expect(recordCaptionChange).toHaveBeenCalledWith(
      expect.objectContaining({ listing }),
    );
  });

  it('compares a localized snapshot with the snapshots of that localization only', async () => {
    const { recorder, findFirst } = build({
      previous: [row('read', 'Zwiedzaj')],
      current: [row('read', 'Odkrywaj')],
    });
    const listing = { home: 'pl', market: 'pl', localization: 'pl' };

    await recorder.record({ ...snapshot, listing });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: null,
        localization: 'pl',
        capturedAt: { lt: CAPTURED },
      },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: null,
        localization: 'pl',
        capturedAt: { gt: CAPTURED },
      },
      orderBy: { capturedAt: 'asc' },
      select: { id: true, capturedAt: true },
    });
  });

  it('looks for the oldest snapshot captured after this one', async () => {
    const { recorder, findFirst } = build({
      previous: [row('read', 'a')],
      current: [row('read', 'a')],
    });

    await recorder.record(snapshot);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: null,
        localization: null,
        capturedAt: { gt: CAPTURED },
      },
      orderBy: { capturedAt: 'asc' },
      select: { id: true, capturedAt: true },
    });
  });

  it('compares the next snapshot when it settled before this one', async () => {
    const { recorder, recordCaptionChange } = build({
      previous: [row('read', 'Plan your week')],
      current: [row('read', 'Plan your week')],
      next: [row('read', 'Plan your day')],
      nextSnapshot: { id: 'snap_3', capturedAt: NEXT_CAPTURED },
    });

    await recorder.record(snapshot);

    expect(recordCaptionChange).toHaveBeenCalledTimes(1);
    expect(recordCaptionChange).toHaveBeenCalledWith({
      appId: 'app_1',
      listing: HOME,
      since: NEXT_CAPTURED,
      before: ['Plan your week'],
      after: ['Plan your day'],
      added: ['Plan your day'],
      removed: ['Plan your week'],
    });
  });

  it('records both changes when this snapshot settles between two others', async () => {
    const { recorder, recordCaptionChange } = build({
      previous: [row('read', 'Track habits')],
      current: [row('read', 'Plan your week')],
      next: [row('read', 'Plan your day')],
      nextSnapshot: { id: 'snap_3', capturedAt: NEXT_CAPTURED },
    });

    await recorder.record(snapshot);

    expect(
      recordCaptionChange.mock.calls.map(
        ([change]: [{ since: Date }]) => change.since,
      ),
    ).toEqual([CAPTURED, NEXT_CAPTURED]);
  });

  it.each(['pending', 'failed', 'skipped'])(
    'leaves the next snapshot alone while one of its screenshots is %s',
    async (status) => {
      const { recorder, recordCaptionChange } = build({
        previousSnapshot: null,
        current: [row('read', 'a')],
        next: [row('read', 'b'), row(status, null)],
        nextSnapshot: { id: 'snap_3', capturedAt: NEXT_CAPTURED },
      });

      await recorder.record(snapshot);

      expect(recordCaptionChange).not.toHaveBeenCalled();
    },
  );

  it('compares nothing while this snapshot is still reading', async () => {
    const { recorder, findFirst, recordCaptionChange } = build({
      previous: [row('read', 'a')],
      current: [row('pending', null)],
      next: [row('read', 'b')],
      nextSnapshot: { id: 'snap_3', capturedAt: NEXT_CAPTURED },
    });

    await recorder.record(snapshot);

    expect(findFirst).not.toHaveBeenCalled();
    expect(recordCaptionChange).not.toHaveBeenCalled();
  });
});
