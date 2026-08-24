import { CrossTenantAccess } from '../../src/common/tenancy/cross-tenant-access';
import { TENANT_TABLES } from '../../src/common/tenancy/tenant-tables';
import { WorkspaceContext } from '../../src/common/tenancy/workspace-context';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createIsolationFixture, IsolationFixture } from './fixture';

const SCOPED_TABLES = [
  'app',
  'appSnapshot',
  'trackedKeyword',
  'keywordRanking',
  'categoryRank',
  'changeEvent',
  'review',
  'auditScore',
  'actionItem',
  'webhook',
  'emailAlert',
  'user',
  'workspaceInvite',
] as const;

describe('Row level security', () => {
  let fixture: IsolationFixture;
  let prisma: PrismaService;
  let workspace: WorkspaceContext;
  let crossTenant: CrossTenantAccess;

  beforeAll(async () => {
    fixture = await createIsolationFixture();
    prisma = fixture.app.get(PrismaService);
    workspace = fixture.app.get(WorkspaceContext);
    crossTenant = fixture.app.get(CrossTenantAccess);
  }, 60_000);

  afterAll(() => fixture.close());

  const unscopedCount = (table: (typeof SCOPED_TABLES)[number]) =>
    (prisma[table] as { count: () => Promise<number> }).count();

  it.each(SCOPED_TABLES)(
    'returns no %s rows to a query with no workspace in scope',
    async (table) => {
      await expect(unscopedCount(table)).resolves.toBe(0);
    },
  );

  it.each(SCOPED_TABLES)(
    'returns fewer %s rows inside a workspace than the escape hatch sees',
    async (table) => {
      const scoped = await workspace.run(fixture.a.id, async () => {
        const count = await unscopedCount(table);
        return count;
      });
      const everything =
        await crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
          'the isolation suite counts every workspace on purpose',
          () => unscopedCount(table),
        );

      expect(scoped).toBeGreaterThan(0);
      expect(everything).toBeGreaterThan(scoped);
    },
  );

  it('answers a where-less findMany with one workspace only', async () => {
    const seen = await workspace.run(fixture.a.id, async () => {
      const rows = await prisma.app.findMany({ select: { workspaceId: true } });
      return rows;
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((row) => row.workspaceId))).toEqual(
      new Set([fixture.a.id]),
    );
  });

  it('blocks a deliberately unscoped service query', async () => {
    const leaky = () => prisma.app.findMany({ select: { id: true } });

    const outsideAnyWorkspace = await leaky();
    const insideWorkspaceA = await workspace.run(fixture.a.id, async () => {
      const rows = await leaky();
      return rows;
    });

    expect(outsideAnyWorkspace).toEqual([]);
    expect(insideWorkspaceA.map((row) => row.id)).toContain(
      fixture.a.appleAppId,
    );
    expect(insideWorkspaceA.map((row) => row.id)).not.toContain(
      fixture.b.appleAppId,
    );
  });

  it('never crosses workspaces under interleaved concurrent reads', async () => {
    const read = (workspaceId: string, delayMs: number) =>
      workspace.run(workspaceId, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const rows = await prisma.app.findMany({
          select: { workspaceId: true },
        });
        return new Set(rows.map((row) => row.workspaceId));
      });

    const results = await Promise.all([
      read(fixture.a.id, 0),
      read(fixture.b.id, 6),
      read(fixture.a.id, 12),
      read(fixture.b.id, 0),
      read(fixture.a.id, 6),
      read(fixture.b.id, 12),
      read(fixture.a.id, 3),
      read(fixture.b.id, 9),
    ]);

    expect(results).toEqual([
      new Set([fixture.a.id]),
      new Set([fixture.b.id]),
      new Set([fixture.a.id]),
      new Set([fixture.b.id]),
      new Set([fixture.a.id]),
      new Set([fixture.b.id]),
      new Set([fixture.a.id]),
      new Set([fixture.b.id]),
    ]);
  });

  it('leaves the shared search tables readable without a workspace', async () => {
    await expect(prisma.keyword.count()).resolves.toBeGreaterThan(0);
    await expect(prisma.serpEntry.count()).resolves.toBe(0);
    await expect(prisma.keywordMetric.count()).resolves.toBe(0);
  });

  it('keeps a policy on every table the application calls tenant-owned', async () => {
    const rows = await prisma.$queryRaw<{ relname: string }[]>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_policy p ON p.polrelid = c.oid
      WHERE n.nspname = 'public' AND p.polname = 'tenant_isolation'
    `;

    expect(rows.map((row) => row.relname).sort()).toEqual([...TENANT_TABLES]);
  });

  it('pins the search path of every policy helper', async () => {
    const rows = await prisma.$queryRaw<
      { proname: string; proconfig: string[] | null }[]
    >`
      SELECT p.proname, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'app\\_%'
    `;

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.proconfig).toContain('search_path=pg_catalog');
    }
  });

  it('runs a raw query as the application role, never as the owner', async () => {
    const [unscoped] = await prisma.$queryRaw<{ role: string }[]>`
      SELECT current_user AS role
    `;
    const [scoped] = await workspace.run(
      fixture.a.id,
      () =>
        prisma.$queryRaw<{ role: string; workspace: string }[]>`
        SELECT current_user AS role, app_current_workspace() AS workspace
      `,
    );

    expect(unscoped.role).toBe('asobeast_app');
    expect(scoped).toEqual({ role: 'asobeast_app', workspace: fixture.a.id });
  });

  it('returns no rows to a raw tenant-table read with no workspace in scope', async () => {
    const unscoped = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "App"
    `;
    const scoped = await workspace.run(
      fixture.a.id,
      () => prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "App"`,
    );

    expect(unscoped).toEqual([]);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.map((row) => row.id)).not.toContain(fixture.b.appleAppId);
  });

  it('leaves the application role unable to shadow a policy helper', async () => {
    const [privileges] = await prisma.$queryRaw<{ canCreate: boolean }[]>`
      SELECT has_schema_privilege('asobeast_app', 'public', 'CREATE') AS "canCreate"
    `;
    const [role] = await prisma.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'asobeast_app'
    `;

    expect(privileges.canCreate).toBe(false);
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});
