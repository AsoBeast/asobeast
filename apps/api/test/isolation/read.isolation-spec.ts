import request from 'supertest';
import { createIsolationFixture, IsolationFixture } from './fixture';
import { IsolationWorkspace } from './fixture';

interface ScopedRead {
  name: string;
  path: (workspace: IsolationWorkspace) => string;
  identity: (body: unknown) => unknown;
}

const ids = (body: unknown): string[] =>
  (body as { id: string }[]).map((row) => row.id).sort();

const LISTS: ScopedRead[] = [
  {
    name: 'GET /apps',
    path: () => '/apps',
    identity: ids,
  },
  {
    name: 'GET /portfolio',
    path: () => '/portfolio',
    identity: (body) => ids((body as { apps: { id: string }[] }).apps),
  },
  {
    name: 'GET /actions',
    path: () => '/actions',
    identity: (body) => ids((body as { items: { id: string }[] }).items),
  },
  {
    name: 'GET /webhooks',
    path: () => '/webhooks',
    identity: ids,
  },
  {
    name: 'GET /email-alerts',
    path: () => '/email-alerts',
    identity: ids,
  },
  {
    name: 'GET /changes/recent',
    path: () => '/changes/recent',
    identity: (body) =>
      (body as { events: { after: string | null }[] }).events
        .map((event) => event.after)
        .sort(),
  },
  {
    name: 'GET /apps/:id/keywords',
    path: (workspace) => `/apps/${workspace.appleAppId}/keywords`,
    identity: (body) =>
      (body as { text: string; position: number | null }[])
        .map((row) => `${row.text}:${row.position ?? 'none'}`)
        .sort(),
  },
  {
    name: 'GET /apps/:id/rankings',
    path: (workspace) => `/apps/${workspace.appleAppId}/rankings`,
    identity: (body) =>
      (body as { series: { points: { position: number | null }[] }[] }).series
        .flatMap((serie) => serie.points.map((point) => point.position))
        .sort((left, right) => (left ?? 0) - (right ?? 0)),
  },
  {
    name: 'GET /apps/:id/competitors',
    path: (workspace) => `/apps/${workspace.appleAppId}/competitors`,
    identity: ids,
  },
  {
    name: 'GET /apps/:id/reviews',
    path: (workspace) => `/apps/${workspace.appleAppId}/reviews`,
    identity: (body) =>
      (body as { reviews: { text: string }[] }).reviews
        .map((review) => review.text)
        .sort(),
  },
  {
    name: 'GET /apps/:id/changes',
    path: (workspace) => `/apps/${workspace.appleAppId}/changes`,
    identity: (body) =>
      (body as { events: { after: string | null }[] }).events
        .map((event) => event.after)
        .sort(),
  },
  {
    name: 'GET /apps/:id/audit/history',
    path: (workspace) => `/apps/${workspace.appleAppId}/audit/history`,
    identity: (body) =>
      (body as { points: { overall: number | null }[] }).points.map(
        (point) => point.overall,
      ),
  },
  {
    name: 'GET /apps/:id/category-ranks',
    path: (workspace) => `/apps/${workspace.appleAppId}/category-ranks`,
    identity: (body) =>
      (body as { series: { points: { position: number | null }[] }[] }).series
        .flatMap((serie) => serie.points.map((point) => point.position))
        .sort((left, right) => (left ?? 0) - (right ?? 0)),
  },
  {
    name: 'GET /apps/:id/actions',
    path: (workspace) => `/apps/${workspace.appleAppId}/actions`,
    identity: (body) => ids((body as { items: { id: string }[] }).items),
  },
];

const BY_ID = [
  {
    name: 'GET /apps/:id',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}`,
  },
  {
    name: 'GET /apps/:id/summary',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/summary`,
  },
  {
    name: 'GET /apps/:id/metadata/audit',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/metadata/audit`,
  },
  {
    name: 'GET /apps/:id/audit',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/audit`,
  },
  {
    name: 'GET /apps/:id/reviews/histogram',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/reviews/histogram`,
  },
  {
    name: 'GET /apps/:id/keyword-countries',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/keyword-countries`,
  },
  {
    name: 'GET /apps/:id/keywords/compare',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/keywords/compare`,
  },
  {
    name: 'GET /apps/:id/competitors/analysis',
    path: (w: IsolationWorkspace) =>
      `/apps/${w.appleAppId}/competitors/analysis`,
  },
  {
    name: 'GET /apps/:id/visibility-history',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/visibility-history`,
  },
  {
    name: 'GET /apps/:id/ratings-history',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/ratings-history`,
  },
  {
    name: 'GET /apps/:id/rank-distribution-history',
    path: (w: IsolationWorkspace) =>
      `/apps/${w.appleAppId}/rank-distribution-history`,
  },
  {
    name: 'GET /apps/:id/serp-movers',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/serp-movers`,
  },
];

describe('Read isolation', () => {
  let fixture: IsolationFixture;

  beforeAll(async () => {
    fixture = await createIsolationFixture();
  }, 60_000);

  afterAll(() => fixture.close());

  it.each(LISTS.map((read) => [read.name, read] as const))(
    '%s returns only the caller workspace rows',
    async (_name, read) => {
      const forA = await fixture.a.agent.get(read.path(fixture.a)).expect(200);
      const forB = await fixture.b.agent.get(read.path(fixture.b)).expect(200);

      const seenByA = read.identity(forA.body);
      const seenByB = read.identity(forB.body);

      expect(seenByA).not.toEqual(seenByB);
      expect(JSON.stringify(forA.body)).not.toContain(fixture.b.appleAppId);
      expect(JSON.stringify(forB.body)).not.toContain(fixture.a.appleAppId);
    },
  );

  it.each(BY_ID.map((read) => [read.name, read] as const))(
    '%s answers 404 for another workspace resource',
    async (_name, read) => {
      await fixture.a.agent.get(read.path(fixture.a)).expect(200);

      const response = await fixture.a.agent.get(read.path(fixture.b));

      expect(response.status).toBe(404);
    },
  );

  it('keeps another workspace out of an aggregate that returns only numbers', async () => {
    const forA = await fixture.a.agent.get('/portfolio').expect(200);
    const forB = await fixture.b.agent.get('/portfolio').expect(200);

    const totals = (body: unknown) =>
      (body as { totals: { apps: number } }).totals.apps;
    const owned = await fixture.db.app.count({
      where: { workspaceId: fixture.a.id, isCompetitor: false },
    });

    expect(totals(forA.body)).toBe(owned);
    expect(totals(forB.body)).toBe(owned);
    expect(await fixture.db.app.count({ where: { isCompetitor: false } })).toBe(
      owned * 2,
    );
  });

  it('refuses another workspace app id as a filter value', async () => {
    const response = await fixture.a.agent.get(
      `/apps/${fixture.b.appleAppId}/keywords`,
    );

    expect(response.status).toBe(404);
  });

  it('yields nothing when filtering by a keyword only the other workspace tracks', async () => {
    const scoped = await fixture.a.agent
      .get(`/apps/${fixture.a.appleAppId}/rankings`)
      .query({ keywordIds: fixture.b.privateKeywordId })
      .expect(200);

    expect((scoped.body as { series: unknown[] }).series).toEqual([]);
  });

  it('serves the personal token the same rows as the session', async () => {
    const bySession = await fixture.a.agent.get('/apps').expect(200);
    const byToken = await request(fixture.app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${fixture.a.token}`)
      .expect(200);

    expect(ids(byToken.body)).toEqual(ids(bySession.body));
    expect(ids(byToken.body)).not.toContain(fixture.b.appleAppId);
  });
});
