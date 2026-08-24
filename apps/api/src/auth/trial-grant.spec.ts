import { alreadyTrialed, grantTrial } from './trial-grant';

const NOW = new Date('2026-08-10T00:00:00.000Z');

describe('grantTrial', () => {
  it('opens the trial now and ends it after the configured days', () => {
    expect(grantTrial(7, NOW)).toEqual({
      plan: 'trial',
      trialStartedAt: NOW,
      trialEndsAt: new Date('2026-08-17T00:00:00.000Z'),
    });
  });

  it('honours a shorter trial length', () => {
    expect(grantTrial(1, NOW).trialEndsAt).toEqual(
      new Date('2026-08-11T00:00:00.000Z'),
    );
  });
});

describe('alreadyTrialed', () => {
  it('treats a workspace that never started one as untried', () => {
    expect(alreadyTrialed({ trialStartedAt: null })).toBe(false);
  });

  it('never offers a second trial, however long ago the first ran', () => {
    expect(alreadyTrialed({ trialStartedAt: new Date('2020-01-01') })).toBe(
      true,
    );
  });
});
