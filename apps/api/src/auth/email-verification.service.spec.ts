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
  const isClaimed = jest.fn<Promise<boolean>, [unknown, string]>();
  const warn = jest.spyOn(Logger.prototype, 'warn');

  const prisma = {
    user: { findUnique, updateMany: userUpdateMany },
    workspace: { findUniqueOrThrow, updateMany },
  } as unknown as PrismaService;
  const claims = { claim, isClaimed } as unknown as TrialClaims;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _justification: string,
      work: () => Promise<unknown>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const build = (billing = true, configured = true): EmailVerificationService =>
    new EmailVerificationService(
      prisma,
      crossTenant,
      { configured } as unknown as VerificationMailer,
      claims,
      {
        get: (key: string) => key === 'BILLING_ENABLED' && billing,
      } as unknown as ConfigService<Env, true>,
    );

  const confirm = (billing = true) => build(billing).claim(TOKEN, null);

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue({ ...userOf(), workspace: {} });
    userUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockReset().mockResolvedValue(workspaceOf());
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    claim.mockReset().mockResolvedValue(true);
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

  it('refuses a link another redemption spent first', async () => {
    userUpdateMany.mockResolvedValue({ count: 0 });

    await expect(confirm()).rejects.toBeInstanceOf(NotFoundException);
    expect(warn).not.toHaveBeenCalled();
  });

  it('looks the link up by its hash', async () => {
    await confirm();

    expect(findUnique).toHaveBeenCalledWith({
      where: { verificationHash: sha256(TOKEN) },
      include: { workspace: true },
    });
  });

  it('confirming claims no mailbox and writes no trial', async () => {
    const stored = workspaceOf();
    findUniqueOrThrow.mockResolvedValue(stored);

    const account = await confirm();

    expect(claim).not.toHaveBeenCalled();
    expect(isClaimed).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(account.workspace).toBe(stored);
  });

  it('marks the address it confirmed', async () => {
    const account = await confirm();

    expect(account.emailVerifiedAt).toBeInstanceOf(Date);
    expect(userUpdateMany.mock.calls[0][0]).toMatchObject({
      data: { verificationHash: null, verificationExpiresAt: null },
    });
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

  it.each([true, false])(
    'writes a refusal and never a grant at registration (confirmation mail %s)',
    async (configured) => {
      const service = build(true, configured);

      await expect(
        service.openingTerms({} as never, 'fresh@example.com'),
      ).resolves.toBeUndefined();
      isClaimed.mockResolvedValue(true);
      await expect(
        service.openingTerms({} as never, 'owner+again@example.com'),
      ).resolves.toEqual({ trialDeclinedAt: expect.any(Date) as Date });
      isClaimed.mockResolvedValue(false);
      await expect(
        service.openingTerms({} as never, 'fresh@mailinator.com'),
      ).resolves.toEqual({ trialDeclinedAt: expect.any(Date) as Date });
      expect(claim).not.toHaveBeenCalled();
    },
  );

  it('decides no terms when billing is off', async () => {
    isClaimed.mockResolvedValue(true);

    await expect(
      build(false).openingTerms({} as never, 'owner@example.com'),
    ).resolves.toBeUndefined();
    expect(isClaimed).not.toHaveBeenCalled();
  });
});
