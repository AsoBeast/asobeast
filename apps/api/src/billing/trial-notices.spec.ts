import { dueTrialNotice, trialDay } from './trial-notices';

const START = new Date('2026-08-01T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const at = (days: number) => new Date(START.getTime() + days * DAY_MS);

describe('trialDay', () => {
  it('counts whole days since the trial opened', () => {
    expect(trialDay(START, START)).toBe(0);
    expect(trialDay(START, at(2.9))).toBe(2);
    expect(trialDay(START, at(3))).toBe(3);
  });
});

describe('dueTrialNotice', () => {
  const progress = (trialNoticeDay: number | null) => ({
    trialStartedAt: START,
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
    expect(dueTrialNotice(progress(3), at(5))).toBe(5);
    expect(dueTrialNotice(progress(5), at(7))).toBe(7);
    expect(dueTrialNotice(progress(7), at(8))).toBe(8);
  });

  it('sends only the newest milestone after a missed run', () => {
    expect(dueTrialNotice(progress(0), at(6))).toBe(5);
  });

  it('stops once the closing notice has gone out', () => {
    expect(dueTrialNotice(progress(8), at(30))).toBeNull();
  });

  it('says nothing for a workspace that never trialed', () => {
    expect(
      dueTrialNotice({ trialStartedAt: null, trialNoticeDay: null }, START),
    ).toBeNull();
  });

  it('says nothing before the trial opens', () => {
    expect(dueTrialNotice(progress(null), at(-1))).toBeNull();
  });
});
