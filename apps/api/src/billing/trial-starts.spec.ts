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

const ENDED = trialing({ status: 'active', trial_end: 1_800_000_200 });

describe('TrialStarts', () => {
  const calls: string[] = [];
  const transactionOptions: unknown[] = [];
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
      { endTrialNow, retrievePaymentMethod } as unknown as StripeService,
    );

  beforeEach(() => {
    calls.length = 0;
    transactionOptions.length = 0;
    settled.at = null;
    claim.mockReset().mockResolvedValue(true);
    claimCard.mockReset().mockResolvedValue(true);
    endTrialNow.mockReset().mockImplementation(() => {
      calls.push('end');
      return Promise.resolve(ENDED);
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
    'ends the trial inside the settling transaction when the %s claim is lost, before it is marked',
    async (lost, lose) => {
      lose();

      await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
        outcome: 'ended',
        subscription: ENDED,
      });

      expect(endTrialNow).toHaveBeenCalledTimes(1);
      expect(endTrialNow).toHaveBeenCalledWith('sub_trial');
      expect(calls.slice(-3)).toEqual(['transaction', 'end', 'mark']);
      expect(transactionOptions).toEqual([{ timeout: 65_000 }]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(lost));
    },
  );

  it('marks a lost trial that already left trialing without ending it', async () => {
    claim.mockResolvedValue(false);
    const left = trialing({ status: 'active' });

    await expect(starts().settle(WORKSPACE, left)).resolves.toEqual({
      outcome: 'ended',
      subscription: left,
    });
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

    await expect(starts().settle(WORKSPACE, trialing())).resolves.toEqual({
      outcome: 'skipped',
    });
    expect(claim).not.toHaveBeenCalled();
    expect(claimCard).not.toHaveBeenCalled();
    expect(endTrialNow).not.toHaveBeenCalled();
  });
});
