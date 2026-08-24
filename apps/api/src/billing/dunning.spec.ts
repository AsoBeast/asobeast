import { entersDunning, leavesDunning } from './dunning';

const NOTIFIED = { dunningNotifiedAt: new Date('2026-08-01T00:00:00.000Z') };
const QUIET = { dunningNotifiedAt: null };

describe('entersDunning', () => {
  it('notifies the first time a charge fails', () => {
    expect(entersDunning(QUIET, 'past_due')).toBe(true);
  });

  it('stays quiet through the rest of the retry window', () => {
    expect(entersDunning(NOTIFIED, 'past_due')).toBe(false);
  });

  it('says nothing while the subscription is healthy', () => {
    expect(entersDunning(QUIET, 'active')).toBe(false);
    expect(entersDunning(QUIET, 'trialing')).toBe(false);
  });

  it('says nothing once the subscription is already gone', () => {
    expect(entersDunning(QUIET, 'canceled')).toBe(false);
    expect(entersDunning(QUIET, 'unpaid')).toBe(false);
  });
});

describe('leavesDunning', () => {
  it('clears the flag when payment recovers', () => {
    expect(leavesDunning(NOTIFIED, 'active')).toBe(true);
    expect(leavesDunning(NOTIFIED, 'trialing')).toBe(true);
  });

  it('keeps the flag while the charge is still failing', () => {
    expect(leavesDunning(NOTIFIED, 'past_due')).toBe(false);
  });

  it('has nothing to clear when dunning never started', () => {
    expect(leavesDunning(QUIET, 'active')).toBe(false);
  });
});
