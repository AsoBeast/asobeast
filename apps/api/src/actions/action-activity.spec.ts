import { activityWindow, bucketActivity } from './action-activity';

const TODAY = new Date('2026-07-30T15:00:00.000Z');
const { from, to } = activityWindow(TODAY, 7);
const at = (iso: string) => new Date(iso);

describe('activityWindow', () => {
  it('ends today and covers exactly the requested days', () => {
    expect(from.toISOString()).toBe('2026-07-24T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-07-30T00:00:00.000Z');
  });
});

describe('bucketActivity', () => {
  it('returns one zero-filled entry per day in ascending order', () => {
    const activity = bucketActivity([], from, to);

    expect(activity.days.map((day) => day.date)).toEqual([
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
    ]);
    expect(activity.days.every((day) => day.opened === 0)).toBe(true);
    expect(activity).toMatchObject({ from: '2026-07-24', to: '2026-07-30' });
  });

  it('puts events on their own UTC day at the edges', () => {
    const activity = bucketActivity(
      [
        { type: 'opened', occurredAt: at('2026-07-28T23:59:59.999Z') },
        { type: 'done', occurredAt: at('2026-07-29T00:00:00.000Z') },
      ],
      from,
      to,
    );

    expect(activity.days[4]).toMatchObject({ date: '2026-07-28', opened: 1 });
    expect(activity.days[5]).toMatchObject({
      date: '2026-07-29',
      opened: 0,
      done: 1,
    });
  });

  it('never counts snoozes or wake ups', () => {
    const activity = bucketActivity(
      [
        { type: 'snoozed', occurredAt: at('2026-07-29T10:00:00.000Z') },
        { type: 'woke', occurredAt: at('2026-07-29T11:00:00.000Z') },
      ],
      from,
      to,
    );

    expect(Object.values(activity.totals).every((count) => count === 0)).toBe(
      true,
    );
  });

  it('totals the days', () => {
    const activity = bucketActivity(
      [
        { type: 'opened', occurredAt: at('2026-07-25T10:00:00.000Z') },
        { type: 'opened', occurredAt: at('2026-07-26T10:00:00.000Z') },
        { type: 'verified', occurredAt: at('2026-07-26T10:00:00.000Z') },
        { type: 'dismissed', occurredAt: at('2026-07-30T10:00:00.000Z') },
      ],
      from,
      to,
    );

    expect(activity.totals).toEqual({
      opened: 2,
      reopened: 0,
      done: 0,
      dismissed: 1,
      resolved: 0,
      verified: 1,
    });
    expect(activity.days.reduce((sum, day) => sum + day.opened, 0)).toBe(
      activity.totals.opened,
    );
  });

  it('ignores an event before the window', () => {
    const activity = bucketActivity(
      [{ type: 'opened', occurredAt: at('2026-07-23T23:00:00.000Z') }],
      from,
      to,
    );

    expect(activity.totals.opened).toBe(0);
  });
});
