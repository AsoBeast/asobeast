import { trialOfferFor, type TrialOfferInput } from './trial-offer';

const NOW = new Date('2026-10-22T00:00:00.000Z');

const FRESH: TrialOfferInput = {
  workspace: {
    plan: 'free',
    trialStartedAt: null,
    trialDeclinedAt: null,
    trialEndsAt: null,
    planExpiresAt: null,
    subscriptionId: null,
  },
  mailboxClaimed: false,
  days: 7,
};

const offerWith = (
  workspace: Partial<TrialOfferInput['workspace']>,
  mailboxClaimed = false,
) =>
  trialOfferFor(
    {
      ...FRESH,
      mailboxClaimed,
      workspace: { ...FRESH.workspace, ...workspace },
    },
    NOW,
  );

describe('trialOfferFor', () => {
  it('offers the configured days to a fresh workspace on an unclaimed mailbox', () => {
    expect(trialOfferFor(FRESH, NOW)).toEqual({ days: 7 });
  });

  it('offers the trial to an unconfirmed address', () => {
    expect(trialOfferFor({ ...FRESH, days: 14 }, NOW)).toEqual({ days: 14 });
  });

  it('offers nothing to a workspace that already had a trial', () => {
    expect(offerWith({ trialStartedAt: new Date('2026-01-01') })).toBeNull();
  });

  it('offers nothing to a mailbox that already had a trial', () => {
    expect(offerWith({}, true)).toBeNull();
  });

  it('offers nothing to a workspace that was refused one', () => {
    expect(offerWith({ trialDeclinedAt: new Date('2026-01-01') })).toBeNull();
  });

  it.each([
    ['ever held a subscription', { subscriptionId: 'sub_ended' }],
    [
      'holds a paid plan',
      { plan: 'indie', planExpiresAt: new Date('2026-11-01') },
    ],
  ])('offers nothing to a workspace that %s', (_label, workspace) => {
    expect(offerWith(workspace)).toBeNull();
  });
});
