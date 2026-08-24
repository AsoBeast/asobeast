import { completionHours, nextDailyRun } from './daily-schedule';

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
