import type { AlertBatchPayload } from '@asobeast/shared';
import {
  alpha,
  batch,
  competitorBatch,
  dropped,
  emptySection,
  improved,
  metadata,
  negative,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildAlert } from '../report/build-alert';
import { buildReport } from '../report/build-report';
import { discordBody, embedSize, type DiscordMessage } from './discord';

const ORIGIN = 'https://aso.example.com';
const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';

const withIcon = (payload: AlertBatchPayload): AlertBatchPayload => ({
  ...payload,
  apps: payload.apps.map((section) => ({
    ...section,
    app: { ...section.app, iconUrl: ICON },
  })),
});

const totalSize = (message: DiscordMessage) =>
  message.embeds.reduce((total, embed) => total + embedSize(embed), 0);

const batchMessage = (
  payload: AlertBatchPayload,
  origin: string | null = ORIGIN,
) => discordBody(buildReport(payload, origin));

describe('discordBody for a batch', () => {
  it('puts the headline in the content and one embed per app', () => {
    const message = batchMessage(withIcon(batch));

    expect(message.content).toBe(
      '📊 Daily app update: 3 changes across 2 apps',
    );
    expect(message.allowed_mentions).toEqual({ parse: [] });
    expect(message.embeds).toHaveLength(2);
    expect(message.embeds[0]).toMatchObject({
      title: 'Alpha',
      url: `${ORIGIN}/apps/a`,
      author: { name: 'App Store · 🇺🇸 US' },
      thumbnail: { url: ICON },
      timestamp: batch.occurredAt,
      footer: { text: 'AsoBeast · 22 Jul 2026' },
    });
    expect(message.embeds[0].fields.map((field) => field.name)).toEqual([
      'Rank drops',
      'Listing changes',
    ]);
    expect(message.embeds[0].fields[0].value).toBe('game  #3 → #12');
  });

  it('dates the first embed in the reader zone with a utc fallback', () => {
    const [first, second] = batchMessage(batch).embeds;

    expect(first.description).toMatch(/^22 Jul 2026 \(UTC\) · <t:\d+:f>$/);
    expect(second.description).toBeUndefined();
  });

  it('colours each app by the groups it holds', () => {
    const up = { ...emptySection(alpha.app), rankImprovements: [improved] };
    const neutral = { ...emptySection(alpha.app), changes: alpha.changes };
    const colours = batchMessage({
      ...batch,
      apps: [up, alpha, { ...alpha, rankImprovements: [improved] }, neutral],
    }).embeds.map((embed) => embed.color);

    expect(colours).toEqual([0x0d7a3e, 0xc12535, 0xf89820, 0xf89820]);
  });

  it('links the rest of a cut group from its field', () => {
    const [embed] = batchMessage(worstCaseBatch('owned_apps')).embeds;

    expect(embed.fields[0].value).toMatch(
      /\n\[See all 25\]\(https:\/\/aso\.example\.com\/apps\/app_0\/keywords\)$/,
    );
  });

  it('counts the rest without an origin', () => {
    const [embed] = batchMessage(worstCaseBatch('owned_apps'), null).embeds;

    expect(embed.fields[0].value).toMatch(/\n\+5 more$/);
    expect(embed.url).toBeUndefined();
  });

  it('keeps the largest report within every discord limit', () => {
    for (const scope of ['owned_apps', 'competitors', null] as const) {
      const message = batchMessage(worstCaseBatch(scope));

      expect(totalSize(message)).toBeLessThanOrEqual(6000);
      expect(message.embeds.length).toBeLessThanOrEqual(10);
      expect(message.content.length).toBeLessThanOrEqual(2000);
      for (const embed of message.embeds) {
        expect(embed.fields.length).toBeLessThanOrEqual(25);
        for (const field of embed.fields) {
          expect(field.name.length).toBeLessThanOrEqual(256);
          expect(field.value.length).toBeLessThanOrEqual(1024);
        }
      }
      expect(message.content).toMatch(/\n\+\d+ more apps · \[Open AsoBeast\]/);
    }
  });

  it('lists each competitor under the primary app it watches', () => {
    const [embed] = batchMessage(competitorBatch).embeds;

    expect(embed.title).toBe('Alpha');
    expect(embed.author).toEqual({ name: 'Your app · App Store · 🇺🇸 US' });
    expect(embed.fields).toEqual([
      { name: 'Competitor · Charlie', value: 'Subtitle: "a" → "b"' },
    ]);
  });

  it('shows the new icon of an app without one when its icon changed', () => {
    const changed = {
      ...emptySection(alpha.app),
      changes: [
        {
          ...metadata,
          changes: [
            {
              field: 'icon' as const,
              before: null,
              after: 'https://x.test/new.png',
            },
          ],
        },
      ],
    };

    expect(batchMessage({ ...batch, apps: [changed] }).embeds[0]).toMatchObject(
      {
        thumbnail: { url: 'https://x.test/new.png' },
        fields: [{ name: 'Listing changes', value: 'Icon changed' }],
      },
    );
  });

  it('escapes markup and mentions in names and rows', () => {
    const hostile = {
      ...alpha,
      app: { ...alpha.app, name: 'Where Am I? - _Geo_ @everyone' },
      rankDrops: [
        {
          ...alpha.rankDrops[0],
          keyword: { ...alpha.rankDrops[0].keyword, text: '*bold* @here' },
        },
      ],
    };
    const [embed] = batchMessage({ ...batch, apps: [hostile] }).embeds;

    expect(embed.title).toBe('Where Am I? - \\_Geo\\_ \\@everyone');
    expect(embed.fields[0].value).toContain('\\*bold\\* \\@here');
  });

  it('sends only the headline for an empty batch', () => {
    expect(
      batchMessage({ ...batch, totals: { events: 0, apps: 0 }, apps: [] }),
    ).toEqual({
      content: '📊 Daily app update: 0 changes across 0 apps',
      embeds: [],
      allowed_mentions: { parse: [] },
    });
  });
});

describe('discordBody for a single alert', () => {
  it('puts the sentence in the content and the facts in one embed', () => {
    const message = discordBody(
      buildAlert(
        {
          ...dropped,
          app: {
            ...dropped.app,
            iconUrl: ICON,
            store: 'APP_STORE',
            country: 'us',
          },
        },
        ORIGIN,
      ),
    );

    expect(message.content).toBe(
      '📉 My App dropped from #4 to #12 for "fitness app" in 🇺🇸 US',
    );
    expect(message.embeds).toHaveLength(1);
    expect(message.embeds[0]).toMatchObject({
      title: 'My App',
      url: `${ORIGIN}/apps/app_1`,
      color: 0xc12535,
      author: { name: 'App Store · 🇺🇸 US', icon_url: ICON },
      thumbnail: { url: ICON },
      fields: [
        { name: 'Keyword', value: 'fitness app (US)', inline: true },
        { name: 'From', value: '#4', inline: true },
        { name: 'To', value: '#12', inline: true },
        { name: 'Alert threshold', value: '5', inline: true },
      ],
    });
    expect(message.embeds[0].description).toMatch(
      /^<t:\d+:f> · 11 Jul 2026, 00:00 UTC$/,
    );
  });

  it('escapes a review that tries to mention everyone', () => {
    const message = discordBody(
      buildAlert(
        {
          ...negative,
          review: { ...negative.review, text: '@everyone *now*' },
        },
        null,
      ),
    );

    expect(message.content).toContain('"\\@everyone \\*now\\*"');
    expect(message.allowed_mentions).toEqual({ parse: [] });
    expect(message.embeds[0].url).toBeUndefined();
  });
});
