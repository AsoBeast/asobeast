import request from 'supertest';
import type {
  AppSummary,
  CompetitorAnalysis,
  PortfolioSummary,
  TrackedKeywordItem,
} from '@asobeast/shared';
import {
  createIsolationFixture,
  IsolationFixture,
  SHARED_KEYWORD,
} from './fixture';
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
    name: 'GET /portfolio/insights',
    path: () => '/portfolio/insights',
    identity: (body) =>
      ids(
        (body as { apps: { appId: string }[] }).apps.map((app) => ({
          id: app.appId,
        })),
      ),
  },
  {
    name: 'GET /actions',
    path: () => '/actions',
    identity: (body) => ids((body as { items: { id: string }[] }).items),
  },
  {
    name: 'GET /workspace/checklist',
    path: () => '/workspace/checklist',
    identity: (body) =>
      (body as { items: { id: string; appId: string | null }[] }).items.map(
        (item) => `${item.id}:${item.appId}`,
      ),
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
    name: 'GET /apps/:id/changes/impact',
    path: (workspace) => `/apps/${workspace.appleAppId}/changes/impact`,
    identity: (body) => {
      const report = body as {
        appId: string;
        items: { changedOn: string; fields: string[] }[];
      };
      return [
        report.appId,
        ...report.items.map(
          (item) => `${item.changedOn}:${item.fields.join(',')}`,
        ),
      ];
    },
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
  {
    name: 'GET /apps/:id/keyword-discoveries',
    path: (workspace) => `/apps/${workspace.appleAppId}/keyword-discoveries`,
    identity: (body) =>
      (body as { items: { keywordId: string }[] }).items
        .map((item) => item.keywordId)
        .sort(),
  },
  {
    name: 'GET /apps/:id/localizations',
    path: (workspace) => `/apps/${workspace.appleAppId}/localizations`,
    identity: (body) =>
      (body as { localizations: { phrases: string[] }[] }).localizations
        .flatMap((item) => item.phrases)
        .sort(),
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
    name: 'GET /apps/:id/reviews/themes',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/reviews/themes`,
  },
  {
    name: 'GET /apps/:id/reviews/histogram',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/reviews/histogram`,
  },
  {
    name: 'GET /apps/:id/funnel',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/funnel`,
  },
  {
    name: 'GET /apps/:id/localizations',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/localizations`,
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
    name: 'GET /apps/:id/keywords/:keywordId/breakdown',
    path: (w: IsolationWorkspace) =>
      `/apps/${w.appleAppId}/keywords/${w.keywordId}/breakdown`,
  },
  {
    name: 'GET /apps/:id/competitors/analysis',
    path: (w: IsolationWorkspace) =>
      `/apps/${w.appleAppId}/competitors/analysis`,
  },
  {
    name: 'GET /apps/:id/changes/impact',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/changes/impact`,
  },
  {
    name: 'GET /apps/:id/visibility-history',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/visibility-history`,
  },
  {
    name: 'GET /apps/:id/visibility-history?compare=competitors',
    path: (w: IsolationWorkspace) =>
      `/apps/${w.appleAppId}/visibility-history?compare=competitors`,
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
  {
    name: 'GET /apps/:id/first-run',
    path: (w: IsolationWorkspace) => `/apps/${w.appleAppId}/first-run`,
  },
  {
    name: 'GET /actions/:id',
    path: (w: IsolationWorkspace) => `/actions/${w.actionId}`,
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

  it('answers each workspace its own checklist goal and dismissal', async () => {
    const dismissedAt = new Date('2026-11-04T08:00:00.000Z');
    await fixture.db.workspace.update({
      where: { id: fixture.a.id },
      data: { checklistGoal: 'use_with_ai', checklistDismissedAt: dismissedAt },
    });
    await fixture.db.workspace.update({
      where: { id: fixture.b.id },
      data: { checklistGoal: 'research_idea', checklistDismissedAt: null },
    });

    const [forA, forB] = await Promise.all([
      fixture.a.agent.get('/workspace/checklist').expect(200),
      fixture.b.agent.get('/workspace/checklist').expect(200),
    ]);

    expect(forA.body).toMatchObject({
      goal: 'use_with_ai',
      dismissedAt: dismissedAt.toISOString(),
    });
    expect(forB.body).toMatchObject({
      goal: 'research_idea',
      dismissedAt: null,
    });
  });

  it('keeps another workspace rankings out of the gap lists and the share of voice', async () => {
    const gapsOf = async (workspace: IsolationWorkspace) =>
      (
        await workspace.agent
          .get(`/apps/${workspace.appleAppId}/competitors/analysis`)
          .expect(200)
      ).body as CompetitorAnalysis;
    const keywordIds = (rows: { keywordId: string }[] | undefined) =>
      (rows ?? []).map(({ keywordId }) => keywordId);

    const forA = await gapsOf(fixture.a);
    const forB = await gapsOf(fixture.b);

    expect(keywordIds(forA.gaps.lead)).toEqual([fixture.a.keywordId]);
    expect(keywordIds(forB.gaps.lead)).toEqual([]);
    expect(keywordIds(forB.gaps.outranked)).toEqual([fixture.b.keywordId]);
    for (const [answer, other] of [
      [forA, fixture.b],
      [forB, fixture.a],
    ] as const) {
      expect(JSON.stringify(answer)).not.toContain(other.appleAppId);
      expect(JSON.stringify(answer)).not.toContain(other.competitorId);
    }

    const shareOf = async (workspace: IsolationWorkspace) =>
      (
        (
          await workspace.agent
            .get(`/apps/${workspace.appleAppId}/summary`)
            .expect(200)
        ).body as AppSummary
      ).shareOfVoice;
    const shareA = await shareOf(fixture.a);
    const shareB = await shareOf(fixture.b);

    expect(shareA?.competitors).toBe(1);
    expect(shareB?.competitors).toBe(1);
    expect(shareA?.current).toBeGreaterThan(50);
    expect(shareB?.current).toBeLessThan(50);
  });

  it("refuses a breakdown of another workspace's private keyword", async () => {
    await fixture.b.agent
      .get(
        `/apps/${fixture.b.appleAppId}/keywords/${fixture.b.privateKeywordId}/breakdown`,
      )
      .expect(200);

    await fixture.a.agent
      .get(
        `/apps/${fixture.a.appleAppId}/keywords/${fixture.b.privateKeywordId}/breakdown`,
      )
      .expect(404);
  });

  it("never lists another workspace's keyword discoveries", async () => {
    const own = await fixture.b.agent
      .get(`/apps/${fixture.b.appleAppId}/keyword-discoveries`)
      .expect(200);
    expect(JSON.stringify(own.body)).toContain(fixture.b.discoveryKeywordId);

    const refused = await fixture.a.agent
      .get(`/apps/${fixture.b.appleAppId}/keyword-discoveries`)
      .expect(404);

    expect(JSON.stringify(refused.body)).not.toContain(
      fixture.b.discoveryKeywordId,
    );
  });

  it("never counts another workspace's keyword discoveries", async () => {
    const extra = await fixture.db.keyword.create({
      data: { text: 'a second discovery', store: 'APP_STORE', country: 'us' },
    });
    await fixture.db.keywordDiscovery.create({
      data: {
        appId: fixture.a.appleAppId,
        workspaceId: fixture.a.id,
        keywordId: extra.id,
        source: 'subtitle',
        relevance: 90,
        position: 7,
        depth: 200,
        checkedOn: new Date('2026-11-02T00:00:00.000Z'),
      },
    });
    const discoveriesOf = async (workspace: IsolationWorkspace) => {
      const portfolio = (await workspace.agent.get('/portfolio').expect(200))
        .body as PortfolioSummary;
      const summary = (
        await workspace.agent
          .get(`/apps/${workspace.appleAppId}/summary`)
          .expect(200)
      ).body as AppSummary;
      return {
        portfolio: portfolio.apps.find(
          (entry) => entry.id === workspace.appleAppId,
        )?.discoveries,
        summary: summary.discoveries,
      };
    };

    try {
      expect(await discoveriesOf(fixture.a)).toEqual({
        portfolio: { open: 2, ranked: 1 },
        summary: { open: 2, ranked: 1 },
      });
      expect(await discoveriesOf(fixture.b)).toEqual({
        portfolio: { open: 1, ranked: 0 },
        summary: { open: 1, ranked: 0 },
      });
    } finally {
      await fixture.db.keyword.delete({ where: { id: extra.id } });
    }
  });

  it("never marks a word from another workspace's listing", async () => {
    await fixture.db.appSnapshot.create({
      data: {
        appId: fixture.b.appleAppId,
        title: 'Habit Tracker Pro',
        description: 'Isolation description',
        raw: { source: 'isolation', primaryGenreId: 6007, price: 0 },
      },
    });
    const sharedOf = async (workspace: IsolationWorkspace) =>
      (
        (
          await workspace.agent
            .get(`/apps/${workspace.appleAppId}/keywords`)
            .expect(200)
        ).body as TrackedKeywordItem[]
      ).find((item) => item.text === SHARED_KEYWORD && item.country === 'us');

    const forA = await sharedOf(fixture.a);
    const forB = await sharedOf(fixture.b);

    expect(forA).toBeDefined();
    expect(forA).not.toHaveProperty('matchedIn');
    expect(forB?.matchedIn).toEqual([
      { text: SHARED_KEYWORD, surface: 'title', match: 'exact' },
    ]);
  });

  it('answers 404 for the localized listing of another workspace app', async () => {
    await fixture.db.appSnapshot.create({
      data: {
        appId: fixture.a.appleAppId,
        localization: 'pl',
        title: 'Polski tytuł',
        description: 'Opis',
        raw: { screenshots: [] },
      },
    });

    const own = await fixture.a.agent
      .get(`/apps/${fixture.a.appleAppId}?localization=pl`)
      .expect(200);
    expect((own.body as { localization?: string }).localization).toBe('pl');

    for (const path of [
      `/apps/${fixture.a.appleAppId}?localization=pl`,
      `/apps/${fixture.a.appleAppId}/screenshots?localization=pl`,
      `/apps/${fixture.a.appleAppId}/metadata/audit?localization=pl`,
      `/apps/${fixture.a.appleAppId}/listing-markets`,
    ]) {
      await fixture.b.agent.get(path).expect(404);
    }
  });

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

  it('counts nothing for another workspace app id in the action summary', async () => {
    const response = await fixture.b.agent
      .get('/actions/summary')
      .query({ appId: fixture.a.appleAppId })
      .expect(200);
    const summary = response.body as {
      open: number;
      byStatus: Record<string, number>;
    };

    expect(summary.open).toBe(0);
    expect(Object.values(summary.byStatus).every((count) => count === 0)).toBe(
      true,
    );
  });

  it('never counts another workspace action events in the activity', async () => {
    const response = await fixture.b.agent
      .get('/actions/activity')
      .query({ appId: fixture.a.appleAppId })
      .expect(200);
    const own = await fixture.b.agent.get('/actions/activity').expect(200);
    const opened = (body: unknown) =>
      (body as { totals: { opened: number } }).totals.opened;

    expect(opened(response.body)).toBe(0);
    expect(opened(own.body)).toBe(1);
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
