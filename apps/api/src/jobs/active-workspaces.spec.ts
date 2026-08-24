import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveWorkspaces } from './active-workspaces';

const NOW = new Date('2026-08-08T00:00:00Z');
const DAY_MS = 24 * 60 * 60_000;

interface WorkspaceRow {
  id: string;
  plan: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
  suspendedAt: Date | null;
}

const trialing = (id: string): WorkspaceRow => ({
  id,
  plan: 'trial',
  trialEndsAt: new Date(NOW.getTime() + DAY_MS),
  planExpiresAt: null,
  suspendedAt: null,
});

const lapsed = (id: string): WorkspaceRow => ({
  id,
  plan: 'free',
  trialEndsAt: new Date(NOW.getTime() - DAY_MS),
  planExpiresAt: null,
  suspendedAt: null,
});

const paying = (id: string): WorkspaceRow => ({
  id,
  plan: 'indie',
  trialEndsAt: null,
  planExpiresAt: null,
  suspendedAt: null,
});

const suspended = (id: string): WorkspaceRow => ({
  ...paying(id),
  suspendedAt: NOW,
});

describe('ActiveWorkspaces', () => {
  const findMany = jest.fn<Promise<WorkspaceRow[]>, [unknown]>();

  const prisma = {
    workspace: { findMany },
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const rosterWith = (billing: boolean) =>
    new ActiveWorkspaces(prisma, crossTenant, {
      get: () => billing,
    } as unknown as ConfigService<Env, true>);

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
  });

  it('asks only for workspaces that have an app to work on', async () => {
    await rosterWith(false).forDailyRun(NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { apps: { some: {} } },
      }) as Record<string, unknown>,
    );
  });

  it('visits every workspace on a self hosted instance', async () => {
    findMany.mockResolvedValue([lapsed('ws_a')]);

    await expect(rosterWith(false).forDailyRun(NOW)).resolves.toEqual(['ws_a']);
  });

  it('skips a workspace whose trial expired', async () => {
    findMany.mockResolvedValue([paying('ws_paying'), lapsed('ws_lapsed')]);

    await expect(rosterWith(true).forDailyRun(NOW)).resolves.toEqual([
      'ws_paying',
    ]);
  });

  it('keeps a workspace on its own trial regardless of who signed up', async () => {
    findMany.mockResolvedValue([trialing('ws_trial')]);

    await expect(rosterWith(true).forDailyRun(NOW)).resolves.toEqual([
      'ws_trial',
    ]);
  });

  it('skips a workspace that never carried an entitlement', async () => {
    findMany.mockResolvedValue([
      {
        id: 'ws_orphan',
        plan: 'free',
        trialEndsAt: null,
        planExpiresAt: null,
        suspendedAt: null,
      },
    ]);

    await expect(rosterWith(true).forDailyRun(NOW)).resolves.toEqual([]);
  });

  it('leaves a suspended workspace out of the daily run', async () => {
    findMany.mockResolvedValue([paying('ws_ok'), suspended('ws_held')]);

    await expect(rosterWith(true).forDailyRun(NOW)).resolves.toEqual(['ws_ok']);
  });
});
