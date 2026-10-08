import type { ChangesService } from '../changes/changes.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CaptionChangeRecorder } from './caption-change-recorder';

const CAPTURED = new Date('2026-10-07T03:00:00.000Z');
const snapshot = { id: 'snap_2', appId: 'app_1', capturedAt: CAPTURED };

const row = (status: string, caption: string | null) => ({ status, caption });

const build = (options: {
  current?: unknown[];
  previous?: unknown[];
  previousSnapshot?: { id: string } | null;
}) => {
  const findMany = jest
    .fn()
    .mockResolvedValueOnce(options.current ?? [])
    .mockResolvedValueOnce(options.previous ?? []);
  const findFirst = jest
    .fn()
    .mockResolvedValue(
      'previousSnapshot' in options
        ? options.previousSnapshot
        : { id: 'snap_1' },
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
      where: { appId: 'app_1', capturedAt: { lt: CAPTURED } },
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
});
