import { ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { StripeService } from '../billing/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionService } from './account-deletion.service';

const NOW = new Date('2026-09-22T05:00:00.000Z');

describe('AccountDeletionService', () => {
  const prisma = {
    workspace: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    billingEvent: { updateMany: jest.fn() },
    $queryRaw: jest.fn(),
    withTransaction: jest.fn(),
  };
  const stripe = { enabled: true, deleteCustomer: jest.fn() };

  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
    { require: () => 'ws_due' } as unknown as WorkspaceContext,
    {
      becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
        _justification: string,
        work: () => Promise<T>,
      ) => work(),
    } as unknown as CrossTenantAccess,
    stripe as unknown as StripeService,
    { get: () => 7 } as unknown as ConfigService<Env, true>,
  );

  const claims = (billingCustomerId: string | null) => {
    prisma.workspace.updateMany.mockResolvedValue({ count: 1 });
    prisma.workspace.findUniqueOrThrow.mockResolvedValue({ billingCustomerId });
    prisma.$queryRaw.mockResolvedValue([{ billingCustomerId }]);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stripe.enabled = true;
    stripe.deleteCustomer.mockResolvedValue(undefined);
    prisma.workspace.findMany.mockResolvedValue([{ id: 'ws_due' }]);
    prisma.workspace.update.mockResolvedValue({});
    prisma.workspace.delete.mockResolvedValue({});
    prisma.billingEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.withTransaction.mockImplementation(
      (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma),
    );
  });

  describe('eraseDue', () => {
    it('deletes the stripe customer before erasing the workspace', async () => {
      claims('cus_1');

      await expect(service.eraseDue(NOW)).resolves.toEqual(['ws_due']);

      expect(stripe.deleteCustomer).toHaveBeenCalledWith('cus_1');
      expect(stripe.deleteCustomer.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.workspace.delete.mock.invocationCallOrder[0],
      );
    });

    it('claims the workspace before stripe and holds no transaction while stripe answers', async () => {
      claims('cus_1');

      await service.eraseDue(NOW);

      expect(prisma.workspace.updateMany).toHaveBeenCalledWith({
        where: { id: 'ws_due', deletionDueAt: { lte: NOW } },
        data: { erasureClaimedAt: NOW },
      });
      const stripeCall = stripe.deleteCustomer.mock.invocationCallOrder[0];
      expect(stripeCall).toBeGreaterThan(
        prisma.workspace.updateMany.mock.invocationCallOrder[0],
      );
      expect(stripeCall).toBeLessThan(
        prisma.withTransaction.mock.invocationCallOrder[0],
      );
    });

    it('keeps the workspace and releases its claim when stripe cannot delete its customer', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      claims('cus_1');
      stripe.deleteCustomer.mockRejectedValue(new Error('stripe is down'));

      await expect(service.eraseDue(NOW)).resolves.toEqual([]);

      expect(prisma.workspace.delete).not.toHaveBeenCalled();
      expect(prisma.billingEvent.updateMany).not.toHaveBeenCalled();
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws_due' },
        data: { erasureClaimedAt: null },
      });
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/ws_due .*cus_1.*stripe is down/),
      );
      error.mockRestore();
    });

    it('keeps the claim and the workspace when it took a new stripe customer mid erasure', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      claims('cus_1');
      prisma.$queryRaw.mockResolvedValue([{ billingCustomerId: 'cus_2' }]);

      await expect(service.eraseDue(NOW)).resolves.toEqual([]);

      expect(prisma.workspace.delete).not.toHaveBeenCalled();
      expect(prisma.workspace.update).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/ws_due .*cus_2/),
      );
      warn.mockRestore();
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
      prisma.workspace.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.eraseDue(NOW)).resolves.toEqual([]);

      expect(stripe.deleteCustomer).not.toHaveBeenCalled();
      expect(prisma.workspace.delete).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('clears a scheduled deletion that erasure has not claimed', async () => {
      prisma.workspace.updateMany.mockResolvedValue({ count: 1 });
      prisma.workspace.findUniqueOrThrow.mockResolvedValue({
        deletionRequestedAt: null,
        deletionRequestedBy: null,
        deletionDueAt: null,
      });

      await expect(service.cancel()).resolves.toMatchObject({
        scheduled: false,
      });
      expect(prisma.workspace.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws_due', erasureClaimedAt: null },
        }),
      );
    });

    it('refuses once erasure has claimed the workspace', async () => {
      prisma.workspace.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancel()).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
