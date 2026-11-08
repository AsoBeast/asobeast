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
  const transactionOptions: unknown[] = [];
  const settled = { at: null as Date | null };
  const claim = jest.fn<Promise<boolean>, [unknown, string]>();
  const claimCard = jest.fn<Promise<boolean>, [unknown, string]>();
  const cancelRefusedTrial = jest.fn<Promise<unknown>, [string]>();
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
    withTransaction: async (
      run: (client: unknown) => Promise<unknown>,
      options: unknown,
    ) => {
      calls.push('transaction');
      transactionOptions.push(options);
      return run(tx);
    },
  } as unknown as PrismaService;
  const warn = jest.spyOn(Logger.prototype, 'warn');

  const starts = () =>
    new TrialStarts(
      prisma,
      { claim, claimCard } as unknown as TrialClaims,
      { cancelRefusedTrial, retrievePaymentMethod } as unknown as StripeService,
    );

  beforeEach(() => {
    calls.length = 0;
    transactionOptions.length = 0;
    settled.at = null;
    claim.mockReset().mockResolvedValue(true);
    claimCard.mockReset().mockResolvedValue(true);
    cancelRefusedTrial.mockReset().mockImplementation(() => {
      calls.push('cancel');
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
    ).resolves.toEqual({ outcome: 'skipped' });
    expect(calls).toEqual([]);
  });

  it('does nothing once the claims are settled', async () => {
    await expect(
      starts().settle({ ...WORKSPACE, trialClaimedAt: new Date() }, trialing()),
    ).resolves.toEqual({ outcome: 'skipped' });
    expect(calls).toEqual([]);
  });

  it('claims the mailbox and the card and marks the trial settled', async () => {
    await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
      outcome: 'settled',
    });

    expect(calls).toEqual(['card', 'transaction', 'mark']);
    expect(retrievePaymentMethod).toHaveBeenCalledWith('pm_card');
    expect(claim).toHaveBeenCalledWith(tx, 'owner@example.com');
    expect(claimCard).toHaveBeenCalledWith(tx, 'fp_1');
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_trial', trialClaimedAt: null },
      data: { trialClaimedAt: expect.any(Date) as Date },
    });
    expect(cancelRefusedTrial).not.toHaveBeenCalled();
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

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
      outcome: 'settled',
    });
    expect(claimCard).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalled();
  });

  it('claims no mailbox when the workspace has no owner', async () => {
    ownerOf.mockResolvedValue(null);

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
      outcome: 'settled',
    });
    expect(claim).not.toHaveBeenCalled();
    expect(claimCard).toHaveBeenCalledWith(tx, 'fp_1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ws_trial'));
  });

  it.each([
    ['mailbox', () => claim.mockResolvedValue(false)],
    ['card', () => claimCard.mockResolvedValue(false)],
  ])(
    'cancels the trial without charging when the %s claim is lost, before it is marked',
    async (lost, lose) => {
      lose();

      await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
        outcome: 'refused',
      });

      expect(cancelRefusedTrial).toHaveBeenCalledTimes(1);
      expect(cancelRefusedTrial).toHaveBeenCalledWith('sub_trial');
      expect(calls.slice(-3)).toEqual(['transaction', 'cancel', 'mark']);
      expect(transactionOptions).toEqual([{ timeout: 65_000 }]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(lost));
    },
  );

  it('leaves the workspace with no trial and no subscription after a refusal', async () => {
    claimCard.mockResolvedValue(false);

    await starts().settle(WORKSPACE, trialing());

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_trial', trialClaimedAt: null },
      data: {
        plan: 'free',
        planExpiresAt: null,
        subscriptionId: null,
        subscriptionStatus: null,
        cancelAtPeriodEnd: false,
        billingInterval: null,
        trialStartedAt: null,
        trialEndsAt: null,
        trialNoticeDay: null,
        trialClaimedAt: expect.any(Date) as Date,
        trialDeclinedAt: expect.any(Date) as Date,
        trialRefusedSubscriptionId: 'sub_trial',
      },
    });
  });

  it('records a refusal stripe already cancelled without cancelling it again', async () => {
    claim.mockResolvedValue(false);

    await expect(
      starts().settle(
        WORKSPACE,
        trialing({
          status: 'canceled',
          ended_at: 1_800_000_160,
          trial_end: 1_800_600_000,
        }),
      ),
    ).resolves.toEqual({ outcome: 'refused' });
    expect(cancelRefusedTrial).not.toHaveBeenCalled();
    expect(settled.at).not.toBeNull();
  });

  it('never refuses a subscription that ended after its trial', async () => {
    claim.mockResolvedValue(false);

    await expect(
      starts().settle(
        WORKSPACE,
        trialing({
          status: 'canceled',
          ended_at: 1_800_700_000,
          trial_end: 1_800_600_000,
        }),
      ),
    ).resolves.toEqual({ outcome: 'settled' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_trial', trialClaimedAt: null },
      data: { trialClaimedAt: expect.any(Date) as Date },
    });
  });

  it('marks a lost trial that already left trialing without refusing it', async () => {
    claim.mockResolvedValue(false);

    await expect(
      starts().settle(WORKSPACE, trialing({ status: 'active' })),
    ).resolves.toEqual({ outcome: 'settled' });
    expect(cancelRefusedTrial).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_trial', trialClaimedAt: null },
      data: { trialClaimedAt: expect.any(Date) as Date },
    });
  });

  it('leaves the marker unset when stripe fails to cancel the trial', async () => {
    claim.mockResolvedValue(false);
    cancelRefusedTrial.mockRejectedValue(new Error('stripe is down'));

    await expect(starts().settle(WORKSPACE, trialing())).rejects.toThrow(
      'stripe is down',
    );
    expect(settled.at).toBeNull();
    expect(calls).not.toContain('mark');
  });

  it('claims nothing when a concurrent settle won the lock first', async () => {
    settled.at = new Date();

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
      outcome: 'skipped',
    });
    expect(claim).not.toHaveBeenCalled();
    expect(claimCard).not.toHaveBeenCalled();
    expect(cancelRefusedTrial).not.toHaveBeenCalled();
  });
});
