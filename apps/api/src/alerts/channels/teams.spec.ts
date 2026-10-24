import type { AlertBatchPayload } from '@asobeast/shared';
import {
  alpha,
  batch,
  competitorBatch,
  dropped,
  emptySection,
  metadata,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildAlert } from '../report/build-alert';
import { buildReport } from '../report/build-report';
import { escapeTeams, teamsBody } from './teams';

const ORIGIN = 'https://aso.example.com';
const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';

const cardOf = (payload: AlertBatchPayload, origin: string | null = ORIGIN) =>
  teamsBody(buildReport(payload, origin)).attachments[0].content;

describe('teamsBody for a batch', () => {
  it('wraps an adaptive card 1.5 in a message', () => {
    const message = teamsBody(buildReport(batch, ORIGIN));

    expect(message.type).toBe('message');
    expect(message.attachments[0]).toMatchObject({
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        type: 'AdaptiveCard',
        version: '1.5',
        msteams: { width: 'Full' },
        actions: [
          { type: 'Action.OpenUrl', title: 'Open AsoBeast', url: `${ORIGIN}/` },
        ],
      },
    });
  });

  it('heads the card and dates it in the reader zone with a utc fallback', () => {
    const [headline, date] = cardOf(batch).body;

    expect(headline).toEqual({
      type: 'TextBlock',
      text: 'Daily app update: 3 changes across 2 apps',
      wrap: true,
      size: 'Large',
      weight: 'Bolder',
    });
    expect(date).toMatchObject({
      text: '22 Jul 2026 (UTC) · {{DATE(2026-07-22T11:00:00Z,SHORT)}} {{TIME(2026-07-22T11:00:00Z)}}',
      isSubtle: true,
    });
  });

  it('opens each app with its icon, linked name and storefront', () => {
    const [, , header] = cardOf({
      ...batch,
      apps: [{ ...alpha, app: { ...alpha.app, iconUrl: ICON } }],
    }).body;

    expect(header).toEqual({
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column',
          width: 'auto',
          items: [{ type: 'Image', url: ICON, size: 'Small', altText: '' }],
        },
        {
          type: 'Column',
          width: 'stretch',
          items: [
            {
              type: 'TextBlock',
              text: `**[Alpha](${ORIGIN}/apps/a)**`,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: 'App Store · US',
              wrap: true,
              isSubtle: true,
              spacing: 'None',
            },
          ],
        },
      ],
    });
  });

  it('lists each group as a fact set', () => {
    const body = cardOf(batch).body;

    expect(body).toContainEqual({
      type: 'FactSet',
      facts: [{ title: 'game', value: '#3 → #12' }],
    });
    expect(body).toContainEqual({
      type: 'TextBlock',
      text: '**Rank drops**',
      wrap: true,
      spacing: 'Medium',
    });
  });

  it('shows both icons of an icon change', () => {
    const body = cardOf({
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
                  before: 'https://x.test/old.png',
                  after: 'https://x.test/new.png',
                },
              ],
            },
          ],
        },
      ],
    }).body;
    const images = JSON.stringify(body).match(/"type":"Image"/g);

    expect(body).toContainEqual({
      type: 'FactSet',
      facts: [{ title: 'Icon changed', value: '' }],
    });
    expect(images).toHaveLength(2);
  });

  it('nests competitors under the primary app', () => {
    const text = JSON.stringify(cardOf(competitorBatch).body);

    expect(text).toContain('Your app · App Store · US');
    expect(text).toContain('Competitor · App Store · US');
    expect(text).toContain('Subtitle');
  });

  it('links the rest of a cut group and stays under 28 kb', () => {
    for (const scope of ['owned_apps', 'competitors', null] as const) {
      const message = teamsBody(buildReport(worstCaseBatch(scope), ORIGIN));
      const text = JSON.stringify(message);

      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(28 * 1024);
      expect(text).toMatch(/\+\d+ more apps/);
    }
    expect(JSON.stringify(cardOf(worstCaseBatch('owned_apps')))).toContain(
      `[See all 25](${ORIGIN}/apps/app_0/keywords)`,
    );
  });

  it('opens nothing without an origin', () => {
    const card = cardOf(batch, null);

    expect(card.actions).toBeUndefined();
    expect(JSON.stringify(card.body)).not.toContain('http');
  });
});

describe('teamsBody for a single alert', () => {
  it('heads the sentence and lists the facts', () => {
    const card = teamsBody(
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
        false,
      ),
    ).attachments[0].content;

    expect(card.body[0]).toMatchObject({
      text: 'My App dropped from #4 to #12 for "fitness app" in US',
    });
    expect(card.body).toContainEqual({
      type: 'FactSet',
      facts: [
        { title: 'Keyword', value: 'fitness app (US)' },
        { title: 'From', value: '#4' },
        { title: 'To', value: '#12' },
        { title: 'Alert threshold', value: '5' },
      ],
    });
    expect(card.actions).toEqual([
      {
        type: 'Action.OpenUrl',
        title: 'Open app',
        url: `${ORIGIN}/apps/app_1`,
      },
    ]);
  });
});

describe('escapeTeams', () => {
  it('escapes the markdown teams renders', () => {
    expect(escapeTeams('*bold* _it_ [x](y)')).toBe(
      '\\*bold\\* \\_it\\_ \\[x\\](y)',
    );
  });
});
