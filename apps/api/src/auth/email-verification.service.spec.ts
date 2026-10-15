import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User, Workspace } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationService } from './email-verification.service';
import { sha256 } from './password-hash';
import type { TrialClaims } from './trial-claims';
import { VerificationMailer } from './verification-mailer';

const TOKEN = 'a'.repeat(48);

const workspaceOf = (over: Partial<Workspace> = {}) =>
  ({
    id: 'ws_1',
    plan: 'free',
    trialStartedAt: null,
    trialDeclinedAt: null,
    trialEndsAt: null,
    planExpiresAt: null,
    subscriptionId: null,
    ...over,
  }) as unknown as Workspace;

const userOf = () =>
  ({
    id: 'usr_1',
    workspaceId: 'ws_1',
    email: 'owner@example.com',
    verificationExpiresAt: new Date(Date.now() + 60_000),
  }) as unknown as User;

describe('EmailVerificationService confirming an address', () => {
  const findUnique = jest.fn();
  const findUniqueOrThrow = jest.fn<Promise<Workspace>, [unknown]>();
  const updateMany = jest.fn<
    Promise<{ count: number }>,
    [{ where: Record<string, unknown>; data: Record<string, unknown> }]
  >();
  const userUpdateMany = jest.fn<Promise<{ count: number }>, [unknown]>();
  const claim = jest.fn<Promise<boolean>, [unknown, string]>();
  const release = jest.fn<Promise<void>, [unknown, string]>();
  const isClaimed = jest.fn<Promise<boolean>, [unknown, string]>();
  const warn = jest.spyOn(Logger.prototype, 'warn');

  const prisma = {
    user: { findUnique, updateMany: userUpdateMany },
    workspace: { findUniqueOrThrow, updateMany },
    withTransaction: (run: (tx: unknown) => Promise<unknown>) =>
      run({ workspace: { updateMany } }),
  } as unknown as PrismaService;
  const claims = { claim, release, isClaimed } as unknown as TrialClaims;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _justification: string,
      work: () => Promise<unknown>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const build = (billing = true): EmailVerificationService =>
    new EmailVerificationService(
      prisma,
      crossTenant,
      { configured: true } as unknown as VerificationMailer,
      claims,
      {
        get: (key: string) => (key === 'BILLING_ENABLED' ? billing : 7),
      } as unknown as ConfigService<Env, true>,
    );

  const confirm = (billing = true) => build(billing).claim(TOKEN, null);

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue({ ...userOf(), workspace: {} });
    userUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockReset().mockResolvedValue(workspaceOf());
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    claim.mockReset().mockResolvedValue(true);
    release.mockReset().mockResolvedValue(undefined);
    isClaimed.mockReset().mockResolvedValue(false);
    warn.mockReset().mockImplementation(() => undefined);
  });

  it('spends the link only while it still holds the hash it was read with', async () => {
    await confirm();

    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'usr_1', verificationHash: sha256(TOKEN) },
      }),
    );
  });

  it('refuses a link another redemption spent first and starts no trial', async () => {
    userUpdateMany.mockResolvedValue({ count: 0 });

    await expect(confirm()).rejects.toBeInstanceOf(NotFoundException);
    expect(claim).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('looks the link up by its hash', async () => {
    await confirm();

    expect(findUnique).toHaveBeenCalledWith({
      where: { verificationHash: sha256(TOKEN) },
      include: { workspace: true },
    });
  });

  it('starts the trial only where nothing has claimed the workspace since it was read', async () => {
    await confirm();

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0].where).toEqual({
      id: 'ws_1',
      plan: 'free',
      trialStartedAt: null,
      trialDeclinedAt: null,
      subscriptionId: null,
    });
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ plan: 'trial' });
  });

  it('claims the mailbox of the address that was confirmed', async () => {
    await confirm();

    expect(claim).toHaveBeenCalledWith(expect.anything(), 'owner@example.com');
  });

  it('records a refusal instead of a trial when the mailbox already had one', async () => {
    claim.mockResolvedValue(false);

    await confirm();

    const { data } = updateMany.mock.calls[0][0];
    expect(data).toHaveProperty('trialDeclinedAt');
    expect(data).not.toHaveProperty('plan');
    expect(data).not.toHaveProperty('trialEndsAt');
  });

  it('answers with the row the database holds after the write', async () => {
    const started = workspaceOf({ plan: 'trial', trialStartedAt: new Date() });
    findUniqueOrThrow
      .mockResolvedValueOnce(workspaceOf())
      .mockResolvedValueOnce(started);

    const account = await confirm();

    expect(account.workspace).toBe(started);
  });

  it('leaves a subscription that landed after the read alone and answers with it', async () => {
    const paid = workspaceOf({ plan: 'ultimate', subscriptionId: 'sub_paid' });
    findUniqueOrThrow
      .mockResolvedValueOnce(workspaceOf())
      .mockResolvedValueOnce(paid);
    updateMany.mockResolvedValue({ count: 0 });

    const account = await confirm();

    expect(account.workspace).toBe(paid);
  });

  it('gives the mailbox back when a subscription landed after the read', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await confirm();

    expect(release).toHaveBeenCalledWith(
      expect.anything(),
      'owner@example.com',
    );
  });

  it('keeps the claim of a trial it did start', async () => {
    await confirm();

    expect(release).not.toHaveBeenCalled();
  });

  it('never gives back a claim it did not win', async () => {
    claim.mockResolvedValue(false);
    updateMany.mockResolvedValue({ count: 0 });

    await confirm();

    expect(release).not.toHaveBeenCalled();
  });

  it('refuses a throwaway address its trial without claiming its mailbox', async () => {
    findUnique.mockResolvedValue({
      ...userOf(),
      email: 'fresh@mailinator.com',
      workspace: {},
    });

    await confirm();

    expect(claim).not.toHaveBeenCalled();
    expect(updateMany.mock.calls[0][0].data).toHaveProperty('trialDeclinedAt');
  });

  it.each([
    ['holds a paid plan', { plan: 'indie', planExpiresAt: null }],
    ['ever held a subscription', { subscriptionId: 'sub_ended' }],
    ['already had its trial', { trialStartedAt: new Date('2026-01-01') }],
    ['was refused a trial', { trialDeclinedAt: new Date('2026-01-01') }],
  ])('writes nothing to a workspace that %s', async (_label, over) => {
    findUniqueOrThrow.mockResolvedValue(workspaceOf(over));

    await confirm();

    expect(updateMany).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });

  it('warns the operator when a mailbox that already had a trial confirms', async () => {
    claim.mockResolvedValue(false);

    await confirm();

    expect(warn).toHaveBeenCalledWith(
      'no trial for an address whose mailbox already had one: owner@example.com',
    );
  });

  it('warns the operator when a throwaway address confirms', async () => {
    findUnique.mockResolvedValue({
      ...userOf(),
      email: 'fresh@mailinator.com',
      workspace: {},
    });

    await confirm();

    expect(warn).toHaveBeenCalledWith(
      'no trial for an address on a disposable email domain: fresh@mailinator.com',
    );
  });

  it('warns nothing when the trial starts', async () => {
    await confirm();

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns the operator when a registration is refused before it confirms', async () => {
    isClaimed.mockResolvedValue(true);

    await build().openingTerms({} as never, 'owner+again@example.com');

    expect(warn).toHaveBeenCalledWith(
      'no trial for an address whose mailbox already had one: owner+again@example.com',
    );
  });

  it('warns the operator when a throwaway address registers', async () => {
    await build().openingTerms({} as never, 'fresh@mailinator.com');

    expect(warn).toHaveBeenCalledWith(
      'no trial for an address on a disposable email domain: fresh@mailinator.com',
    );
  });

  it('writes nothing when billing is off', async () => {
    await confirm(false);

    expect(updateMany).not.toHaveBeenCalled();
  });
});
