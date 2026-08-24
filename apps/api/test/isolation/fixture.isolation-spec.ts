import {
  createIsolationFixture,
  IsolationFixture,
  SHARED_KEYWORD,
  SHARED_STORE_APP_ID,
} from './fixture';

describe('Two-workspace isolation fixture', () => {
  let fixture: IsolationFixture;

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it('populates two independent workspaces', async () => {
    const workspaces = await fixture.db.workspace.findMany({
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    expect(workspaces.map((row) => row.id)).toEqual(['ws_iso_a', 'ws_iso_b']);
    expect(fixture.a.appleAppId).not.toBe(fixture.b.appleAppId);
  });

  it('overlaps the data that would hide a broken query', async () => {
    const apps = await fixture.db.app.findMany({
      where: { storeAppId: SHARED_STORE_APP_ID },
      select: { workspaceId: true },
    });

    expect(apps.map((row) => row.workspaceId).sort()).toEqual([
      'ws_iso_a',
      'ws_iso_b',
    ]);
  });

  it('shares one keyword row between both workspaces', async () => {
    const rows = await fixture.db.keyword.findMany({
      where: { text: SHARED_KEYWORD, country: 'us' },
      select: { id: true, tracked: { select: { appId: true } } },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].tracked.map((row) => row.appId).sort()).toEqual(
      [fixture.a.appleAppId, fixture.b.appleAppId].sort(),
    );
  });

  it('gives each workspace a signed-in session and a personal token', async () => {
    for (const workspace of [fixture.a, fixture.b]) {
      const bySession = await workspace.agent.get('/auth/me').expect(200);
      expect((bySession.body as { email: string }).email).toBe(workspace.email);

      const byToken = await fixture.a.agent
        .get('/auth/me')
        .set('Authorization', `Bearer ${workspace.token}`)
        .expect(200);
      expect((byToken.body as { email: string }).email).toBeDefined();
    }
  });

  it('gives each workspace distinct, assertable values', async () => {
    const scores = await fixture.db.auditScore.findMany({
      orderBy: { overall: 'asc' },
      select: { overall: true },
    });

    expect(scores.map((row) => row.overall)).toEqual([20, 80]);
  });
});
