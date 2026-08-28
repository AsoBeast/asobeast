import { completionHours, nextDailyRun, nextWeeklyRun } from './daily-schedule';

describe('nextDailyRun', () => {
  it('reads the next run from a daily cron', () => {
    expect(nextDailyRun('0 3 * * *', new Date('2026-08-08T01:00:00Z'))).toEqual(
      new Date('2026-08-08T03:00:00Z'),
    );
  });

  it('rolls to tomorrow once today has passed', () => {
    expect(nextDailyRun('0 3 * * *', new Date('2026-08-08T04:00:00Z'))).toEqual(
      new Date('2026-08-09T03:00:00Z'),
    );
  });

  it('rolls forward on the exact minute rather than reporting the past', () => {
    expect(nextDailyRun('0 3 * * *', new Date('2026-08-08T03:00:00Z'))).toEqual(
      new Date('2026-08-09T03:00:00Z'),
    );
  });

  it('stays in utc across a month boundary', () => {
    expect(
      nextDailyRun('30 23 * * *', new Date('2026-08-31T23:45:00Z')),
    ).toEqual(new Date('2026-09-01T23:30:00Z'));
  });

  it('reports nothing for a schedule that is not once a day', () => {
    expect(nextDailyRun('*/15 * * * *', new Date())).toBeNull();
    expect(nextDailyRun('0 3 * * 0', new Date())).toBeNull();
  });

  it('reports nothing for an out of range time', () => {
    expect(nextDailyRun('0 25 * * *', new Date())).toBeNull();
  });
});

describe('nextWeeklyRun', () => {
  it('reads the coming weekday from a weekly cron', () => {
    expect(
      nextWeeklyRun('0 4 * * 0', new Date('2026-08-10T09:00:00Z')),
    ).toEqual(new Date('2026-08-16T04:00:00Z'));
  });

  it('stays on the same day when the hour is still ahead', () => {
    expect(
      nextWeeklyRun('0 4 * * 0', new Date('2026-08-16T03:00:00Z')),
    ).toEqual(new Date('2026-08-16T04:00:00Z'));
  });

  it('rolls a week forward once the hour has passed', () => {
    expect(
      nextWeeklyRun('0 4 * * 0', new Date('2026-08-16T05:00:00Z')),
    ).toEqual(new Date('2026-08-23T04:00:00Z'));
  });

  it('rolls forward on the exact minute rather than reporting the past', () => {
    expect(
      nextWeeklyRun('0 4 * * 0', new Date('2026-08-16T04:00:00Z')),
    ).toEqual(new Date('2026-08-23T04:00:00Z'));
  });

  it('treats sunday as seven exactly as cron does', () => {
    const now = new Date('2026-08-10T09:00:00Z');
    expect(nextWeeklyRun('0 4 * * 7', now)).toEqual(
      nextWeeklyRun('0 4 * * 0', now),
    );
  });

  it('stays in utc across a month boundary', () => {
    expect(
      nextWeeklyRun('30 23 * * 0', new Date('2026-08-30T23:45:00Z')),
    ).toEqual(new Date('2026-09-06T23:30:00Z'));
  });

  it('reports nothing for a schedule that is not once a week', () => {
    const now = new Date('2026-08-10T09:00:00Z');
    expect(nextWeeklyRun('0 3 * * *', now)).toBeNull();
    expect(nextWeeklyRun('*/15 * * * 0', now)).toBeNull();
    expect(nextWeeklyRun('0 4 * * 1-5', now)).toBeNull();
    expect(nextWeeklyRun('', now)).toBeNull();
  });

  it('reports nothing for an out of range time', () => {
    const now = new Date('2026-08-10T09:00:00Z');
    expect(nextWeeklyRun('0 24 * * 0', now)).toBeNull();
    expect(nextWeeklyRun('60 4 * * 0', now)).toBeNull();
  });
});

describe('completionHours', () => {
  it('divides the day of work by the hourly capacity', () => {
    expect(completionHours(1_200, 2_400)).toBe(12);
  });

  it('says nothing when there is no capacity to divide by', () => {
    expect(completionHours(1_200, 0)).toBeNull();
  });

  it('completes instantly with nothing to do', () => {
    expect(completionHours(0, 2_400)).toBe(0);
  });

  it('completes instantly when a store has neither work nor capacity', () => {
    expect(completionHours(0, 0)).toBe(0);
  });
});
