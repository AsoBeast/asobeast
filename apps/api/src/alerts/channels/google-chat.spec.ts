import {
  alpha,
  batch,
  competitorBatch,
  dropped,
  emptySection,
  metadata,
  negative,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildAlert } from '../report/build-alert';
import { buildReport } from '../report/build-report';
import { googleChatBody } from './google-chat';

const ORIGIN = 'https://aso.example.com';
const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';

const widgetsOf = (message: ReturnType<typeof googleChatBody>) =>
  message.cardsV2[0].card.sections.flatMap((section) => section.widgets);

describe('googleChatBody for a batch', () => {
  it('heads one card with the first app icon and a utc date', () => {
    const message = googleChatBody(
      buildReport(
        {
          ...batch,
          apps: [{ ...alpha, app: { ...alpha.app, iconUrl: ICON } }],
        },
        ORIGIN,
      ),
    );

    expect(message.text).toBe('📊 Daily app update: 3 changes across 2 apps');
    expect(message.cardsV2[0]).toMatchObject({
      cardId: 'alerts.batch-2026-07-22',
      card: {
        header: {
          title: '📊 Daily app update: 3 changes across 2 apps',
          subtitle: '22 Jul 2026 (UTC)',
          imageUrl: ICON,
          imageType: 'SQUARE',
          imageAltText: 'Alpha',
        },
      },
    });
  });

  it('gives each app a section with its link and a row per fact', () => {
    const [section] = googleChatBody(buildReport(batch, ORIGIN)).cardsV2[0].card
      .sections;

    expect(section.header).toBe('<b>Alpha</b>');
    expect(section.widgets[0]).toEqual({
      textParagraph: {
        text: `<a href="${ORIGIN}/apps/a">Alpha</a> · App Store · 🇺🇸 US`,
      },
    });
    expect(section.widgets[1]).toEqual({
      decoratedText: {
        topLabel: 'Rank drops',
        text: 'game  #3 → #12',
        wrapText: true,
      },
    });
  });

  it('shows the new icon beside an icon change', () => {
    const widgets = widgetsOf(
      googleChatBody(
        buildReport(
          {
            ...batch,
            apps: [
              {
                ...emptySection(alpha.app),
                changes: [
                  {
                    ...metadata,
                    changes: [
                      {
                        field: 'icon',
                        before: null,
                        after: 'https://x.test/new.png',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          null,
        ),
      ),
    );

    expect(widgets).toContainEqual({
      decoratedText: {
        topLabel: 'Listing changes',
        text: 'Icon changed',
        wrapText: true,
        startIcon: { iconUrl: 'https://x.test/new.png' },
      },
    });
  });

  it('closes with one button to open AsoBeast', () => {
    const { sections } = googleChatBody(buildReport(batch, ORIGIN)).cardsV2[0]
      .card;

    expect(sections.at(-1)).toEqual({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: 'Open AsoBeast',
                onClick: { openLink: { url: `${ORIGIN}/` } },
              },
            ],
          },
        },
      ],
    });
  });

  it('gives competitors their own sections', () => {
    const headers = googleChatBody(
      buildReport(competitorBatch, null),
    ).cardsV2[0].card.sections.map((section) => section.header);

    expect(headers).toEqual(['<b>Alpha</b>', '<b>Charlie</b>']);
  });

  it('stays within the widget and size caps and counts the apps left out', () => {
    for (const scope of ['owned_apps', 'competitors', null] as const) {
      const message = googleChatBody(
        buildReport(worstCaseBatch(scope), ORIGIN),
      );

      expect(widgetsOf(message).length).toBeLessThanOrEqual(100);
      expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThanOrEqual(
        32 * 1024,
      );
      expect(message.cardsV2[0].card.sections.length).toBeGreaterThan(2);
      expect(JSON.stringify(message)).toMatch(/\+\d+ more apps/);
    }
  });

  it('escapes what a store user wrote', () => {
    const hostile = {
      ...alpha,
      app: { ...alpha.app, name: '<b>x</b> & y' },
    };
    const text = JSON.stringify(
      googleChatBody(buildReport({ ...batch, apps: [hostile] }, null)),
    );

    expect(text).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y');
    expect(text).not.toContain('<b>x</b>');
  });
});

describe('googleChatBody for a single alert', () => {
  it('lists the facts under the sentence', () => {
    const message = googleChatBody(buildAlert(dropped, ORIGIN));

    expect(message.cardsV2[0].card.header).toMatchObject({
      title: '📉 My App dropped from #4 to #12 for "fitness app" in 🇺🇸 US',
      subtitle: '11 Jul 2026, 00:00 UTC',
    });
    expect(message.cardsV2[0].card.sections[0].widgets[0]).toEqual({
      decoratedText: {
        topLabel: 'Keyword',
        text: 'fitness app (US)',
        wrapText: true,
      },
    });
  });

  it('keeps a mention out of the notification text', () => {
    const message = googleChatBody(
      buildAlert(
        {
          ...negative,
          review: { ...negative.review, text: '<users/all> now' },
        },
        null,
      ),
    );

    expect(message.text).not.toContain('<users/all>');
  });
});
