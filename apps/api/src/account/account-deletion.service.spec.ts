import { ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { StripeService } from '../billing/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountDeletionService,
  OPERATOR_WORKSPACE_DELETION_REFUSED,
} from './account-deletion.service';

const NOW = new Date('2026-09-22T05:00:00.000Z');
const OPERATOR_WORKSPACE = 'ws_default';
const WITHDRAWN = {
  deletionRequestedAt: null,
  deletionRequestedBy: null,
  deletionDueAt: null,
  erasureClaimedAt: null,
};
const ACTOR = { email: 'owner@example.com' } as User;

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
    user: { count: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    withTransaction: jest.fn(),
  };
  const stripe = { enabled: true, deleteCustomer: jest.fn() };
  const scope = { workspaceId: 'ws_due' };

  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
    { require: () => scope.workspaceId } as unknown as WorkspaceContext,
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
    scope.workspaceId = 'ws_due';
    prisma.user.count.mockResolvedValue(0);
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

  describe('the workspace that holds the platform operator', () => {
    beforeEach(() => {
      scope.workspaceId = OPERATOR_WORKSPACE;
      prisma.workspace.findMany.mockResolvedValue([{ id: OPERATOR_WORKSPACE }]);
    });

    it('refuses a deletion request while accounts exist outside it', async () => {
      prisma.user.count.mockResolvedValue(2);

      await expect(service.request(ACTOR, 'DELETE', NOW)).rejects.toThrow(
        new ConflictException(OPERATOR_WORKSPACE_DELETION_REFUSED),
      );

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { workspaceId: { not: OPERATOR_WORKSPACE } },
      });
      expect(prisma.workspace.update).not.toHaveBeenCalled();
    });

    it('accepts a deletion request when it holds every account', async () => {
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.request(ACTOR, 'DELETE', NOW),
      ).resolves.toMatchObject({
        scheduled: true,
      });
    });

    it('never counts accounts for an ordinary workspace', async () => {
      scope.workspaceId = 'ws_tenant';
      prisma.user.count.mockResolvedValue(5);

      await expect(
        service.request(ACTOR, 'DELETE', NOW),
      ).resolves.toMatchObject({
        scheduled: true,
      });

      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('cancels a due deletion without claiming it or asking stripe while accounts exist', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      prisma.user.count.mockResolvedValue(3);

      await expect(service.eraseDue(NOW)).resolves.toEqual([]);

      expect(prisma.workspace.updateMany).not.toHaveBeenCalled();
      expect(stripe.deleteCustomer).not.toHaveBeenCalled();
      expect(prisma.workspace.delete).not.toHaveBeenCalled();
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: OPERATOR_WORKSPACE },
        data: WITHDRAWN,
      });
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/ws_default .*platform operator/),
      );
      error.mockRestore();
    });

    it('locks registration before it recounts accounts and deletes', async () => {
      claims(null);

      await expect(service.eraseDue(NOW)).resolves.toEqual([
        OPERATOR_WORKSPACE,
      ]);

      const lock = prisma.$executeRaw.mock.invocationCallOrder[0];
      expect(lock).toBeLessThan(prisma.user.count.mock.invocationCallOrder[1]);
      expect(lock).toBeLessThan(
        prisma.workspace.delete.mock.invocationCallOrder[0],
      );
    });

    it('keeps the workspace when an account registered while erasure was under way', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      claims(null);
      prisma.user.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await expect(service.eraseDue(NOW)).resolves.toEqual([]);

      expect(prisma.workspace.delete).not.toHaveBeenCalled();
      expect(prisma.billingEvent.updateMany).not.toHaveBeenCalled();
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: OPERATOR_WORKSPACE },
        data: WITHDRAWN,
      });
      error.mockRestore();
    });
  });

  describe('an ordinary workspace', () => {
    it('is erased without taking the registration lock', async () => {
      claims(null);

      await expect(service.eraseDue(NOW)).resolves.toEqual(['ws_due']);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.user.count).not.toHaveBeenCalled();
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
