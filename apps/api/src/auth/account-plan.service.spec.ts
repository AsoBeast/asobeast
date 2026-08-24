import { ConfigService } from '@nestjs/config';
import { PLAN_LIMITS, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import { Env } from '../config/env';
import { AccountPlanService } from './account-plan.service';
import { QuotaService } from './quota.service';
import { WorkspaceEntitlement } from './entitlement';

const NOW = new Date('2026-08-09T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60_000;

describe('AccountPlanService', () => {
  const build = (
    billing: boolean,
    usage: {
      plan: 'free' | 'trial' | 'indie' | 'ultimate';
      apps: number;
      keywordMarkets: number;
    },
  ) =>
    new AccountPlanService(
      {
        usage: () =>
          Promise.resolve({
            ...usage,
            limits: billing ? PLAN_LIMITS[usage.plan] : SELF_HOSTED_LIMITS,
          }),
      } as unknown as QuotaService,
      { get: () => billing } as unknown as ConfigService<Env, true>,
    );

  const workspace = (
    over: Partial<WorkspaceEntitlement> & {
      billingCustomerId?: string | null;
      subscriptionId?: string | null;
      subscriptionStatus?: string | null;
      cancelAtPeriodEnd?: boolean;
    } = {},
  ) => ({
    plan: 'free',
    trialEndsAt: null,
    planExpiresAt: null,
    billingCustomerId: null,
    subscriptionId: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    ...over,
  });

  it('reports usage against the limits of the plan in force', async () => {
    const service = build(true, {
      plan: 'indie',
      apps: 3,
      keywordMarkets: 120,
    });

    await expect(
      service.describe(workspace({ plan: 'indie' }), NOW),
    ).resolves.toMatchObject({
      plan: 'indie',
      displayName: 'Indie',
      entitled: true,
      upgradeTo: 'ultimate',
      upgradePath: '/upgrade',
      usage: {
        apps: { used: 3, limit: PLAN_LIMITS.indie.apps },
        keywordMarkets: {
          used: 120,
          limit: PLAN_LIMITS.indie.keywordMarkets,
        },
      },
    });
  });

  it('dates the trial and the renewal from the workspace', async () => {
    const trialEndsAt = new Date(NOW.getTime() + 3 * DAY_MS);
    const planExpiresAt = new Date(NOW.getTime() + 30 * DAY_MS);
    const service = build(true, { plan: 'trial', apps: 0, keywordMarkets: 0 });

    await expect(
      service.describe(workspace({ trialEndsAt, planExpiresAt }), NOW),
    ).resolves.toMatchObject({
      trialEndsAt: trialEndsAt.toISOString(),
      renewsAt: planExpiresAt.toISOString(),
    });
  });

  it('reports whether the workspace has a stripe customer to manage', async () => {
    const service = build(true, { plan: 'indie', apps: 1, keywordMarkets: 1 });

    await expect(
      service.describe(workspace({ plan: 'indie' }), NOW),
    ).resolves.toMatchObject({ hasBillingAccount: false });
    await expect(
      service.describe(
        workspace({ plan: 'indie', billingCustomerId: 'cus_1' }),
        NOW,
      ),
    ).resolves.toMatchObject({ hasBillingAccount: true });
  });

  it.each([
    ['no subscription at all', { subscriptionId: null }, false],
    [
      'a live subscription',
      { subscriptionId: 'sub_1', subscriptionStatus: 'active' },
      true,
    ],
    [
      'a subscription behind on payment',
      { subscriptionId: 'sub_1', subscriptionStatus: 'past_due' },
      true,
    ],
    [
      'a cancelled subscription',
      { subscriptionId: 'sub_1', subscriptionStatus: 'canceled' },
      false,
    ],
    [
      'a checkout that never completed',
      { subscriptionId: 'sub_1', subscriptionStatus: 'incomplete' },
      false,
    ],
    [
      'a subscription whose status was never recorded',
      { subscriptionId: 'sub_1', subscriptionStatus: null },
      true,
    ],
  ])('reports %s as subscribed=%p', async (_, over, subscribed) => {
    const service = build(true, { plan: 'indie', apps: 1, keywordMarkets: 1 });

    await expect(
      service.describe(workspace({ plan: 'indie', ...over }), NOW),
    ).resolves.toMatchObject({ subscribed });
  });

  it('surfaces a cancellation that takes effect at period end', async () => {
    const service = build(true, { plan: 'indie', apps: 1, keywordMarkets: 1 });

    await expect(
      service.describe(
        workspace({ plan: 'indie', cancelAtPeriodEnd: true }),
        NOW,
      ),
    ).resolves.toMatchObject({ cancelAtPeriodEnd: true });
  });

  it('marks a lapsed workspace unentitled and points it at the entry plan', async () => {
    const service = build(true, { plan: 'free', apps: 2, keywordMarkets: 40 });

    await expect(
      service.describe(
        workspace({ trialEndsAt: new Date(NOW.getTime() - DAY_MS) }),
        NOW,
      ),
    ).resolves.toMatchObject({
      plan: 'free',
      entitled: false,
      upgradeTo: 'indie',
    });
  });

  it('shows a self hosted instance no plan to buy and no limit to hit', async () => {
    const service = build(false, {
      plan: 'free',
      apps: 9,
      keywordMarkets: 900,
    });

    await expect(service.describe(workspace(), NOW)).resolves.toMatchObject({
      billing: false,
      entitled: true,
      upgradeTo: null,
      usage: {
        apps: { used: 9, limit: null },
        keywordMarkets: { used: 900, limit: null },
      },
    });
  });
});
