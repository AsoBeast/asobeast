import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AccountUser } from './auth.types';
import type { TrialClaims } from './trial-claims';
import { OFFER_JUSTIFICATION, TrialOffers } from './trial-offers';

const NOW = new Date('2026-10-22T00:00:00.000Z');

const userOf = (role: string): AccountUser =>
  ({
    email: 'owner@example.com',
    role,
    workspace: {
      plan: 'free',
      trialStartedAt: null,
      trialDeclinedAt: null,
      trialEndsAt: null,
      planExpiresAt: null,
      subscriptionId: null,
    },
  }) as unknown as AccountUser;

describe('TrialOffers', () => {
  const prisma = {} as PrismaService;
  const crossTenantDepth = { inside: false };
  const isClaimed = jest.fn<Promise<boolean>, [unknown, string]>();
  const becauseThisWorkIsNotOwnedByOneWorkspace = jest.fn(
    async (_justification: string, work: () => Promise<unknown>) => {
      crossTenantDepth.inside = true;
      try {
        return await work();
      } finally {
        crossTenantDepth.inside = false;
      }
    },
  );

  const build = (billing = true, days = 7) =>
    new TrialOffers(
      prisma,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace,
      } as unknown as CrossTenantAccess,
      { isClaimed } as unknown as TrialClaims,
      {
        get: (key: string) => (key === 'BILLING_ENABLED' ? billing : days),
      } as unknown as ConfigService<Env, true>,
    );

  beforeEach(() => {
    becauseThisWorkIsNotOwnedByOneWorkspace.mockClear();
    isClaimed.mockReset().mockImplementation(() => {
      expect(crossTenantDepth.inside).toBe(true);
      return Promise.resolve(false);
    });
  });

  it('reads the mailbox claim across tenants and offers the configured days', async () => {
    await expect(
      build(true, 9).offerFor(userOf('owner'), NOW),
    ).resolves.toEqual({ days: 9 });
    expect(becauseThisWorkIsNotOwnedByOneWorkspace).toHaveBeenCalledWith(
      OFFER_JUSTIFICATION,
      expect.any(Function),
    );
    expect(isClaimed).toHaveBeenCalledWith(prisma, 'owner@example.com');
  });

  it('offers nothing to a claimed mailbox', async () => {
    isClaimed.mockResolvedValue(true);

    await expect(build().offerFor(userOf('owner'), NOW)).resolves.toBeNull();
  });

  it('offers nothing to a member without reading the claims', async () => {
    await expect(build().offerFor(userOf('member'), NOW)).resolves.toBeNull();
    expect(becauseThisWorkIsNotOwnedByOneWorkspace).not.toHaveBeenCalled();
    expect(isClaimed).not.toHaveBeenCalled();
  });

  it('offers nothing to a workspace that cannot start one without reading the claims', async () => {
    const trialed = userOf('owner');
    trialed.workspace.trialStartedAt = new Date('2026-01-01');

    await expect(build().offerFor(trialed, NOW)).resolves.toBeNull();
    expect(becauseThisWorkIsNotOwnedByOneWorkspace).not.toHaveBeenCalled();
  });

  it('offers nothing with billing off without reading the claims', async () => {
    await expect(
      build(false).offerFor(userOf('owner'), NOW),
    ).resolves.toBeNull();
    expect(becauseThisWorkIsNotOwnedByOneWorkspace).not.toHaveBeenCalled();
    expect(isClaimed).not.toHaveBeenCalled();
  });
});
