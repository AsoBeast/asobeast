import type { AlertPayload } from '@asobeast/shared';
import {
  actionOpened,
  batch,
  competitorBatch,
  digest,
  dropped,
  metadata,
  negative,
} from './email-fixtures.fixture';
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
  batch,
  competitorBatch,
];

describe('formatWebhookBody', () => {
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

  it('serializes a body deterministically', () => {
    expect(formatWebhookBody(DISCORD, batch, ORIGIN)).toBe(
      formatWebhookBody(DISCORD, batch, ORIGIN),
    );
  });
});
