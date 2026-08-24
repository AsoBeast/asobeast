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
import { formatWebhookBody, renderMessage } from './webhook-format';

function discordEmbedSize(body: string): number {
  const parsed = JSON.parse(body) as {
    embeds: Array<{
      title?: string;
      description?: string;
      fields?: Array<{ name: string; value: string }>;
    }>;
  };
  const embed = parsed.embeds[0];
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.fields ?? []).reduce(
      (total, field) => total + field.name.length + field.value.length,
      0,
    )
  );
}

const metadata: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App', isCompetitor: false },
  changes: [
    { field: 'title', before: 'A', after: 'B' },
    { field: 'icon', before: 'x', after: 'y' },
  ],
};

const dropped: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: { id: 'kw_1', text: 'habit tracker' },
  from: 3,
  to: null,
  fromDepth: 100,
  toDepth: 100,
  threshold: 5,
};

const improved: RankImprovedPayload = {
  event: 'rank.improved',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: { id: 'kw_1', text: 'habit tracker' },
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
    text: 'Crashes on launch',
    version: '2.0.0',
    reviewedAt: '2026-07-10T00:00:00.000Z',
  },
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
    indexedFields: ['title'],
    uncoveredFields: ['title'],
    keywordFieldCharsFree: null,
    scoreProvenance: null,
  },
  link: null,
};

describe('renderMessage', () => {
  it('summarizes a metadata change with the changed fields', () => {
    expect(renderMessage(metadata)).toBe('📝 My App changed: title, icon');
  });

  it('marks competitor metadata changes', () => {
    expect(
      renderMessage({
        ...metadata,
        app: { ...metadata.app, isCompetitor: true },
      }),
    ).toBe('📝 My App (competitor) changed: title, icon');
  });

  it('describes a drop out against the depth the payload carries', () => {
    expect(renderMessage(dropped)).toBe(
      '📉 My App dropped for "habit tracker": #3 → outside top 100',
    );
  });

  it('describes an improvement', () => {
    expect(renderMessage(improved)).toBe(
      '📈 My App improved for "habit tracker": #20 → #7',
    );
  });

  it('describes a negative review with stars and version', () => {
    expect(renderMessage(negative)).toBe(
      '⚠️ My App got a ★☆☆☆☆ review (v2.0.0): "Crashes on launch"',
    );
  });
});

const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-07-13T08:00:00.000Z',
  window: { from: '2026-07-06', to: '2026-07-13' },
  apps: Array.from({ length: 12 }, (_, i) => ({
    id: `app_${i}`,
    name: `App ${i}`,
    visibility: { current: 40 + i, delta7d: i % 2 === 0 ? 2.5 : null },
    moversUp: [
      {
        keywordId: `k${i}`,
        text: `up ${i}`,
        from: 20,
        fromDepth: RANK_DEPTH,
        to: 4,
        toDepth: RANK_DEPTH,
      },
    ],
    moversDown: [
      {
        keywordId: `d${i}`,
        text: `down ${i}`,
        from: 5,
        fromDepth: RANK_DEPTH,
        to: 12,
        toDepth: RANK_DEPTH,
      },
    ],
    changes: i,
    negativeReviews: 1,
    audit: null,
  })),
  groups: [],
};

