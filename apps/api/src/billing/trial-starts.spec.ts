import { Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import type { TrialClaims } from '../auth/trial-claims';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { TrialStarts } from './trial-starts';

const WORKSPACE = { id: 'ws_trial', trialClaimedAt: null };

const trialing = (over: Partial<Stripe.Subscription> = {}) =>
  ({
    id: 'sub_trial',
    status: 'trialing',
    trial_start: 1_800_000_150,
    default_payment_method: 'pm_card',
    ...over,
  }) as unknown as Stripe.Subscription;

describe('TrialStarts', () => {
  const calls: string[] = [];
  const settled = { at: null as Date | null };
  const claim = jest.fn<Promise<boolean>, [unknown, string]>();
  const claimCard = jest.fn<Promise<boolean>, [unknown, string]>();
  const endTrialNow = jest.fn<Promise<unknown>, [string]>();
  const retrievePaymentMethod = jest.fn<Promise<unknown>, [string]>();
  const ownerOf = jest.fn<Promise<{ email: string } | null>, [unknown]>();
  const updateMany = jest.fn((args: { data: { trialClaimedAt: Date } }) => {
    calls.push('mark');
    if (settled.at) return Promise.resolve({ count: 0 });
    settled.at = args.data.trialClaimedAt;
    return Promise.resolve({ count: 1 });
  });
  const tx = {
    $executeRaw: jest.fn(() => Promise.resolve(1)),
    workspace: {
      findUnique: jest.fn(() =>
        Promise.resolve({ trialClaimedAt: settled.at }),
      ),
      updateMany,
    },
  };
  const prisma = {
    user: { findFirst: ownerOf },
    workspace: { updateMany },
    withTransaction: async (run: (client: unknown) => Promise<unknown>) => {
      calls.push('transaction');
      return run(tx);
    },
  } as unknown as PrismaService;
  const warn = jest.spyOn(Logger.prototype, 'warn');

  const starts = () =>
    new TrialStarts(
      prisma,
      { claim, claimCard } as unknown as TrialClaims,
      { endTrialNow, retrievePaymentMethod } as unknown as StripeService,
    );

  beforeEach(() => {
    calls.length = 0;
    settled.at = null;
    claim.mockReset().mockResolvedValue(true);
    claimCard.mockReset().mockResolvedValue(true);
    endTrialNow.mockReset().mockImplementation(() => {
      calls.push('end');
      return Promise.resolve({});
    });
    retrievePaymentMethod.mockReset().mockImplementation(() => {
      calls.push('card');
      return Promise.resolve({ type: 'card', card: { fingerprint: 'fp_1' } });
    });
    ownerOf.mockReset().mockResolvedValue({ email: 'owner@example.com' });
    updateMany.mockClear();
    tx.workspace.findUnique.mockClear();
    warn.mockReset().mockImplementation(() => undefined);
  });

  it('does nothing for a subscription without a trial', async () => {
    await expect(
      starts().settle(WORKSPACE, trialing({ trial_start: null })),
    ).resolves.toBe('skipped');
    expect(calls).toEqual([]);
  });

  it('does nothing once the claims are settled', async () => {
    await expect(
      starts().settle({ ...WORKSPACE, trialClaimedAt: new Date() }, trialing()),
    ).resolves.toBe('skipped');
    expect(calls).toEqual([]);
  });

  it('claims the mailbox and the card and marks the trial settled', async () => {
    await expect(starts().settle(WORKSPACE, trialing())).resolves.toBe(
      'settled',
    );

    expect(calls).toEqual(['card', 'transaction', 'mark']);
    expect(retrievePaymentMethod).toHaveBeenCalledWith('pm_card');
    expect(claim).toHaveBeenCalledWith(tx, 'owner@example.com');
    expect(claimCard).toHaveBeenCalledWith(tx, 'fp_1');
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_trial', trialClaimedAt: null },
      data: { trialClaimedAt: expect.any(Date) as Date },
    });
    expect(endTrialNow).not.toHaveBeenCalled();
  });

  it('reads an expanded payment method without fetching it', async () => {
    await starts().settle(
      WORKSPACE,
      trialing({
        default_payment_method: {
          id: 'pm_card',
          type: 'card',
          card: { fingerprint: 'fp_2' },
        } as Stripe.PaymentMethod,
      }),
    );

    expect(retrievePaymentMethod).not.toHaveBeenCalled();
    expect(claimCard).toHaveBeenCalledWith(tx, 'fp_2');
  });

  it('claims only the mailbox for a link method', async () => {
    retrievePaymentMethod.mockResolvedValue({ type: 'link' });

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toBe(
      'settled',
    );
    expect(claimCard).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalled();
  });

  it('claims no mailbox when the workspace has no owner', async () => {
    ownerOf.mockResolvedValue(null);

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toBe(
      'settled',
    );
    expect(claim).not.toHaveBeenCalled();
    expect(claimCard).toHaveBeenCalledWith(tx, 'fp_1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ws_trial'));
  });

  it.each([
    ['mailbox', () => claim.mockResolvedValue(false)],
    ['card', () => claimCard.mockResolvedValue(false)],
  ])(
    'ends the trial when the %s claim is lost, before it is marked',
    async (lost, lose) => {
      lose();

      await expect(starts().settle(WORKSPACE, trialing())).resolves.toBe(
        'ended',
      );

      expect(endTrialNow).toHaveBeenCalledTimes(1);
      expect(endTrialNow).toHaveBeenCalledWith('sub_trial');
      expect(calls.slice(-3)).toEqual(['end', 'transaction', 'mark']);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(lost));
    },
  );

  it('marks a lost trial that already left trialing without ending it', async () => {
    claim.mockResolvedValue(false);

    await expect(
      starts().settle(WORKSPACE, trialing({ status: 'active' })),
    ).resolves.toBe('ended');
    expect(endTrialNow).not.toHaveBeenCalled();
    expect(settled.at).not.toBeNull();
  });

  it('leaves the marker unset when stripe fails to end the trial', async () => {
    claim.mockResolvedValue(false);
    endTrialNow.mockRejectedValue(new Error('stripe is down'));

    await expect(starts().settle(WORKSPACE, trialing())).rejects.toThrow(
      'stripe is down',
    );
    expect(settled.at).toBeNull();
    expect(calls).not.toContain('mark');
  });

  it('claims nothing when a concurrent settle won the lock first', async () => {
    settled.at = new Date();

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toBe(
      'skipped',
    );
    expect(claim).not.toHaveBeenCalled();
    expect(claimCard).not.toHaveBeenCalled();
    expect(endTrialNow).not.toHaveBeenCalled();
  });
});
