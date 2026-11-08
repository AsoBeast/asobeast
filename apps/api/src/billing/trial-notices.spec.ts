import {
  CHARGE_REMINDER,
  TRIAL_ENDED_NOTICE,
  dueTrialNotice,
  timeLeftLabel,
} from './trial-notices';

const START = new Date('2026-08-01T09:30:00.000Z');
const ENDS = new Date('2026-08-08T09:30:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const at = (days: number) => new Date(START.getTime() + days * DAY_MS);
const hoursBeforeEnd = (hours: number) =>
  new Date(ENDS.getTime() - hours * HOUR_MS);

describe('dueTrialNotice', () => {
  const progress = (trialNoticeDay: number | null) => ({
    trialStartedAt: START,
    trialEndsAt: ENDS,
    trialNoticeDay,
  });

  it('welcomes the workspace on the day the trial opens', () => {
    expect(dueTrialNotice(progress(null), START)).toBe(0);
  });

  it('says nothing twice on the same milestone', () => {
    expect(dueTrialNotice(progress(0), at(0.5))).toBeNull();
  });

  it('walks the milestones as the trial runs down', () => {
    expect(dueTrialNotice(progress(0), at(3))).toBe(3);
    expect(dueTrialNotice(progress(3), hoursBeforeEnd(74))).toBe(
      CHARGE_REMINDER,
    );
    expect(dueTrialNotice(progress(CHARGE_REMINDER), ENDS)).toBe(
      TRIAL_ENDED_NOTICE,
    );
  });

  it('holds the reminder until 74 hours before the charge', () => {
    expect(dueTrialNotice(progress(3), hoursBeforeEnd(74.5))).toBeNull();
  });

  it('sends the reminder at least 72 hours ahead on an hourly sweep', () => {
    const sweeps = Array.from(
      { length: 7 * 24 },
      (_, hour) => new Date(START.getTime() + hour * HOUR_MS),
    );
    const first = sweeps.find(
      (sweep) => dueTrialNotice(progress(3), sweep) === CHARGE_REMINDER,
    );

    expect(first).toBeDefined();
    expect(ENDS.getTime() - Number(first?.getTime())).toBeGreaterThanOrEqual(
      72 * HOUR_MS,
    );
  });

  it('still reminds a late sweep while the charge is ahead', () => {
    expect(dueTrialNotice(progress(3), hoursBeforeEnd(5))).toBe(
      CHARGE_REMINDER,
    );
  });

  it('never reminds once the trial is over', () => {
    expect(dueTrialNotice(progress(3), ENDS)).toBe(TRIAL_ENDED_NOTICE);
  });

  it('sends only the newest milestone after a missed run', () => {
    expect(dueTrialNotice(progress(0), at(6))).toBe(CHARGE_REMINDER);
  });

  it('counts the reminder from the end of a longer trial', () => {
    const fourteen = {
      trialStartedAt: START,
      trialEndsAt: at(14),
      trialNoticeDay: 3,
    };

    expect(dueTrialNotice(fourteen, at(8))).toBeNull();
    expect(dueTrialNotice(fourteen, at(11))).toBe(CHARGE_REMINDER);
  });

  it('welcomes a trial too short for the reminder and sends no reminder', () => {
    const short = {
      trialStartedAt: START,
      trialEndsAt: at(3),
      trialNoticeDay: null,
    };

    expect(dueTrialNotice(short, START)).toBe(0);
    expect(dueTrialNotice({ ...short, trialNoticeDay: 0 }, at(1))).toBeNull();
  });

  it('stops once the closing notice has gone out', () => {
    expect(dueTrialNotice(progress(TRIAL_ENDED_NOTICE), at(30))).toBeNull();
  });

  it('reads an older recorded day 7 as past the reminder', () => {
    expect(dueTrialNotice(progress(7), hoursBeforeEnd(10))).toBeNull();
  });

  it('asks for no dated notice of a trial with no end', () => {
    expect(
      dueTrialNotice(
        { trialStartedAt: START, trialEndsAt: null, trialNoticeDay: 3 },
        at(30),
      ),
    ).toBeNull();
  });

  it('says nothing for a workspace that never trialed', () => {
    expect(
      dueTrialNotice(
        { trialStartedAt: null, trialEndsAt: null, trialNoticeDay: null },
        START,
      ),
    ).toBeNull();
  });

  it('says nothing before the trial opens', () => {
    expect(dueTrialNotice(progress(null), at(-1))).toBeNull();
  });
});

describe('timeLeftLabel', () => {
  it.each([
    [74, '3 days'],
    [72, '3 days'],
    [48, '2 days'],
    [47.5, '1 day'],
    [24, '1 day'],
    [23.9, '23 hours'],
    [2, '2 hours'],
    [1.5, '1 hour'],
    [0.5, 'less than an hour'],
  ])('reads %s hours as %s', (hours, label) => {
    expect(timeLeftLabel(ENDS, hoursBeforeEnd(hours))).toBe(label);
  });
});
