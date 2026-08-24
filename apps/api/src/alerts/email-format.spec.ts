import type { ActionOpenedPayload } from '@asobeast/shared';
import {
  AlertBatchAppSection,
  AlertBatchPayload,
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
} from '@asobeast/shared';
import { formatBatchEmail, formatEmail } from './email-format';

const metadata: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App', isCompetitor: false },
  changes: [
    { field: 'title', before: 'A', after: 'B' },
    { field: 'icon', before: null, after: 'y' },
  ],
};

const dropped: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: {
    id: 'kw_1',
    text: 'fitness app',
    store: 'APP_STORE',
    country: 'us',
  },
  from: 4,
  to: 12,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

const droppedOut: RankDroppedPayload = {
  ...dropped,
  from: 3,
  to: null,
  fromDepth: 100,
  toDepth: 100,
};

const improved: RankImprovedPayload = {
  event: 'rank.improved',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: {
    id: 'kw_1',
    text: 'habit tracker',
    store: 'APP_STORE',
    country: 'de',
  },
  from: 20,
  to: 7,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

const negative: ReviewNegativePayload = {
  event: 'review.negative',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  review: {
    score: 1,
    title: 'Bad',
    text: 'Crashes on <launch>',
    version: '2.0.0',
    reviewedAt: '2026-07-10T00:00:00.000Z',
  },
};

const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-07-13T08:00:00.000Z',
  window: { from: '2026-07-06', to: '2026-07-13' },
  apps: Array.from({ length: 12 }, (_, i) => ({
    id: `app_${i}`,
    name: `App ${i}`,
    visibility: { current: 40 + i, delta7d: i % 2 === 0 ? 2.5 : null },
    moversUp: [],
    moversDown: [],
    changes: i,
    negativeReviews: null,
    audit: i === 0 ? { current: 78, delta7d: 3 } : null,
  })),
  groups: [],
};

const digestWithGroups: DigestWeeklyPayload = {
  ...digest,
  groups: [
    {
      id: 'grp_1',
      name: 'Habit',
      visibility: { current: 61.4, delta7d: -2.5 },
    },
  ],
};

const actionOpened: ActionOpenedPayload = {
  event: 'action.opened',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'Alpha', store: 'APP_STORE', country: 'us' },
  action: {
    id: 'act_1',
    rule: 'keyword.add_uncovered',
    category: 'metadata',
    priority: 'high',
    impact: 71,
    firstSeenAt: '2026-07-22T10:00:00.000Z',
    reopened: false,
  },
  keyword: { id: 'k1', text: 'budget planner' },
  evidence: {
    rule: 'keyword.add_uncovered',
    opportunity: 66.5,
    traffic: null,
    difficulty: null,
    volume: 62,
    relevance: 80,
    latestPosition: null,
    indexedFields: ['title', 'subtitle', 'keywordField'],
    uncoveredFields: ['title', 'subtitle', 'keywordField'],
    keywordFieldCharsFree: 18,
    scoreProvenance: null,
  },
  link: 'https://aso.example.com/actions?action=act_1',
};

describe('the same phrase in two markets', () => {
  const inMarket = (country: string) => ({
    ...dropped,
    keyword: { ...dropped.keyword, country },
  });

  it('subjects each market distinguishably', () => {
    expect(formatEmail(inMarket('us')).subject).not.toBe(
      formatEmail(inMarket('de')).subject,
    );
  });

  it('names the market in the body', () => {
    expect(formatEmail(inMarket('de')).text).toContain('fitness app (DE)');
  });

  it('renders a queued payload that predates the market scope', () => {
    const legacy = {
      ...dropped,
      keyword: { id: 'kw_1', text: 'fitness app' },
    } as unknown as typeof dropped;

    expect(formatEmail(legacy).subject).toContain('"fitness app"');
  });
});

