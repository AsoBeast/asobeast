import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { OVER_LIMIT_GRACE_DAYS } from '../jobs/over-limit';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionEligibility } from './collection-eligibility.service';
import { QuotaService } from './quota.service';

const NOW = new Date('2026-08-21T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60_000;
const PAST_GRACE = new Date(
  NOW.getTime() - (OVER_LIMIT_GRACE_DAYS + 1) * DAY_MS,
);
const WITHIN_GRACE = new Date(NOW.getTime() - DAY_MS);

interface WorkspaceRow {
  id: string;
  plan: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
  suspendedAt: Date | null;
  overLimitSince: Date | null;
}

const workspace = (over: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  id: 'ws_a',
  plan: 'premium',
  trialEndsAt: null,
  planExpiresAt: null,
  suspendedAt: null,
  overLimitSince: null,
  ...over,
});

describe('CollectionEligibility', () => {
  const findMany = jest.fn();
  const trackedFindMany = jest.fn();
  const limitFor = jest.fn<Promise<number | null>, [string]>();

  let context = new WorkspaceContext();

  const build = (rows: WorkspaceRow[], billing = true) => {
    findMany.mockResolvedValue(rows);
    context = new WorkspaceContext();
    return new CollectionEligibility(
      {
        workspace: { findMany },
        trackedKeyword: { findMany: trackedFindMany },
      } as unknown as PrismaService,
      new CrossTenantAccess(context),
      { get: () => billing } as unknown as ConfigService<Env, true>,
      context,
      { limitFor } as unknown as QuotaService,
    );
  };

  beforeEach(() => {
    findMany.mockReset();
    trackedFindMany.mockReset().mockResolvedValue([]);
    limitFor.mockReset().mockResolvedValue(null);
  });

  it('admits an entitled workspace inside its limit', async () => {
    const eligible = await build([workspace()]).forKeyword(
      ['ws_a'],
      'kw1',
      NOW,
    );

    expect(eligible).toEqual(new Set(['ws_a']));
  });

  it('refuses a suspended workspace', async () => {
    const eligible = await build([
      workspace({ suspendedAt: new Date() }),
    ]).forKeyword(['ws_a'], 'kw1', NOW);

    expect(eligible.size).toBe(0);
  });

  it('refuses an unentitled workspace while billing is on', async () => {
    const eligible = await build([workspace({ plan: 'free' })]).forKeyword(
      ['ws_a'],
      'kw1',
      NOW,
    );

    expect(eligible.size).toBe(0);
  });

  it('admits an unentitled workspace on a self-hosted instance', async () => {
    const eligible = await build(
      [workspace({ plan: 'free' })],
      false,
    ).forKeyword(['ws_a'], 'kw1', NOW);

    expect(eligible).toEqual(new Set(['ws_a']));
  });

  it('refuses a trial that has run out', async () => {
    const eligible = await build([
      workspace({
        plan: 'free',
        trialEndsAt: new Date(NOW.getTime() - DAY_MS),
      }),
    ]).forKeyword(['ws_a'], 'kw1', NOW);

    expect(eligible.size).toBe(0);
  });

  it('judges each workspace of a shared keyword on its own state', async () => {
    const eligible = await build([
      workspace({ id: 'ws_paying' }),
      workspace({ id: 'ws_suspended', suspendedAt: new Date() }),
    ]).forKeyword(['ws_paying', 'ws_suspended'], 'kw1', NOW);

    expect(eligible).toEqual(new Set(['ws_paying']));
  });

  it('never asks the database about a workspace it was not given', async () => {
    await build([workspace()]).forKeyword([], 'kw1', NOW);

    expect(findMany).not.toHaveBeenCalled();
  });

  describe('over the keyword limit', () => {
    const overLimit = (overLimitSince: Date) =>
      build([workspace({ overLimitSince })]);

    beforeEach(() => {
      limitFor.mockResolvedValue(2);
      trackedFindMany.mockResolvedValue([
        { keywordId: 'kw1' },
        { keywordId: 'kw2' },
        { keywordId: 'kw3' },
      ]);
    });

    it('judges each over-limit workspace inside its own tenancy scope', async () => {
      const rows = Array.from({ length: 9 }, (_, index) =>
        workspace({ id: `ws_${index}`, overLimitSince: PAST_GRACE }),
      );
      const service = build(rows);
      const seen: Array<string | undefined> = [];
      trackedFindMany.mockImplementation(() => {
        seen.push(context.current);
        return Promise.resolve([{ keywordId: 'kw1' }, { keywordId: 'kw2' }]);
      });

      const eligible = await service.forKeyword(
        rows.map((row) => row.id),
        'kw1',
        NOW,
      );

      expect(eligible).toEqual(new Set(rows.map((row) => row.id)));
      expect(seen).toEqual(rows.map((row) => row.id));
    });

    it('leaves no workspace in scope once the batch settles', async () => {
      const rows = Array.from({ length: 5 }, (_, index) =>
        workspace({ id: `ws_${index}`, overLimitSince: PAST_GRACE }),
      );
      const service = build(rows);

      await service.forKeyword(
        rows.map((row) => row.id),
        'kw1',
        NOW,
      );

      expect(context.current).toBeUndefined();
    });

    it('drops a keyword outside the covered set once the grace period is over', async () => {
      const eligible = await overLimit(PAST_GRACE).forKeyword(
        ['ws_a'],
        'kw3',
        NOW,
      );

      expect(eligible.size).toBe(0);
    });

    it('keeps a keyword inside the covered set', async () => {
      const eligible = await overLimit(PAST_GRACE).forKeyword(
        ['ws_a'],
        'kw2',
        NOW,
      );

      expect(eligible).toEqual(new Set(['ws_a']));
    });

    it('keeps every keyword while the workspace is still inside its grace period', async () => {
      const eligible = await overLimit(WITHIN_GRACE).forKeyword(
        ['ws_a'],
        'kw3',
        NOW,
      );

      expect(eligible).toEqual(new Set(['ws_a']));
    });

    it('keeps every keyword when the plan carries no limit', async () => {
      limitFor.mockResolvedValue(null);

      const eligible = await overLimit(PAST_GRACE).forKeyword(
        ['ws_a'],
        'kw3',
        NOW,
      );

      expect(eligible).toEqual(new Set(['ws_a']));
    });

    it('counts no tracked keywords for a workspace that was never over its limit', async () => {
      await build([workspace()]).forKeyword(['ws_a'], 'kw3', NOW);

      expect(trackedFindMany).not.toHaveBeenCalled();
    });
  });
});
