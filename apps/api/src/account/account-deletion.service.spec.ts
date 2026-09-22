import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import {
  STRIPE_MAX_NETWORK_RETRIES,
  STRIPE_TIMEOUT_MS,
} from '../billing/stripe.client';
import { StripeService } from '../billing/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionService } from './account-deletion.service';

const NOW = new Date('2026-09-22T05:00:00.000Z');

describe('AccountDeletionService.eraseDue', () => {
  const prisma = {
    workspace: { findMany: jest.fn(), delete: jest.fn() },
    billingEvent: { updateMany: jest.fn() },
    $queryRaw: jest.fn(),
    withTransaction: jest.fn(),
  };
  const stripe = { enabled: true, deleteCustomer: jest.fn() };

  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
    {} as WorkspaceContext,
    {
      becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
        _justification: string,
        work: () => Promise<T>,
      ) => work(),
    } as unknown as CrossTenantAccess,
    stripe as unknown as StripeService,
    { get: () => 7 } as unknown as ConfigService<Env, true>,
  );

  const claims = (billingCustomerId: string | null) =>
    prisma.$queryRaw.mockResolvedValue([{ id: 'ws_due', billingCustomerId }]);

  beforeEach(() => {
    jest.clearAllMocks();
    stripe.enabled = true;
    stripe.deleteCustomer.mockResolvedValue(undefined);
    prisma.workspace.findMany.mockResolvedValue([{ id: 'ws_due' }]);
    prisma.workspace.delete.mockResolvedValue({});
    prisma.billingEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.withTransaction.mockImplementation(
      (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma),
    );
  });

  it('deletes the stripe customer before erasing the workspace', async () => {
    claims('cus_1');

    await expect(service.eraseDue(NOW)).resolves.toEqual(['ws_due']);

    expect(stripe.deleteCustomer).toHaveBeenCalledWith('cus_1');
    expect(stripe.deleteCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.workspace.delete.mock.invocationCallOrder[0],
    );
  });

  it('holds the claimed row for as long as stripe may take to answer', async () => {
    claims('cus_1');

    await service.eraseDue(NOW);

    expect(stripe.deleteCustomer.mock.invocationCallOrder[0]).toBeGreaterThan(
      prisma.$queryRaw.mock.invocationCallOrder[0],
    );
    const [, options] = prisma.withTransaction.mock.calls[0] as [
      unknown,
      { timeout: number },
    ];
    expect(options.timeout).toBeGreaterThan(
      STRIPE_TIMEOUT_MS * (STRIPE_MAX_NETWORK_RETRIES + 1),
    );
  });

  it('keeps the workspace when stripe cannot delete its customer', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    claims('cus_1');
    stripe.deleteCustomer.mockRejectedValue(new Error('stripe is down'));

    await expect(service.eraseDue(NOW)).resolves.toEqual([]);

    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.billingEvent.updateMany).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/ws_due .*cus_1.*stripe is down/),
    );
    error.mockRestore();
  });

  it('erases a workspace with no billing without asking stripe', async () => {
    claims(null);

    await expect(service.eraseDue(NOW)).resolves.toEqual(['ws_due']);

    expect(stripe.deleteCustomer).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).toHaveBeenCalled();
  });

  it('erases without asking stripe when billing is not configured', async () => {
    stripe.enabled = false;
    claims('cus_1');

    await expect(service.eraseDue(NOW)).resolves.toEqual(['ws_due']);

    expect(stripe.deleteCustomer).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).toHaveBeenCalled();
  });

  it('leaves stripe alone when the deletion was cancelled after the due list was read', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.eraseDue(NOW)).resolves.toEqual([]);

    expect(stripe.deleteCustomer).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });
});