describe('formatEmail', () => {
  it('subjects a rank drop with bare positions', () => {
    const email = formatEmail(dropped);
    expect(email.subject).toBe(
      '[asobeast] Rank drop: "fitness app (US)" 4 → 12',
    );
    expect(email.text).toContain('From: 4');
    expect(email.text).toContain('To: 12');
    expect(email.html).toContain('<table');
  });

  it('renders a drop out using its captured depth', () => {
    expect(formatEmail(droppedOut).subject).toBe(
      '[asobeast] Rank drop: "fitness app (US)" 3 → >100',
    );
  });

  it('subjects a rank improvement', () => {
    expect(formatEmail(improved).subject).toBe(
      '[asobeast] Rank up: "habit tracker (DE)" 20 → 7',
    );
  });

  it('lists the changed fields for a metadata change', () => {
    const email = formatEmail(metadata);
    expect(email.subject).toBe('[asobeast] My App changed title, icon');
    expect(email.text).toContain('title: A → B');
    expect(email.text).toContain('icon: — → y');
  });

  it('renders stars and version for a negative review', () => {
    const email = formatEmail(negative);
    expect(email.subject).toBe('[asobeast] ★☆☆☆☆ review (v2.0.0) for My App');
    expect(email.text).toContain('Crashes on <launch>');
  });

  it('escapes html in review content', () => {
    expect(formatEmail(negative).html).toContain('Crashes on &lt;launch&gt;');
  });

  it('caps the weekly digest at ten apps with a more line', () => {
    const email = formatEmail(digest);
    expect(email.subject).toBe('[asobeast] Weekly digest: 12 apps');
    expect(email.text).toContain('+2 more');
    expect(email.text).toContain('Window: 2026-07-06 → 2026-07-13');
  });

  it('omits the linked apps section when the digest has no groups', () => {
    expect(formatEmail(digest).text).not.toContain('Linked apps');
  });

  it('appends the audit score and delta to the app line', () => {
    expect(formatEmail(digest).text).toContain('Audit 78 (+3)');
  });

  it('renders linked apps before the per-app lines', () => {
    const { text } = formatEmail(digestWithGroups);
    expect(text).toContain('Linked apps');
    expect(text).toContain('Habit: vis 61 (-2.5)');
    expect(text.indexOf('Linked apps')).toBeLessThan(text.indexOf('App 0:'));
  });
});

const emptySection = (
  app: AlertBatchAppSection['app'],
): AlertBatchAppSection => ({
  app,
  rankDrops: [],
  rankImprovements: [],
  serpEntrants: [],
  changes: [],
  negativeReviews: [],
  actions: [],
  competitors: [],
});

const alpha: AlertBatchAppSection = {
  ...emptySection({
    id: 'a',
    name: 'Alpha',
    store: 'APP_STORE',
    country: 'us',
  }),
  rankDrops: [
    {
      event: 'rank.dropped',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'a', name: 'Alpha' },
      keyword: { id: 'k1', text: 'game' },
      from: 3,
      to: 12,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
  ],
  changes: [
    {
      event: 'metadata.changed',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'a', name: 'Alpha', isCompetitor: false },
      changes: [{ field: 'title', before: 'x'.repeat(200), after: 'short' }],
    },
  ],
};

const competitorAlpha: AlertBatchAppSection = {
  ...emptySection(alpha.app),
  competitors: [
    {
      app: { id: 'c', name: 'Charlie', store: 'APP_STORE', country: 'us' },
      changes: [
        {
          event: 'metadata.changed',
          occurredAt: '2026-07-22T10:00:00.000Z',
          app: { id: 'c', name: 'Charlie', isCompetitor: true },
          changes: [{ field: 'subtitle', before: 'a', after: 'b' }],
        },
      ],
    },
  ],
};

const bravo: AlertBatchAppSection = {
  ...emptySection({
    id: 'b',
    name: 'Bravo',
    store: 'GOOGLE_PLAY',
    country: 'gb',
  }),
  serpEntrants: [
    {
      event: 'serp.entrant',
      occurredAt: '2026-07-22T10:00:00.000Z',
      keyword: { id: 'k2', text: 'planner' },
      date: '2026-07-22',
      entrants: [
        {
          position: 4,
          storeAppId: 'x',
          title: 'Newcomer',
          appId: null,
          isCompetitor: false,
        },
      ],
    },
  ],
};

const batch: AlertBatchPayload = {
  event: 'alerts.batch',
  scope: 'owned_apps',
  occurredAt: '2026-07-22T11:00:00.000Z',
  window: { from: '2026-07-22T09:00:00.000Z', to: '2026-07-22T11:00:00.000Z' },
  totals: { events: 3, apps: 2 },
  apps: [alpha, bravo],
  events: [],
};

const competitorBatch: AlertBatchPayload = {
  ...batch,
  scope: 'competitors',
  totals: { events: 1, apps: 1 },
  apps: [competitorAlpha],
};

