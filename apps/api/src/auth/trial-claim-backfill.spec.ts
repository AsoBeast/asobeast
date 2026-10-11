import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { BACKFILL_PAGE_SIZE, TrialClaimBackfill } from './trial-claim-backfill';
import { TrialClaims } from './trial-claims';

const ownersOf = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `u${from + index}`,
    email: `owner${from + index}@example.com`,
  }));

describe('TrialClaimBackfill', () => {
  const findMany = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const claimAll = jest.fn();

  const build = (billing = true) =>
    new TrialClaimBackfill(
      { user: { findMany } } as unknown as PrismaService,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: (
          _justification: string,
          work: () => Promise<unknown>,
        ) => work(),
      } as unknown as CrossTenantAccess,
      { claimAll } as unknown as TrialClaims,
      { get: () => billing } as unknown as ConfigService<Env, true>,
    );

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    claimAll
      .mockReset()
      .mockImplementation((_db, emails: string[]) =>
        Promise.resolve(emails.length),
      );
  });

  it('reads only owners of workspaces that started a trial', async () => {
    await build().run();

    expect(findMany).toHaveBeenCalledWith({
      where: { role: 'owner', workspace: { trialStartedAt: { not: null } } },
      select: { id: true, email: true },
      orderBy: { id: 'asc' },
      take: BACKFILL_PAGE_SIZE,
    });
  });

  it('claims every page and adds up what was new', async () => {
    findMany
      .mockResolvedValueOnce(ownersOf(0, BACKFILL_PAGE_SIZE))
      .mockResolvedValueOnce(ownersOf(BACKFILL_PAGE_SIZE, 3))
      .mockResolvedValueOnce([]);

    await expect(build().run()).resolves.toBe(BACKFILL_PAGE_SIZE + 3);

    expect(findMany.mock.calls[1][0]).toMatchObject({
      cursor: { id: `u${BACKFILL_PAGE_SIZE - 1}` },
      skip: 1,
    });
    expect(claimAll).toHaveBeenCalledTimes(2);
  });

  it('does nothing when billing is off', async () => {
    await build(false).onApplicationBootstrap();

    expect(findMany).not.toHaveBeenCalled();
  });

  it('lets the application boot when the claim fails', async () => {
    findMany.mockRejectedValue(new Error('database is down'));

    await expect(build().onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
