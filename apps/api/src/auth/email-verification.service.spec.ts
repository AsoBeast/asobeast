import { ConfigService } from '@nestjs/config';
import type { User, Workspace } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationService } from './email-verification.service';
import { sha256 } from './password-hash';
import { VerificationMailer } from './verification-mailer';

const TOKEN = 'a'.repeat(48);

const workspaceOf = (over: Partial<Workspace> = {}) =>
  ({
    id: 'ws_1',
    plan: 'free',
    trialStartedAt: null,
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
  const userUpdate = jest.fn();

  const prisma = {
    user: { findUnique, update: userUpdate },
    workspace: { findUniqueOrThrow, updateMany },
  } as unknown as PrismaService;
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
      {
        get: (key: string) => (key === 'BILLING_ENABLED' ? billing : 7),
      } as unknown as ConfigService<Env, true>,
    );

  const confirm = (billing = true) => build(billing).claim(TOKEN, null);

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue({ ...userOf(), workspace: {} });
    userUpdate.mockReset().mockResolvedValue(undefined);
    findUniqueOrThrow.mockReset().mockResolvedValue(workspaceOf());
    updateMany.mockReset().mockResolvedValue({ count: 1 });
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
      subscriptionId: null,
    });
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ plan: 'trial' });
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

  it.each([
    ['holds a paid plan', { plan: 'indie', planExpiresAt: null }],
    ['ever held a subscription', { subscriptionId: 'sub_ended' }],
    ['already had its trial', { trialStartedAt: new Date('2026-01-01') }],
  ])('writes nothing to a workspace that %s', async (_label, over) => {
    findUniqueOrThrow.mockResolvedValue(workspaceOf(over));

    await confirm();

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('writes nothing when billing is off', async () => {
    await confirm(false);

    expect(updateMany).not.toHaveBeenCalled();
  });
});
