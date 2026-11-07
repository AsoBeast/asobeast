import type { AlertPayload } from '@asobeast/shared';
import {
  actionOpened,
  alpha,
  batch,
  competitorBatch,
  digest,
  dropped,
  metadata,
  negative,
} from './email-fixtures.fixture';
import {
  chartEntered,
  chartLeft,
  chartMilestone,
} from './chart-events.fixture';
import {
  appDelisted,
  appUnlistedMarket,
  listingBatch,
  listingSection,
  ratingDropped,
  reviewSpike,
  rival,
} from './listing-events.fixture';
import { firstRanking, milestone, overtake } from './rank-events.fixture';
import { formatWebhookBody } from './webhook-format';

const ORIGIN = 'https://aso.example.com';
const DISCORD = 'https://discord.com/api/webhooks/123/abc';
const SLACK = 'https://hooks.slack.com/services/T1/B2/x';

const everyPayload: AlertPayload[] = [
  metadata,
  dropped,
  negative,
  digest,
  actionOpened,
  milestone(),
  firstRanking(),
  overtake(),
  chartEntered(),
  chartLeft(),
  chartMilestone(),
  ratingDropped(),
  reviewSpike(),
  appDelisted(),
  appUnlistedMarket(),
  listingBatch(
    listingSection({ availability: [appDelisted(), appUnlistedMarket()] }),
    [appDelisted(), appUnlistedMarket()],
  ),
  listingBatch(
    listingSection({
      ratingDrops: [ratingDropped()],
      reviewSpikes: [reviewSpike()],
    }),
    [ratingDropped(), reviewSpike()],
  ),
  batch,
  competitorBatch,
];

describe('formatWebhookBody', () => {
  it.each([
    [
      'https://prod-21.westeurope.logic.azure.com/workflows/a/triggers/manual/paths/invoke?sig=x',
      'attachments',
    ],
    ['https://api.telegram.org/bot1:A/sendMessage?chat_id=-100', 'chat_id'],
    [
      'https://chat.googleapis.com/v1/spaces/S/messages?key=k&token=t',
      'cardsV2',
    ],
  ])('sends %s its own body for every event', (url, key) => {
    for (const payload of everyPayload) {
      const body = JSON.parse(
        formatWebhookBody(url, payload, ORIGIN),
      ) as Record<string, unknown>;

      expect(body).toHaveProperty(key);
    }
  });

  it('posts a telegram report to the chat its url names', () => {
    const body = JSON.parse(
      formatWebhookBody(
        'https://api.telegram.org/bot1:A/sendMessage?chat_id=-100',
        batch,
        ORIGIN,
      ),
    ) as { chat_id: string; parse_mode: string };

    expect(body).toMatchObject({ chat_id: '-100', parse_mode: 'HTML' });
  });

  it.each([
    'https://hooks.example.com/x',
    'https://hooks.zapier.com/hooks/catch/1/2/',
    'https://hooks.slack.com/workflows/T1/A2/3/x',
    'https://discord.com/channels/1/2',
    'https://n8n.example.com/webhook/asobeast',
  ])('sends %s the raw payload byte for byte', (url) => {
    for (const payload of everyPayload) {
      expect(formatWebhookBody(url, payload, ORIGIN)).toBe(
        JSON.stringify(payload),
      );
    }
  });

  it('sends a discord url embeds for every event', () => {
    for (const payload of everyPayload) {
      const body = JSON.parse(formatWebhookBody(DISCORD, payload, ORIGIN)) as {
        content: string;
        embeds: unknown[];
        allowed_mentions: unknown;
      };

      expect(body.content.length).toBeGreaterThan(0);
      expect(Array.isArray(body.embeds)).toBe(true);
      expect(body.allowed_mentions).toEqual({ parse: [] });
    }
  });

  it('sends a slack url block kit for every event', () => {
    for (const payload of everyPayload) {
      const body = JSON.parse(formatWebhookBody(SLACK, payload, ORIGIN)) as {
        text: string;
        blocks: Array<{ type: string }>;
      };

      expect(body.text.length).toBeGreaterThan(0);
      expect(body.blocks[0].type).toBe('header');
    }
  });

  it('links a chat report to the web app only when it has an origin', () => {
    expect(formatWebhookBody(SLACK, batch, ORIGIN)).toContain(
      `${ORIGIN}/apps/a`,
    );
    expect(formatWebhookBody(SLACK, batch, null)).not.toContain('http');
    expect(formatWebhookBody(DISCORD, dropped, null)).not.toContain('"url"');
  });

  it('keeps a link in a store name from rendering in a single alert', () => {
    const linked = {
      ...metadata,
      app: {
        ...metadata.app,
        name: '[x](https://e.example) <https://e.example|y>',
      },
    };
    const discord = formatWebhookBody(DISCORD, linked, ORIGIN);
    const slack = JSON.parse(formatWebhookBody(SLACK, linked, ORIGIN)) as {
      text: string;
      blocks: Array<{ type: string; text?: { type: string; text: string } }>;
    };
    const mrkdwn = [
      slack.text,
      ...slack.blocks
        .filter((block) => block.text?.type === 'mrkdwn')
        .map((block) => block.text?.text ?? ''),
    ];

    expect(discord).not.toContain('[x](https://e.example)');
    for (const text of mrkdwn) {
      expect(text).not.toContain('<https://e.example|y>');
    }
  });

  it('serializes a body deterministically', () => {
    expect(formatWebhookBody(DISCORD, batch, ORIGIN)).toBe(
      formatWebhookBody(DISCORD, batch, ORIGIN),
    );
  });
});