describe('formatBatchEmail', () => {
  it('counts each category in the subject with plurals', () => {
    const email = formatBatchEmail(batch);
    expect(email.subject).toBe(
      '[asobeast] Daily app update — 3 changes across 2 apps',
    );
    expect(email.text).toContain(
      'Summary: 1 rank drop · 0 rank improvements · 1 SERP entrant · 1 metadata change · 0 negative reviews',
    );
  });

  it('uses plural app wording for multiple apps and singular otherwise', () => {
    const single = formatBatchEmail({
      ...batch,
      apps: [bravo],
      totals: { events: 1, apps: 1 },
    });
    expect(single.subject).toBe(
      '[asobeast] Daily app update — 1 change across 1 app',
    );
  });

  it('omits empty sections from the rendered card', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('Rank drops');
    expect(email.text).not.toContain('Rank improvements');
    expect(email.text).toContain('New entrants');
  });

  it('nests competitor activity under the primary app', () => {
    const email = formatBatchEmail(competitorBatch);
    expect(email.subject).toBe(
      '[asobeast] Competitor watch — 1 change across 1 competitor',
    );
    expect(email.text).toContain('Primary app · Alpha · App Store · US');
    expect(email.text).toContain('Competitor · Charlie · App Store · US');
    expect(email.html).toContain('Competitor · Charlie · App Store · US');
  });

  it('renders queued legacy mixed batches without a scope', () => {
    const legacy = {
      ...batch,
      totals: { events: 4, apps: 2 },
      apps: [{ ...alpha, competitors: competitorAlpha.competitors }, bravo],
    };
    Reflect.deleteProperty(legacy, 'scope');

    const email = formatBatchEmail(legacy);

    expect(email.subject).toBe(
      '[asobeast] Daily alert update — 4 changes across 2 apps',
    );
    expect(email.text).toContain('Rank drops');
    expect(email.text).toContain('Competitor · Charlie · App Store · US');
    expect(email.html).toContain('Metadata changes');
  });

  it('truncates long metadata values', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('…');
    expect(email.text).not.toContain('x'.repeat(200));
  });

  it('labels each app with its store and country', () => {
    const email = formatBatchEmail(batch);
    expect(email.text).toContain('Alpha · App Store · US');
    expect(email.text).toContain('Bravo · Google Play · GB');
  });

  it('renders zero totals and every owned section in severity order', () => {
    const empty = formatBatchEmail({
      ...batch,
      totals: { events: 0, apps: 0 },
      apps: [],
    });
    expect(empty.subject).toBe(
      '[asobeast] Daily app update — 0 changes across 0 apps',
    );

    const completeSection: AlertBatchAppSection = {
      ...alpha,
      rankImprovements: [
        {
          event: 'rank.improved',
          occurredAt: '2026-07-22T10:00:00.000Z',
          app: { id: 'a', name: 'Alpha' },
          keyword: { id: 'k3', text: 'emoji 🚀' },
          from: 20,
          to: 3,
          fromDepth: RANK_DEPTH,
          toDepth: RANK_DEPTH,
          threshold: 5,
        },
      ],
      serpEntrants: bravo.serpEntrants,
      negativeReviews: [
        {
          event: 'review.negative',
          occurredAt: '2026-07-22T10:00:00.000Z',
          app: { id: 'a', name: 'Alpha' },
          review: {
            score: 1,
            title: null,
            text: '<script>alert("bad")</script> '.repeat(10),
            version: null,
            reviewedAt: null,
          },
        },
      ],
    };
    const email = formatBatchEmail({
      ...batch,
      totals: { events: 5, apps: 1 },
      apps: [completeSection],
    });
    const headings = [
      'Rank drops',
      'Rank improvements',
      'New entrants',
      'Metadata changes',
      'Negative reviews',
    ];
    expect(headings.every((heading) => email.text.includes(heading))).toBe(
      true,
    );
    expect(
      headings.every(
        (heading, index) =>
          index === 0 ||
          email.text.indexOf(headings[index - 1]) < email.text.indexOf(heading),
      ),
    ).toBe(true);
    expect(email.text).toContain('emoji 🚀');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<script>');
  });

  it('renders multiple competitor groups with null values and escaped HTML', () => {
    const unsafeSection: AlertBatchAppSection = {
      ...emptySection({
        id: 'unsafe',
        name: '<Primary & Co>',
        store: 'APP_STORE',
        country: 'jp',
      }),
      competitors: [
        {
          app: {
            id: 'null-name',
            name: null,
            store: 'GOOGLE_PLAY',
            country: 'de',
          },
          changes: [
            {
              event: 'metadata.changed',
              occurredAt: '2026-07-22T10:00:00.000Z',
              app: { id: 'null-name', name: null, isCompetitor: true },
              changes: [
                {
                  field: 'description',
                  before: null,
                  after: '<b>新しい 🚀</b>',
                },
              ],
            },
          ],
        },
      ],
    };
    const email = formatBatchEmail({
      ...competitorBatch,
      totals: { events: 2, apps: 2 },
      apps: [competitorAlpha, unsafeSection],
    });

    expect(email.subject).toBe(
      '[asobeast] Competitor watch — 2 changes across 2 competitors',
    );
    expect(email.text).toContain('An app · Google Play · DE');
    expect(email.text).toContain('— → <b>新しい 🚀</b>');
    expect(email.html).toContain('&lt;Primary &amp; Co&gt;');
    expect(email.html).toContain('&lt;b&gt;新しい 🚀&lt;/b&gt;');
  });

  it('reports exact group, competitor and detail omissions', () => {
    const sections = Array.from({ length: 11 }, (_, index) => ({
      ...alpha,
      app: { ...alpha.app, id: `app-${index}`, name: `App ${index}` },
    }));
    const groupLimited = formatBatchEmail({
      ...batch,
      totals: { events: 11, apps: 11 },
      apps: sections,
    });
    expect(groupLimited.text).toContain('+1 more app group');
    expect(groupLimited.text).not.toContain('App 10 ·');

    const manyCompetitors = Array.from({ length: 11 }, (_, index) => ({
      ...competitorAlpha.competitors[0],
      app: {
        ...competitorAlpha.competitors[0].app,
        id: `competitor-${index}`,
        name: `Competitor ${index}`,
      },
    }));
    const detailChanges = Array.from({ length: 21 }, (_, index) => ({
      field: 'description' as const,
      before: `before ${index}`,
      after: `after ${index}`,
    }));
    manyCompetitors[0] = {
      ...manyCompetitors[0],
      changes: [
        {
          ...manyCompetitors[0].changes[0],
          changes: detailChanges,
        },
      ],
    };
    const limited = formatBatchEmail({
      ...competitorBatch,
      totals: { events: 31, apps: 11 },
      apps: [{ ...competitorAlpha, competitors: manyCompetitors }],
    });
    expect(limited.text).toContain('+1 more competitor');
    expect(limited.text).toContain('+1 more detail line');
    expect(limited.text).not.toContain('Competitor 10 ·');
  });

  it('is deterministic and bounds a 1,000-event report', () => {
    const rankDrops = Array.from({ length: 1_000 }, (_, index) => ({
      ...alpha.rankDrops[0],
      keyword: { id: `keyword-${index}`, text: `keyword ${index}` },
    }));
    const large = {
      ...batch,
      totals: { events: 1_000, apps: 1 },
      apps: [{ ...alpha, rankDrops }],
    } satisfies AlertBatchPayload;
    const first = formatBatchEmail(large);
    const second = formatBatchEmail(large);

    expect(second).toEqual(first);
    expect(first.text).toContain('+980 more detail lines');
    expect(first.text.length).toBeLessThan(10_000);
    expect(first.html.length).toBeLessThan(20_000);
    expect(first.text).toContain('Window (UTC):');
    expect(first.html).toContain('Window (UTC):');
  });
});

