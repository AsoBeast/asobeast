import type { AlertBatchPayload } from '@asobeast/shared';
import {
  alpha,
  batch,
  competitorBatch,
  digest,
  dropped,
  negative,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildAlert } from '../report/build-alert';
import { buildReport } from '../report/build-report';
import { slackBody, type SlackBlock } from './slack';

const ORIGIN = 'https://aso.example.com';
const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';

const batchMessage = (
  payload: AlertBatchPayload,
  origin: string | null = ORIGIN,
) => slackBody(buildReport(payload, origin));

const textOf = (block: SlackBlock | undefined): string =>
  block && 'text' in block && block.type === 'section' ? block.text.text : '';

describe('slackBody for a batch', () => {
  it('heads the message, dates it and closes with one button', () => {
    const message = batchMessage(batch);

    expect(message.text).toBe('📊 Daily app update: 3 changes across 2 apps');
    expect(message.unfurl_links).toBe(false);
    expect(message.blocks[0]).toEqual({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Daily app update: 3 changes across 2 apps',
        emoji: true,
      },
    });
    expect(message.blocks[1]).toEqual({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: expect.stringMatching(
            /^22 Jul 2026 \(UTC\) · <!date\^\d+\^\{date_short_pretty\} at \{time\}\|22 Jul 2026>$/,
          ) as string,
        },
      ],
    });
    expect(message.blocks.at(-1)).toEqual({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open AsoBeast' },
          url: `${ORIGIN}/`,
        },
      ],
    });
  });

  it('opens each app with its icon and gives each group a section', () => {
    const message = batchMessage({
      ...batch,
      apps: [{ ...alpha, app: { ...alpha.app, iconUrl: ICON } }],
    });
    const [app, drops, changes, divider] = message.blocks.slice(2);

    expect(app).toEqual({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${ORIGIN}/apps/a|Alpha>*\nApp Store · 🇺🇸 US`,
      },
      accessory: { type: 'image', image_url: ICON, alt_text: 'Alpha' },
    });
    expect(textOf(drops)).toBe('*Rank drops*\ngame  #3 → #12');
    expect(textOf(changes)).toMatch(
      /^\*Listing changes\*\nTitle: "x+…" → "short"$/,
    );
    expect(divider).toEqual({ type: 'divider' });
  });

  it('links the rest of a cut group, or counts it without an origin', () => {
    const linked = batchMessage(worstCaseBatch('owned_apps'));
    const bare = batchMessage(worstCaseBatch('owned_apps'), null);

    expect(textOf(linked.blocks[3])).toMatch(
      /\n<https:\/\/aso\.example\.com\/apps\/app_0\/keywords\|See all 25>$/,
    );
    expect(textOf(bare.blocks[3])).toMatch(/\n\+5 more$/);
    expect(bare.blocks.some((block) => block.type === 'actions')).toBe(false);
  });

  it('stays within fifty blocks and counts the apps it left out', () => {
    for (const scope of ['owned_apps', 'competitors', null] as const) {
      const message = batchMessage(worstCaseBatch(scope));
      const sections = message.blocks.map(textOf);

      expect(message.blocks.length).toBeLessThanOrEqual(50);
      expect(sections.some((text) => /^\+\d+ more apps$/.test(text))).toBe(
        true,
      );
      expect(sections.every((text) => text.length <= 3000)).toBe(true);
    }
  });

  it('nests each competitor under the primary app', () => {
    const texts = batchMessage(competitorBatch).blocks.map(textOf);

    expect(texts).toContain(
      `*<${ORIGIN}/apps/a|Alpha>*\nYour app · App Store · 🇺🇸 US`,
    );
    expect(texts).toContain(
      `*<${ORIGIN}/apps/c|Charlie>*\nCompetitor · App Store · 🇺🇸 US`,
    );
    expect(texts).toContain('*Listing changes*\nSubtitle: "a" → "b"');
  });

  it('escapes control characters and strips markup from names', () => {
    const hostile = {
      ...alpha,
      app: { ...alpha.app, name: '*Best* & <Co>' },
      rankDrops: [
        {
          ...alpha.rankDrops[0],
          keyword: { ...alpha.rankDrops[0].keyword, text: '<!channel> & co' },
        },
      ],
    };
    const texts = batchMessage({ ...batch, apps: [hostile] }, null).blocks.map(
      textOf,
    );

    expect(texts[2]).toBe('*Best &amp; &lt;Co&gt;*\nApp Store · 🇺🇸 US');
    expect(texts[3]).toContain('&lt;!channel&gt; &amp; co');
  });
});

describe('slackBody for a single alert', () => {
  it('heads the sentence and lists the facts beside the icon', () => {
    const message = slackBody(
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

    expect(message.text).toBe(
      '📉 My App dropped from #4 to #12 for "fitness app" in 🇺🇸 US',
    );
    expect(message.blocks.map((block) => block.type)).toEqual([
      'header',
      'context',
      'section',
      'actions',
    ]);
    expect(message.blocks[2]).toEqual({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*My App*\n*Keyword*: fitness app (US)\n*From*: #4\n*To*: #12\n*Alert threshold*: 5',
      },
      accessory: { type: 'image', image_url: ICON, alt_text: 'My App' },
    });
  });

  it('says how many digest facts it left out instead of cutting a line', () => {
    const message = slackBody(
      buildAlert(
        {
          ...digest,
          groups: Array.from({ length: 200 }, (_, index) => ({
            id: `group_${index}`,
            name: `Linked group with a fairly long name ${index}`,
            visibility: { current: 50, delta7d: 1 },
          })),
        },
        null,
      ),
    );
    const text = textOf(message.blocks[2]);

    expect(text.length).toBeLessThanOrEqual(3000);
    expect(text).toMatch(/\n\+\d+ more$/);
  });

  it('escapes a review that tries to notify the channel', () => {
    const message = slackBody(
      buildAlert(
        { ...negative, review: { ...negative.review, text: '<!channel> now' } },
        null,
      ),
    );

    expect(message.text).toContain('"&lt;!channel&gt; now"');
    expect(textOf(message.blocks[2])).toContain(
      '*Review*: &lt;!channel&gt; now',
    );
    expect(message.blocks[0].type).toBe('header');
  });
});