describe('formatWebhookBody for the rating and review events', () => {
  const CHAT_URLS = [
    DISCORD,
    SLACK,
    'https://prod-21.westeurope.logic.azure.com/workflows/a/triggers/manual/paths/invoke?sig=x',
    'https://api.telegram.org/bot1:A/sendMessage?chat_id=-100',
    'https://chat.googleapis.com/v1/spaces/S/messages?key=k&token=t',
  ];
  const single = [
    [ratingDropped(), 'average rating fell from 4.66 to 4.44', '4.44'],
    [reviewSpike(), 'A spike of 34 reviews for My App', '34'],
    [appDelisted(), 'is no longer listed in the App Store', '3 Nov 2026'],
    [appUnlistedMarket(), 'where 12 keywords are tracked', '12'],
    [
      appUnlistedMarket({ app: rival }),
      'a competitor, is no longer listed in the App Store in 🇩🇪 DE, where 12 keywords are tracked',
      '12',
    ],
  ] as const;
  const batched = listingBatch(
    listingSection({
      ratingDrops: [ratingDropped()],
      reviewSpikes: [reviewSpike()],
    }),
    [ratingDropped(), reviewSpike()],
  );

  it.each(CHAT_URLS)('words both alone and in a report for %s', (url) => {
    for (const [payload, headline, value] of single) {
      const body = formatWebhookBody(url, payload, ORIGIN);

      expect(() => JSON.parse(body) as unknown).not.toThrow();
      expect(body).toContain(headline.replaceAll("'", ''));
      expect(body).toContain(value);
    }
    const report = formatWebhookBody(url, batched, ORIGIN);
    expect(report).toContain('Rating drops');
    expect(report).toContain('Review spikes');
    expect(report).toContain('4.44');
  });

  it('sends the generic hook the payload itself', () => {
    for (const payload of [ratingDropped(), reviewSpike(), batched]) {
      expect(
        formatWebhookBody('https://hooks.example.com/x', payload, ORIGIN),
      ).toBe(JSON.stringify(payload));
    }
  });
});

describe('formatWebhookBody for a report of many moves', () => {
  const rankDrops = Array.from({ length: 28 }, (_, index) => ({
    ...alpha.rankDrops[0],
    keyword: {
      ...alpha.rankDrops[0].keyword,
      id: `m${index}`,
      text: `move ${index}`,
    },
  }));
  const many = { ...batch, apps: [{ ...alpha, rankDrops }] };

  it.each([
    DISCORD,
    SLACK,
    'https://prod-21.westeurope.logic.azure.com/workflows/a/triggers/manual/paths/invoke?sig=x',
    'https://api.telegram.org/bot1:A/sendMessage?chat_id=-100',
    'https://chat.googleapis.com/v1/spaces/S/messages?key=k&token=t',
  ])('lists five moves and counts the rest for %s', (url) => {
    const body = formatWebhookBody(url, many, ORIGIN);

    expect(body).toContain('move 4');
    expect(body).not.toContain('move 5 ');
    expect(body).toContain('and 23 smaller moves');
  });

  it('sends the generic hook every move', () => {
    const body = JSON.parse(
      formatWebhookBody('https://hooks.example.com/x', many, ORIGIN),
    ) as typeof many;

    expect(body.apps[0].rankDrops).toHaveLength(28);
  });
});