describe('formatEmail for action.opened', () => {
  it('renders the rule, priority, estimated impact, evidence and link', () => {
    const email = formatEmail(actionOpened);

    expect(email.subject).toContain('keyword.add_uncovered');
    expect(email.text).toContain('Priority: high');
    expect(email.text).toContain('Estimated impact: 71');
    expect(email.text).toContain('opportunity 66.5');
    expect(email.text).toContain('uncovered in title, subtitle, keywordField');
    expect(email.text).toContain(
      'https://aso.example.com/actions?action=act_1',
    );
  });

  it('omits the link row entirely when no public url is configured', () => {
    const email = formatEmail({ ...actionOpened, link: null });

    expect(email.text).not.toContain('Open:');
    expect(email.text).not.toContain('localhost');
  });

  it('never leaks a review body into an email', () => {
    const email = formatEmail({
      ...actionOpened,
      evidence: {
        rule: 'reviews.investigate_theme',
        theme: 'crashes on launch',
        version: '4.2.0',
        previousVersion: '4.1.0',
        mentions: 9,
        previousMentions: 1,
        negativeReviews: 22,
        totalReviews: 61,
        ratingAvgDelta: -0.4,
        sampleReviewIds: ['r1', 'r2'],
      },
    });

    expect(email.text).toContain('"crashes on launch" in 9 of 22');
    expect(email.text).not.toContain('r1');
  });

  it('counts new actions in the batched owned summary', () => {
    const email = formatBatchEmail({
      ...batch,
      totals: { events: 1, apps: 1 },
      apps: [{ ...emptySection(alpha.app), actions: [actionOpened] }],
    });

    expect(email.text).toContain('1 new action');
    expect(email.text).toContain('Actions');
    expect(email.text).toContain('estimated impact 71');
  });
});