describe('formatWebhookBody', () => {
  it('wraps the message in a content field for discord', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      metadata,
    );
    expect(JSON.parse(body)).toEqual({ content: renderMessage(metadata) });
  });

  it('wraps the message in a text field for slack', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      metadata,
    );
    expect(JSON.parse(body)).toEqual({ text: renderMessage(metadata) });
  });

  it('sends the raw payload for generic receivers', () => {
    const body = formatWebhookBody('https://hooks.example.com/x', metadata);
    expect(JSON.parse(body)).toEqual(metadata);
  });

  it('formats a negative review for discord', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      negative,
    );
    expect(JSON.parse(body)).toEqual({ content: renderMessage(negative) });
  });

  it('formats a negative review for slack', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      negative,
    );
    expect(JSON.parse(body)).toEqual({ text: renderMessage(negative) });
  });

  it('builds a discord embed truncated to the top 10 apps', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      digest,
    );
    const parsed = JSON.parse(body) as {
      embeds: { title: string; description: string }[];
    };
    const lines = parsed.embeds[0].description.split('\n');

    expect(parsed.embeds).toHaveLength(1);
    expect(parsed.embeds[0].title).toContain('2026-07-06 → 2026-07-13');
    expect(lines).toHaveLength(11);
    expect(lines[lines.length - 1]).toBe('+2 more');
    expect(lines[0]).toContain('App 0 — vis 40 (+2.5)');
    expect(lines[1]).toContain('App 1 — vis 41 (—)');
    expect(discordEmbedSize(body)).toBeLessThanOrEqual(6000);
  });

  it('builds slack blocks truncated to the top 10 apps', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      digest,
    );
    const parsed = JSON.parse(body) as {
      blocks: Array<{ type: string; text: { text: string } }>;
    };
    const section = parsed.blocks.find((block) => block.type === 'section')!;
    const lines = section.text.text.split('\n');

    expect(parsed.blocks[0].type).toBe('header');
    expect(lines).toHaveLength(11);
    expect(lines[lines.length - 1]).toBe('+2 more');
  });

  it('sends the raw digest payload for generic receivers', () => {
    const body = formatWebhookBody('https://hooks.example.com/x', digest);
    expect(JSON.parse(body)).toEqual(digest);
  });

  const alphaSection: AlertBatchAppSection = {
    app: { id: 'a', name: 'Alpha', store: 'APP_STORE', country: 'us' },
    rankDrops: [
      {
        event: 'rank.dropped',
        occurredAt: '2026-07-22T10:00:00.000Z',
        app: { id: 'a', name: 'Alpha' },
        keyword: { id: 'k1', text: 'habit tracker' },
        from: 3,
        to: null,
        fromDepth: RANK_DEPTH,
        toDepth: RANK_DEPTH,
        threshold: 5,
      },
    ],
    rankImprovements: [],
    serpEntrants: [],
    changes: [
      {
        event: 'metadata.changed',
        occurredAt: '2026-07-22T10:00:00.000Z',
        app: { id: 'a', name: 'Alpha', isCompetitor: false },
        changes: [{ field: 'title', before: 'Old', after: 'New' }],
      },
    ],
    negativeReviews: [],
    actions: [],
    competitors: [],
  };

  const competitorSection: AlertBatchAppSection = {
    app: alphaSection.app,
    rankDrops: [],
    rankImprovements: [],
    serpEntrants: [],
    changes: [],
    negativeReviews: [],
    actions: [],
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

  const bravoSection: AlertBatchAppSection = {
    app: { id: 'b', name: 'Bravo', store: 'GOOGLE_PLAY', country: 'de' },
    rankDrops: [],
    rankImprovements: [
      {
        event: 'rank.improved',
        occurredAt: '2026-07-22T10:00:00.000Z',
        app: { id: 'b', name: 'Bravo' },
        keyword: { id: 'k2', text: 'fitness' },
        from: 20,
        to: 7,
        fromDepth: RANK_DEPTH,
        toDepth: RANK_DEPTH,
        threshold: 5,
      },
    ],
    serpEntrants: [],
    changes: [],
    negativeReviews: [],
    actions: [],
    competitors: [],
  };

  const batch: AlertBatchPayload = {
    event: 'alerts.batch',
    scope: 'owned_apps',
    occurredAt: '2026-07-22T11:00:00.000Z',
    window: {
      from: '2026-07-22T09:00:00.000Z',
      to: '2026-07-22T11:00:00.000Z',
    },
    totals: { events: 3, apps: 2 },
    apps: [alphaSection, bravoSection],
    events: [],
  };

  const competitorBatch: AlertBatchPayload = {
    ...batch,
    scope: 'competitors',
    totals: { events: 1, apps: 1 },
    apps: [competitorSection],
  };

  const emptyBatch: AlertBatchPayload = {
    ...batch,
    totals: { events: 0, apps: 0 },
    apps: [],
  };

  it('renders a discord embed with per-app detail fields', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      batch,
    );
    const parsed = JSON.parse(body) as {
      allowed_mentions: { parse: string[] };
      embeds: {
        title: string;
        description: string;
        fields: { name: string; value: string }[];
      }[];
    };
    const [embed] = parsed.embeds;

    expect(parsed.allowed_mentions).toEqual({ parse: [] });
    expect(embed.title).toBe('📊 Daily app update · 3 changes across 2 apps');
    expect(embed.description).toContain('2026\\-07\\-22T09:00:00\\.000Z');
    expect(embed.fields).toHaveLength(2);
    expect(embed.fields[0].name).toBe('Alpha · App Store · US');
    expect(embed.fields[0].value).toContain('habit tracker  3 → \\>200 ▼');
    expect(embed.fields[0].value).toContain('title: Old → New');
    expect(embed.fields[1].name).toBe('Bravo · Google Play · DE');
    expect(embed.fields[1].value).toContain('fitness  20 → 7 ▲');
    expect(discordEmbedSize(body)).toBeLessThanOrEqual(6000);
  });

  it('renders slack blocks with per-app detail sections', () => {
    const body = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      batch,
    );
    const parsed = JSON.parse(body) as {
      blocks: Array<{ type: string; text?: { text: string } }>;
    };
    const sections = parsed.blocks.filter((block) => block.type === 'section');

    expect(parsed.blocks[0].type).toBe('header');
    expect(parsed.blocks[0].text!.text).toBe(
      '📊 Daily app update · 3 changes across 2 apps',
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].text!.text).toContain('*Alpha · App Store · US*');
    expect(sections[0].text!.text).toContain('habit tracker  3 → &gt;200 ▼');
    expect(sections[1].text!.text).toContain('fitness  20 → 7 ▲');
  });

  it('renders competitor scope without owned signals', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      competitorBatch,
    );

    const parsed = JSON.parse(body) as {
      allowed_mentions: { parse: string[] };
      embeds: { title: string; fields: { name: string; value: string }[] }[];
    };

    expect(parsed.allowed_mentions).toEqual({ parse: [] });
    expect(parsed.embeds[0].title).toBe(
      '🔭 Competitor watch · 1 change across 1 competitor',
    );
    expect(parsed.embeds[0].fields[0].name).toBe(
      'Primary app · Alpha · App Store · US',
    );
    expect(parsed.embeds[0].fields[0].value).toContain(
      'Competitor · Charlie · App Store · US',
    );
    expect(body).toContain('subtitle: a → b');
    expect(body).not.toContain('habit tracker');
  });

  it('renders queued legacy mixed batches without a scope', () => {
    const legacy = {
      ...batch,
      totals: { events: 4, apps: 2 },
      apps: [
        { ...alphaSection, competitors: competitorSection.competitors },
        bravoSection,
      ],
    };
    Reflect.deleteProperty(legacy, 'scope');

    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      legacy,
    );
    const parsed = JSON.parse(body) as {
      embeds: { title: string; fields: { value: string }[] }[];
    };

    expect(renderMessage(legacy)).toBe(
      '📊 Daily alert update · 4 changes across 2 apps',
    );
    expect(parsed.embeds[0].title).toBe(
      '📊 Daily alert update · 4 changes across 2 apps',
    );
    expect(parsed.embeds[0].fields[0].value).toContain('Rank drops');
    expect(parsed.embeds[0].fields[0].value).toContain(
      'Competitor · Charlie · App Store · US',
    );
  });

  it('caps the discord embed at ten apps with a more note', () => {
    const many: AlertBatchPayload = {
      ...batch,
      totals: { events: 12, apps: 12 },
      apps: Array.from({ length: 12 }, (_, i) => ({
        ...bravoSection,
        app: {
          id: `app_${i}`,
          name: `App ${i}`,
          store: 'GOOGLE_PLAY' as const,
          country: 'us',
        },
      })),
    };
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      many,
    );
    const parsed = JSON.parse(body) as {
      embeds: { fields: { name: string; value: string }[] }[];
    };
    const fields = parsed.embeds[0].fields;

    expect(fields[fields.length - 1].value).toBe('+2 more app groups');
    expect(discordEmbedSize(body)).toBeLessThanOrEqual(6000);
  });

  it('renders an empty batch without app fields', () => {
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      emptyBatch,
    );
    const parsed = JSON.parse(body) as {
      embeds: { title: string; fields: unknown[] }[];
    };

    expect(parsed.embeds[0].title).toBe(
      '📊 Daily app update · 0 changes across 0 apps',
    );
    expect(parsed.embeds[0].fields).toHaveLength(0);
  });

  it('escapes platform formatting and suppresses Discord mentions', () => {
    const unsafeSection: AlertBatchAppSection = {
      ...alphaSection,
      app: {
        ...alphaSection.app,
        name: 'A & <tag> _under_ *star* `code` @here',
      },
      rankDrops: [
        {
          ...alphaSection.rankDrops[0],
          keyword: {
            id: 'unsafe',
            text: '[link](https://example.com) <@123> @everyone #channel',
          },
        },
      ],
      changes: [],
    };
    const unsafe = {
      ...batch,
      totals: { events: 1, apps: 1 },
      apps: [unsafeSection],
    } satisfies AlertBatchPayload;

    const discord = JSON.parse(
      formatWebhookBody('https://discord.com/api/webhooks/123/abc', unsafe),
    ) as {
      allowed_mentions: { parse: string[] };
      embeds: { fields: { name: string; value: string }[] }[];
    };
    expect(discord.allowed_mentions).toEqual({ parse: [] });
    expect(discord.embeds[0].fields[0].name).toContain('\\_under\\_');
    expect(discord.embeds[0].fields[0].name).toContain('\\@here');
    expect(discord.embeds[0].fields[0].value).toContain(
      '\\[link\\]\\(https://example\\.com\\)',
    );
    expect(discord.embeds[0].fields[0].value).toContain('\\<\\@123\\>');
    expect(discord.embeds[0].fields[0].value).toContain('\\@everyone');

    const slack = JSON.parse(
      formatWebhookBody('https://hooks.slack.com/services/T/B/x', unsafe),
    ) as { blocks: Array<{ type: string; text?: { text: string } }> };
    const section = slack.blocks.find((block) => block.type === 'section');
    expect(section?.text?.text).toContain('A &amp; &lt;tag&gt;');
    expect(section?.text?.text).toContain('\\_under\\_');
    expect(section?.text?.text).toContain('&lt;@123&gt;');
    expect(section?.text?.text).toContain('\\`code\\`');
  });

  it('handles null and Unicode competitor names without empty content', () => {
    const unicode = {
      ...competitorBatch,
      apps: [
        {
          ...competitorSection,
          app: { ...competitorSection.app, name: null },
          competitors: [
            {
              ...competitorSection.competitors[0],
              app: {
                ...competitorSection.competitors[0].app,
                name: '競合 🚀',
              },
            },
          ],
        },
      ],
    } satisfies AlertBatchPayload;
    const discord = JSON.parse(
      formatWebhookBody('https://discord.com/api/webhooks/123/abc', unicode),
    ) as { embeds: { fields: { name: string; value: string }[] }[] };
    expect(discord.embeds[0].fields[0].name).toContain('An app');
    expect(discord.embeds[0].fields[0].value).toContain('競合 🚀');
    expect(
      discord.embeds[0].fields.every((field) => field.value.length > 0),
    ).toBe(true);

    const slack = JSON.parse(
      formatWebhookBody('https://hooks.slack.com/services/T/B/x', emptyBatch),
    ) as { blocks: Array<{ type: string }> };
    expect(slack.blocks.map((block) => block.type)).toEqual([
      'header',
      'context',
    ]);
  });

  it('reports exact line and total-size omissions', () => {
    const longDrops = Array.from({ length: 40 }, (_, index) => ({
      ...alphaSection.rankDrops[0],
      keyword: {
        id: `long-${index}`,
        text: `${index}-${'very-long-keyword'.repeat(20)}`,
      },
    }));
    const oversizedSection = { ...alphaSection, rankDrops: longDrops };
    const oversized = {
      ...batch,
      totals: { events: 440, apps: 11 },
      apps: Array.from({ length: 11 }, (_, index) => ({
        ...oversizedSection,
        app: {
          ...oversizedSection.app,
          id: `oversized-${index}`,
          name: `${index}-${'oversized-name'.repeat(30)}`,
        },
      })),
    } satisfies AlertBatchPayload;
    const body = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      oversized,
    );
    const parsed = JSON.parse(body) as {
      embeds: { fields: { name: string; value: string }[] }[];
    };
    const fields = parsed.embeds[0].fields;

    expect(fields.some((field) => /\+\d+ more lines/.test(field.value))).toBe(
      true,
    );
    expect(fields[fields.length - 1].value).toMatch(/^\+\d+ more app groups$/);
    expect(
      fields.slice(0, -1).every((field) => field.value.length <= 1_000),
    ).toBe(true);
    expect(discordEmbedSize(body)).toBeLessThanOrEqual(6_000);
  });

  it('serializes deterministically and bounds 1,000-event platform bodies', () => {
    const rankDrops = Array.from({ length: 1_000 }, (_, index) => ({
      ...alphaSection.rankDrops[0],
      keyword: { id: `keyword-${index}`, text: `keyword_${index}` },
    }));
    const large = {
      ...batch,
      totals: { events: 1_000, apps: 1 },
      apps: [{ ...alphaSection, rankDrops }],
    } satisfies AlertBatchPayload;
    const discord = formatWebhookBody(
      'https://discord.com/api/webhooks/123/abc',
      large,
    );
    const slack = formatWebhookBody(
      'https://hooks.slack.com/services/T/B/x',
      large,
    );

    expect(
      formatWebhookBody('https://discord.com/api/webhooks/123/abc', large),
    ).toBe(discord);
    expect(discordEmbedSize(discord)).toBeLessThanOrEqual(6_000);
    expect(slack.length).toBeLessThan(40_000);
    expect(discord).toContain('more lines');
    expect(slack).toContain('more lines');
  });

  it('sends the raw batch payload for generic receivers', () => {
    const body = formatWebhookBody('https://hooks.example.com/x', batch);
    expect(JSON.parse(body)).toEqual(batch);
    expect(body).toBe(JSON.stringify(batch));
  });
});

describe('formatWebhookBody for action.opened', () => {
  it('posts the typed payload unmodified to a plain webhook', () => {
    const body = JSON.parse(
      formatWebhookBody('https://hooks.example.com/x', actionOpened),
    ) as ActionOpenedPayload;

    expect(body).toEqual(actionOpened);
    expect(body.evidence.rule).toBe('keyword.add_uncovered');
  });

  it('renders a readable line for Discord and Slack', () => {
    const discord = JSON.parse(
      formatWebhookBody('https://discord.com/api/webhooks/1/x', actionOpened),
    ) as { content: string };
    const slack = JSON.parse(
      formatWebhookBody('https://hooks.slack.com/services/x', actionOpened),
    ) as { text: string };

    expect(discord.content).toContain('keyword.add_uncovered');
    expect(discord.content).toContain('estimated impact 71');
    expect(slack.text).toContain('[high]');
  });
});
