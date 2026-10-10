import {
  AlertBatchAppSection,
  AlertBatchPayload,
  RANK_DEPTH,
} from '@asobeast/shared';
import {
  formatBatchEmail,
  formatEmail,
  HTML_BUDGET_BYTES,
} from './email-format';
import {
  actionOpened,
  alpha,
  batch,
  bravo,
  competitorAlpha,
  competitorBatch,
  emptySection,
  digest,
  digestWithGroups,
  dropped,
  droppedOut,
  improved,
  metadata,
  negative,
  worstCaseBatch,
} from './email-fixtures.fixture';
import {
  firstRanking,
  milestone,
  overtake,
  rankEventSection,
  withoutRankEvents,
} from './rank-events.fixture';

describe('the same phrase in two markets', () => {
  const inMarket = (country: string) => ({
    ...dropped,
    keyword: { ...dropped.keyword, country },
  });

  it('subjects each market distinguishably', async () => {
    expect((await formatEmail(inMarket('us'))).subject).not.toBe(
      (await formatEmail(inMarket('de'))).subject,
    );
  });

  it('names the market in the body', async () => {
    expect((await formatEmail(inMarket('de'))).text).toContain(
      'fitness app (DE)',
    );
  });

  it('renders a queued payload that predates the market scope', async () => {
    const legacy = {
      ...dropped,
      keyword: { id: 'kw_1', text: 'fitness app' },
    } as unknown as typeof dropped;

    expect((await formatEmail(legacy)).subject).toContain('"fitness app"');
  });
});

describe('formatEmail', () => {
  it('subjects a rank drop with bare positions', async () => {
    const email = await formatEmail(dropped);
    expect(email.subject).toBe(
      '[asobeast] Rank drop: "fitness app (US)" 4 → 12',
    );
    expect(email.text).toContain('From: 4');
    expect(email.text).toContain('To: 12');
    expect(email.html).toContain('<table');
  });

  it('renders a drop out using its captured depth', async () => {
    expect((await formatEmail(droppedOut)).subject).toBe(
      '[asobeast] Rank drop: "fitness app (US)" 3 → >100',
    );
  });

  it('subjects a rank improvement', async () => {
    expect((await formatEmail(improved)).subject).toBe(
      '[asobeast] Rank up: "habit tracker (DE)" 20 → 7',
    );
  });

  it('lists the changed fields for a metadata change', async () => {
    const email = await formatEmail(metadata);
    expect(email.subject).toBe('[asobeast] My App changed title, icon');
    expect(email.text).toContain('title: A → B');
    expect(email.text).toContain('icon: — → y');
  });

  it('renders stars and version for a negative review', async () => {
    const email = await formatEmail(negative);
    expect(email.subject).toBe('[asobeast] ★☆☆☆☆ review (v2.0.0) for My App');
    expect(email.text).toContain('Crashes on <launch>');
  });

  it('names a rating only review instead of printing an empty row', async () => {
    const email = await formatEmail({
      ...negative,
      review: { ...negative.review, text: '' },
    });
    expect(email.text).toContain('Review: no written review');
    expect(email.html).toContain('no written review');
  });

  it('escapes html in review content', async () => {
    expect((await formatEmail(negative)).html).toContain(
      'Crashes on &lt;launch&gt;',
    );
  });

  it('caps the weekly digest at ten apps with a more line', async () => {
    const email = await formatEmail(digest);
    expect(email.subject).toBe('[asobeast] Weekly digest: 12 apps');
    expect(email.text).toContain('+2 more');
    expect(email.text).toContain('Window: 2026-07-06 → 2026-07-13');
  });

  it('omits the linked apps section when the digest has no groups', async () => {
    expect((await formatEmail(digest)).text).not.toContain('Linked apps');
  });

  it('appends the audit score and delta to the app line', async () => {
    expect((await formatEmail(digest)).text).toContain('Audit 78 (+3)');
  });

  it('renders linked apps before the per-app lines', async () => {
    const { text } = await formatEmail(digestWithGroups);
    expect(text).toContain('Linked apps');
    expect(text).toContain('Habit: vis 61 (-2.5)');
    expect(text.indexOf('Linked apps')).toBeLessThan(text.indexOf('App 0:'));
  });
});

