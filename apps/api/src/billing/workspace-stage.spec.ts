import type { WorkspaceStage } from '@asobeast/shared';
import {
  cancelingOf,
  workspaceStageOf,
  type WorkspaceFlagSource,
} from './workspace-stage';

const NOW = new Date('2026-11-15T12:00:00Z');
const DAY_MS = 24 * 60 * 60_000;
const days = (offset: number) => new Date(NOW.getTime() + offset * DAY_MS);

const NOTHING_HELD: WorkspaceFlagSource = {
  plan: 'free',
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionId: null,
  subscriptionStatus: null,
  trialStartedAt: null,
  firstPaidAt: null,
  cancelAtPeriodEnd: false,
};

const workspace = (
  overrides: Partial<WorkspaceFlagSource>,
): WorkspaceFlagSource => ({ ...NOTHING_HELD, ...overrides });

const CARD_TRIAL = workspace({
  plan: 'indie',
  subscriptionId: 'sub_1',
  subscriptionStatus: 'trialing',
  planExpiresAt: days(5),
  trialStartedAt: days(-2),
  trialEndsAt: days(5),
});

const CUSTOMER = workspace({
  plan: 'ultimate',
  subscriptionId: 'sub_2',
  subscriptionStatus: 'active',
  planExpiresAt: days(20),
  trialStartedAt: days(-40),
  trialEndsAt: days(-33),
  firstPaidAt: days(-33),
});

describe('workspaceStageOf', () => {
  it.each<[string, WorkspaceFlagSource, WorkspaceStage]>([
    ['a card trial on a paid plan', CARD_TRIAL, 'trialing'],
    [
      'an active subscription before its first paid invoice',
      { ...CARD_TRIAL, subscriptionStatus: 'active' },
      'trialing',
    ],
    [
      'a legacy trial without a subscription',
      workspace({ trialEndsAt: days(3) }),
      'trialing',
    ],
    ['a paid active subscription', CUSTOMER, 'paying'],
    [
      'a paid customer whose renewal charge failed',
      { ...CUSTOMER, subscriptionStatus: 'past_due' },
      'payment-failed',
    ],
    [
      'a trial whose first charge failed',
      {
        ...CARD_TRIAL,
        plan: 'free',
        subscriptionStatus: 'past_due',
        trialEndsAt: null,
      },
      'payment-failed',
    ],
    [
      'an unpaid subscription of a former customer',
      { ...CUSTOMER, plan: 'free', subscriptionStatus: 'unpaid' },
      'payment-failed',
    ],
    [
      'a paused subscription',
      { ...CUSTOMER, plan: 'free', subscriptionStatus: 'paused' },
      'payment-failed',
    ],
    [
      'a paid plan set by hand',
      workspace({ plan: 'indie', planExpiresAt: days(30) }),
      'comped',
    ],
    [
      'a paid plan set by hand that never expires',
      workspace({ plan: 'ultimate' }),
      'comped',
    ],
    [
      'a card trial cancelled before its first charge',
      {
        ...CARD_TRIAL,
        plan: 'free',
        subscriptionStatus: 'canceled',
        planExpiresAt: days(-1),
        trialEndsAt: null,
      },
      'trial-ended',
    ],
    [
      'a legacy trial that ran out',
      workspace({ trialEndsAt: days(-3) }),
      'trial-ended',
    ],
    [
      'a former customer whose subscription ended',
      {
        ...CUSTOMER,
        plan: 'free',
        subscriptionStatus: 'canceled',
        planExpiresAt: days(-2),
      },
      'churned',
    ],
    [
      'a paid plan past its expiry with a paid history',
      { ...CUSTOMER, planExpiresAt: days(-1), subscriptionId: null },
      'churned',
    ],
    ['a workspace that never reached Checkout', NOTHING_HELD, 'no-plan'],
  ])('places %s', (_, row, stage) => {
    expect(workspaceStageOf(true, row, NOW)).toBe(stage);
  });

  it('places every workspace as self hosted when billing is off', () => {
    for (const row of [CARD_TRIAL, CUSTOMER, NOTHING_HELD]) {
      expect(workspaceStageOf(false, row, NOW)).toBe('self-hosted');
    }
  });
});

describe('cancelingOf', () => {
  it('flags a customer whose charge failed and who stops at period end', () => {
    const pastDue = {
      ...CUSTOMER,
      subscriptionStatus: 'past_due',
      cancelAtPeriodEnd: true,
    };
    const stage = workspaceStageOf(true, pastDue, NOW);
    expect(stage).toBe('payment-failed');
    expect(cancelingOf(stage, pastDue)).toBe(true);
  });

  it('flags a trial or a customer that stops at period end', () => {
    expect(
      cancelingOf('trialing', { ...CARD_TRIAL, cancelAtPeriodEnd: true }),
    ).toBe(true);
    expect(
      cancelingOf('paying', { ...CUSTOMER, cancelAtPeriodEnd: true }),
    ).toBe(true);
  });

  it('never flags a workspace that holds nothing to cancel', () => {
    expect(
      cancelingOf('churned', { ...CUSTOMER, cancelAtPeriodEnd: true }),
    ).toBe(false);
    expect(cancelingOf('paying', CUSTOMER)).toBe(false);
  });
});
