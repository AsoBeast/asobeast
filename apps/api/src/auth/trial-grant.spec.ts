import {
  alreadyTrialed,
  grantTrial,
  trialAwaitsConfirmation,
} from './trial-grant';

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

describe('trialAwaitsConfirmation', () => {
  const account = (
    over: {
      emailVerifiedAt?: Date | null;
      workspace?: Partial<{
        plan: string;
        trialStartedAt: Date | null;
        trialEndsAt: Date | null;
        planExpiresAt: Date | null;
      }>;
    } = {},
  ) => ({
    emailVerifiedAt: over.emailVerifiedAt ?? null,
    workspace: {
      plan: 'free',
      trialStartedAt: null,
      trialEndsAt: null,
      planExpiresAt: null,
      ...over.workspace,
    },
  });

  it('waits on an unconfirmed account whose workspace has had no trial', () => {
    expect(trialAwaitsConfirmation(account(), NOW)).toBe(true);
  });

  it('stops waiting once the address is confirmed', () => {
    expect(
      trialAwaitsConfirmation(account({ emailVerifiedAt: NOW }), NOW),
    ).toBe(false);
  });

  it('does not wait for a trial the workspace already had', () => {
    const lapsed = account({
      workspace: {
        trialStartedAt: new Date('2026-07-01T00:00:00.000Z'),
        trialEndsAt: new Date('2026-07-08T00:00:00.000Z'),
      },
    });

    expect(trialAwaitsConfirmation(lapsed, NOW)).toBe(false);
  });

  it('does not wait while a trial is running', () => {
    const running = account({
      workspace: {
        plan: 'trial',
        trialStartedAt: NOW,
        trialEndsAt: new Date('2026-08-17T00:00:00.000Z'),
      },
    });

    expect(trialAwaitsConfirmation(running, NOW)).toBe(false);
  });

  it('does not ask a workspace that holds a paid plan to wait for a trial', () => {
    const paying = account({ workspace: { plan: 'indie' } });

    expect(trialAwaitsConfirmation(paying, NOW)).toBe(false);
  });

  it('waits again for a paid plan that ended before any trial was taken', () => {
    const ended = account({
      workspace: {
        plan: 'indie',
        planExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    expect(trialAwaitsConfirmation(ended, NOW)).toBe(true);
  });
});