describe('formatBatchEmail', () => {
  it('counts each category in the subject with plurals', async () => {
    const email = await formatBatchEmail(batch);
    expect(email.subject).toBe(
      '[asobeast] Daily app update — 3 changes across 2 apps',
    );
    expect(email.text).toContain(
      'Summary: 1 rank drop · 0 rank improvements · 1 SERP entrant · 1 metadata change · 0 negative reviews',
    );
  });

  it('uses plural app wording for multiple apps and singular otherwise', async () => {
    const single = await formatBatchEmail({
      ...batch,
      apps: [bravo],
      totals: { events: 1, apps: 1 },
    });
    expect(single.subject).toBe(
      '[asobeast] Daily app update — 1 change across 1 app',
    );
  });

  it('omits empty sections from the rendered card', async () => {
    const email = await formatBatchEmail(batch);
    expect(email.text).toContain('Rank drops');
    expect(email.text).not.toContain('Rank improvements');
    expect(email.text).toContain('New entrants');
  });

  it('nests competitor activity under the primary app', async () => {
    const email = await formatBatchEmail(competitorBatch);
    expect(email.subject).toBe(
      '[asobeast] Competitor watch — 1 change across 1 competitor',
    );
    expect(email.text).toContain('Primary app · Alpha · App Store · US');
    expect(email.text).toContain('Competitor · Charlie · App Store · US');
    expect(email.html).toContain('Competitor · Charlie · App Store · US');
  });

  it('renders queued legacy mixed batches without a scope', async () => {
    const legacy = {
      ...batch,
      totals: { events: 4, apps: 2 },
      apps: [{ ...alpha, competitors: competitorAlpha.competitors }, bravo],
    };
    Reflect.deleteProperty(legacy, 'scope');

    const email = await formatBatchEmail(legacy);

    expect(email.subject).toBe(
      '[asobeast] Daily alert update — 4 changes across 2 apps',
    );
    expect(email.text).toContain('Rank drops');
    expect(email.text).toContain('Competitor · Charlie · App Store · US');
    expect(email.html).toContain('Metadata changes');
  });

  it('truncates long metadata values', async () => {
    const email = await formatBatchEmail(batch);
    expect(email.text).toContain('…');
    expect(email.text).not.toContain('x'.repeat(200));
  });

  it('labels each app with its store and country', async () => {
    const email = await formatBatchEmail(batch);
    expect(email.text).toContain('Alpha · App Store · US');
    expect(email.text).toContain('Bravo · Google Play · GB');
  });

  it('renders zero totals and every owned section in severity order', async () => {
    const empty = await formatBatchEmail({
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
    const email = await formatBatchEmail({
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

  it('renders multiple competitor groups with null values and escaped HTML', async () => {
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
    const email = await formatBatchEmail({
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

  it('reports exact group, competitor and detail omissions', async () => {
    const sections = Array.from({ length: 11 }, (_, index) => ({
      ...alpha,
      app: { ...alpha.app, id: `app-${index}`, name: `App ${index}` },
    }));
    const groupLimited = await formatBatchEmail({
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
    const limited = await formatBatchEmail({
      ...competitorBatch,
      totals: { events: 31, apps: 11 },
      apps: [{ ...competitorAlpha, competitors: manyCompetitors }],
    });
    expect(limited.text).toContain('+1 more competitor');
    expect(limited.text).toContain('+1 more detail line');
    expect(limited.text).not.toContain('Competitor 10 ·');
  });

  it('is deterministic and bounds a 1,000-event report', async () => {
    const rankDrops = Array.from({ length: 1_000 }, (_, index) => ({
      ...alpha.rankDrops[0],
      keyword: { id: `keyword-${index}`, text: `keyword ${index}` },
    }));
    const large = {
      ...batch,
      totals: { events: 1_000, apps: 1 },
      apps: [{ ...alpha, rankDrops }],
    } satisfies AlertBatchPayload;
    const first = await formatBatchEmail(large);
    const second = await formatBatchEmail(large);

    expect(second).toEqual(first);
    expect(first.text).toContain('+980 more detail lines');
    expect(first.text.length).toBeLessThan(10_000);
    expect(first.html.length).toBeLessThan(20_000);
    expect(first.text).toContain('Window (UTC):');
    expect(first.html).toContain('Window (UTC):');
  });
});

describe('formatEmail for action.opened', () => {
  it('renders the rule, priority, estimated impact, evidence and link', async () => {
    const email = await formatEmail(actionOpened);

    expect(email.subject).toContain('keyword.add_uncovered');
    expect(email.text).toContain('Priority: high');
    expect(email.text).toContain('Estimated impact: 71');
    expect(email.text).toContain('opportunity 66.5');
    expect(email.text).toContain('uncovered in title, subtitle, keywordField');
    expect(email.text).toContain(
      'https://aso.example.com/actions?action=act_1',
    );
  });

  it('omits the link row entirely when no public url is configured', async () => {
    const email = await formatEmail({ ...actionOpened, link: null });

    expect(email.text).not.toContain('Open:');
    expect(email.text).not.toContain('localhost');
  });

  it('never leaks a review body into an email', async () => {
    const email = await formatEmail({
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

  it('counts new actions in the batched owned summary', async () => {
    const email = await formatBatchEmail({
      ...batch,
      totals: { events: 1, apps: 1 },
      apps: [{ ...emptySection(alpha.app), actions: [actionOpened] }],
    });

    expect(email.text).toContain('1 new action');
    expect(email.text).toContain('Actions');
    expect(email.text).toContain('estimated impact 71');
  });
});

describe('formatEmail for the new rank events', () => {
  it('subjects a milestone and lists its move', async () => {
    const email = await formatEmail(milestone());

    expect(email.subject).toBe(
      '[asobeast] My App entered the top 10 for "habit tracker (US)": #14 → #8',
    );
    expect(email.text).toContain('Milestone: entered the top 10');
    expect(email.text).toContain('From: 14');
    expect(email.text).toContain('To: 8');
  });

  it('lists the position of a first ranking and both moves of an overtake', async () => {
    expect((await formatEmail(firstRanking())).text).toContain('Position: 37');
    const email = await formatEmail(overtake());
    expect(email.text).toContain('Competitor: Rival Focus');
    expect(email.text).toContain('Competitor position: 9 → 4');
    expect(email.text).toContain('App position: 5 → 6');
  });
});

describe('formatBatchEmail for the new rank events', () => {
  const rankBatch = (section: AlertBatchAppSection): AlertBatchPayload => ({
    ...batch,
    totals: { events: 3, apps: 1 },
    apps: [section],
  });

  it('counts and lists the new blocks and escapes a competitor name', async () => {
    const section = rankEventSection();
    const email = await formatBatchEmail(
      rankBatch({
        ...section,
        overtakes: [
          overtake({
            competitor: { id: 'r', name: '<Rival & Co>', from: 9, to: 4 },
          }),
        ],
      }),
    );

    expect(email.text).toContain(
      '· 0 new actions · 1 milestone · 1 first ranking · 1 overtake',
    );
    for (const title of [
      'Milestones',
      'First rankings',
      'Overtaken by competitors',
    ]) {
      expect(email.text).toContain(title);
      expect(email.html).toContain(title);
    }
    expect(email.html).toContain('&lt;Rival &amp; Co&gt;');
    expect(email.html).not.toContain('<Rival & Co>');
  });

  it('counts zero for a section queued before the new arrays existed', async () => {
    const email = await formatBatchEmail(
      rankBatch(withoutRankEvents(rankEventSection())),
    );

    expect(email.text).toContain(
      '0 milestones · 0 first rankings · 0 overtakes',
    );
  });
});

describe('formatEmail in the branded layout', () => {
  const linked = { origin: 'https://aso.example.com', unsubscribe: null };

  it('links an app event back to its app and to the alert settings', async () => {
    const { html } = await formatEmail(dropped, linked);
    expect(html).toContain('href="https://aso.example.com/apps/app_1"');
    expect(html).toContain('Open in AsoBeast');
    expect(html).toContain(
      'href="https://aso.example.com/settings#email-alerts"',
    );
    expect(html).toContain('Manage email alerts');
  });

  it('never links relatively without a web origin', async () => {
    const { html } = await formatEmail(dropped);
    expect(html).not.toMatch(/href="\//);
    expect(html).not.toContain('Manage email alerts');
  });

  it('turns the action link into the button and keeps it in the text', async () => {
    const { html, text } = await formatEmail(actionOpened, linked);
    expect(html).toContain(
      'href="https://aso.example.com/actions?action=act_1"',
    );
    expect(html).toContain('Open the action');
    expect(html).not.toMatch(/>Open<\/td>/);
    expect(text).toContain(
      'Open: https://aso.example.com/actions?action=act_1',
    );
  });

  it('renders no button for an event that names no app', async () => {
    const { html } = await formatEmail(
      {
        event: 'serp.entrant',
        occurredAt: '2026-07-22T10:00:00.000Z',
        keyword: { id: 'k2', text: 'planner' },
        date: '2026-07-22',
        entrants: [],
      },
      linked,
    );
    expect(html).not.toContain('Button not working?');
  });

  it('opens the portfolio from the weekly digest', async () => {
    const { html } = await formatEmail(digestWithGroups, linked);
    expect(html).toContain('href="https://aso.example.com/"');
    expect(html).toContain('Open the portfolio');
    expect(html.indexOf('Linked apps')).toBeLessThan(html.indexOf('App 0'));
  });

  it('escapes quotes in review text in html only', async () => {
    const { html, text } = await formatEmail({
      ...negative,
      review: { ...negative.review, text: `It's "broken"` },
    });
    expect(html).toContain('It&#x27;s &quot;broken&quot;');
    expect(text).toContain(`It's "broken"`);
  });
});

describe('formatBatchEmail in the branded layout', () => {
  const linked = { origin: 'https://aso.example.com', unsubscribe: null };

  it.each([['owned_apps'], ['competitors'], [null]] as const)(
    'keeps the largest %s report and its footer under the clipping threshold',
    async (scope) => {
      const { html } = await formatBatchEmail(worstCaseBatch(scope), linked);
      expect(Buffer.byteLength(html)).toBeLessThan(HTML_BUDGET_BYTES);
      expect(html).toContain('subscribes to AsoBeast email alerts');
    },
  );

  it('shows fewer lines in html than in text only when the report would not fit', async () => {
    const worst = await formatBatchEmail(worstCaseBatch('owned_apps'), linked);
    expect(worst.text).toContain('+5 more detail lines');
    expect(worst.html).not.toContain('+5 more detail lines');
    expect(worst.html).toMatch(/\+\d+ more detail lines/);

    const usual = await formatBatchEmail(batch, linked);
    const rankDrops = Array.from({ length: 25 }, (_, index) => ({
      ...alpha.rankDrops[0],
      keyword: { ...dropped.keyword, id: `k${index}`, text: `game ${index}` },
    }));
    const full = await formatBatchEmail(
      { ...batch, apps: [{ ...alpha, rankDrops }] },
      linked,
    );
    expect(usual.html).not.toContain('more detail lines');
    expect(full.html).toContain('+5 more detail lines');
  });

  it('links every owned card to its app and the button to the web app', async () => {
    const { html } = await formatBatchEmail(batch, linked);
    for (const id of ['a', 'b']) {
      expect(html).toMatch(
        new RegExp(
          `· <a href="https://aso\\.example\\.com/apps/${id}"[^>]*>Open app</a>`,
        ),
      );
    }
    expect(html).toContain('href="https://aso.example.com/"');
    expect(html).toContain('Open AsoBeast');
  });

  it('counts only the categories the report holds', async () => {
    const { html } = await formatBatchEmail(batch, linked);
    expect(html).toMatch(/>1<\/p><p[^>]*>Rank drops<\/p>/);
    expect(html).not.toMatch(/>Rank improvements</);
  });

  it('never links relatively without a web origin', async () => {
    for (const payload of [batch, competitorBatch]) {
      const { html } = await formatBatchEmail(payload);
      expect(html).not.toMatch(/href="\//);
      expect(html).not.toContain('Open app');
    }
  });

  it('puts the unsubscribe link next to the settings link', async () => {
    const page = 'https://aso.example.com/unsubscribe?alert=ea_1&token=t';
    const { html } = await formatBatchEmail(batch, {
      origin: 'https://aso.example.com',
      unsubscribe: page,
    });
    expect(html).toMatch(
      /Manage email alerts<\/a> · <a href="https:\/\/aso\.example\.com\/unsubscribe\?alert=ea_1&amp;token=t"[^>]*>Unsubscribe<\/a>/,
    );
  });
});

describe('the plain text part of an alert email', () => {
  const page = 'https://aso.example.com/unsubscribe?alert=ea_1&token=t';
  const context = { origin: 'https://aso.example.com', unsubscribe: page };

  it.each([
    ['an instant alert', () => formatEmail(dropped, context)],
    ['a daily update', () => formatBatchEmail(batch, context)],
    ['a competitor watch', () => formatBatchEmail(competitorBatch, context)],
  ])('says why %s was sent and how to stop it', async (_kind, render) => {
    const { text } = await render();
    expect(text).toContain(
      'You received this because this address subscribes to AsoBeast email alerts at aso.example.com.',
    );
    expect(text).toContain(
      'Manage email alerts: https://aso.example.com/settings#email-alerts',
    );
    expect(text.split(`Unsubscribe: ${page}`).length - 1).toBe(1);
  });

  it('names no link without a web origin', async () => {
    const { text } = await formatEmail(dropped);
    expect(text).toContain(
      'You received this because this address subscribes to AsoBeast email alerts.',
    );
    expect(text).not.toContain('Unsubscribe:');
    expect(text).not.toContain('Manage email alerts:');
  });
});
