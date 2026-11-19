import { Store } from '@prisma/client';
import {
  AppReadiness,
  AuditCheckResult,
  AuditCheckStatus,
  AuditFactorResult,
  ReadinessItem,
} from '@asobeast/shared';
import { AuditCheckId, AuditExtract, FeaturingReads } from './audit-scoring';
import { buildReadiness } from './readiness';
import { PageExtractFacts } from '../store-providers/page-extract-facts';

const EXTRACT_AS_OF = '2026-11-14';
const NOW = new Date('2026-11-19T00:00:00.000Z');

const factsWith = (
  overrides: Partial<PageExtractFacts> = {},
): PageExtractFacts => ({
  previewVideoUrls: [],
  appEvents: [],
  featuredStories: [],
  editorsChoice: null,
  accessibilityStatement: null,
  ...overrides,
});

const extractWith = (
  overrides: Partial<PageExtractFacts> = {},
  fallback = false,
): AuditExtract => ({
  facts: factsWith(overrides),
  asOf: EXTRACT_AS_OF,
  fallback,
});

const readsWith = (
  overrides: Partial<FeaturingReads> = {},
): FeaturingReads => ({
  draftNominations: 0,
  submittedNominations: 0,
  archivedNominations: 0,
  submittedDate: null,
  publishStartDate: null,
  publishEndDate: null,
  promoFilled: 0,
  promoTotal: 0,
  roleRefused: false,
  nominationsError: null,
  promoError: null,
  ...overrides,
});

const checkWith = (
  id: AuditCheckId,
  status: AuditCheckStatus,
  detail = 'A human line.',
): AuditCheckResult => ({
  id,
  label: 'Check',
  kind: 'auto',
  status,
  score: null,
  detail,
});

const factorsWith = (checks: AuditCheckResult[]): AuditFactorResult[] => [
  {
    id: 'conversion',
    label: 'Conversion',
    weight: 5,
    score: 8,
    checks,
    needsInput: false,
    group: 'conversion',
  },
];

const itemOf = (readiness: AppReadiness | null, id: string): ReadinessItem => {
  const found = readiness?.items.find((item) => item.id === id);
  if (!found) {
    throw new Error(`no ${id} row`);
  }
  return found;
};

describe('buildReadiness', () => {
  it('answers null for a Google Play app', () => {
    expect(
      buildReadiness({
        store: Store.GOOGLE_PLAY,
        factors: [],
        extract: extractWith(),
        featuring: readsWith(),
        now: NOW,
      }),
    ).toBeNull();
  });

  it('passes the extract rows of a fully featured page', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([
        checkWith(
          'preview-video-present',
          'pass',
          'The store page shows 1 preview video.',
        ),
        checkWith('ratings-average', 'pass'),
        checkWith('conversion-update-recency', 'pass'),
        checkWith('conversion-localizations', 'pass'),
        checkWith('screenshots-count', 'pass'),
      ]),
      extract: extractWith({
        appEvents: [
          {
            appEventId: 'e1',
            title: 'Spring sale',
            kind: null,
            badge: null,
            startsAt: null,
            endsAt: null,
          },
        ],
        featuredStories: [
          { storyId: 's1', heading: 'Today', title: 'Apps we love' },
        ],
        editorsChoice: { showsBadge: true, notes: null },
      }),
      featuring: null,
      now: NOW,
    });

    expect(readiness?.extractAsOf).toBe(EXTRACT_AS_OF);
    expect(readiness?.editorial).toEqual({
      stories: 1,
      editorsChoiceBadge: true,
    });
    expect(readiness?.items.map((item) => item.status)).toEqual([
      'pass',
      'pass',
      'unmeasurable',
      'unmeasurable',
      'pass',
      'pass',
      'pass',
      'pass',
    ]);
    expect(itemOf(readiness, 'preview-video').detail).toBe(
      'The store page shows 1 preview video.',
    );
    expect(itemOf(readiness, 'in-app-events').detail).toBe(
      'The store page lists 1 in-app event.',
    );
  });

  it('answers the preview video row from the graded check, not the extract', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([
        checkWith(
          'preview-video-present',
          'fail',
          'No preview video is on the store page.',
        ),
      ]),
      extract: extractWith({
        previewVideoUrls: ['https://video.example.com/a.mp4'],
      }),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'preview-video')).toMatchObject({
      status: 'fail',
      detail: 'No preview video is on the store page.',
    });
    expect(itemOf(readiness, 'preview-video').link).toEqual({
      href: '#factors-conversion',
      label: 'Where the audit scores it',
    });
  });

  it('fails the extract rows of a page without featuring surfaces', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith({ previewVideoUrls: [] }),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'preview-video')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
    expect(itemOf(readiness, 'in-app-events')).toMatchObject({
      status: 'fail',
      detail: 'No in-app event is on the store page.',
    });
    expect(readiness?.editorial).toEqual({
      stories: 0,
      editorsChoiceBadge: false,
    });
  });

  it('leaves the extract rows unmeasurable and the editorial null without an extract', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: null,
      featuring: null,
      now: NOW,
    });

    expect(
      readiness?.items
        .filter((item) => ['preview-video', 'in-app-events'].includes(item.id))
        .every(
          (item) => item.status === 'unmeasurable' && item.detail === null,
        ),
    ).toBe(true);
    expect(readiness?.editorial).toBeNull();
    expect(readiness?.extractAsOf).toBeNull();
  });

  it('passes the events row in the plural wording of two events', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith({
        appEvents: [
          {
            appEventId: 'e1',
            title: null,
            kind: null,
            badge: null,
            startsAt: null,
            endsAt: null,
          },
          {
            appEventId: 'e2',
            title: null,
            kind: null,
            badge: null,
            startsAt: null,
            endsAt: null,
          },
        ],
      }),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'in-app-events').detail).toBe(
      'The store page lists 2 in-app events.',
    );
  });

  it('ignores an event that has ended before the audits now when the extract is the fallback', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(
        {
          appEvents: [
            {
              appEventId: 'e1',
              title: 'Ended sale',
              kind: null,
              badge: null,
              startsAt: null,
              endsAt: '2020-01-01T00:00:00.000Z',
            },
            {
              appEventId: 'e2',
              title: 'Live sale',
              kind: null,
              badge: null,
              startsAt: null,
              endsAt: '2999-01-01T00:00:00.000Z',
            },
          ],
        },
        true,
      ),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'in-app-events')).toMatchObject({
      status: 'pass',
      detail: 'The store page lists 1 in-app event.',
    });
  });

  it('answers the zero events wording when every fallback event has ended', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(
        {
          appEvents: [
            {
              appEventId: 'e1',
              title: null,
              kind: null,
              badge: null,
              startsAt: null,
              endsAt: '2020-01-01T00:00:00.000Z',
            },
          ],
        },
        true,
      ),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'in-app-events')).toMatchObject({
      status: 'fail',
      detail: 'No in-app event is on the store page.',
    });
  });

  it('drops an event that has ended whatever read answered it', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith({
        appEvents: [
          {
            appEventId: 'e1',
            title: null,
            kind: null,
            badge: null,
            startsAt: null,
            endsAt: '2020-01-01T00:00:00.000Z',
          },
        ],
      }),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'in-app-events')).toMatchObject({
      status: 'fail',
      detail: 'No in-app event is on the store page.',
    });
  });

  it('reuses the status and the detail of the graded checks', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([
        checkWith('ratings-average', 'warn'),
        checkWith('conversion-update-recency', 'fail'),
        checkWith('conversion-localizations', 'pass', '3 declared languages.'),
        checkWith('screenshots-count', 'unanswered', 'No screenshots yet.'),
      ]),
      extract: extractWith(),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'rating')).toMatchObject({
      status: 'warn',
      detail: 'A human line.',
    });
    expect(itemOf(readiness, 'update-recency')).toMatchObject({
      status: 'fail',
      detail: 'A human line.',
    });
    expect(itemOf(readiness, 'localizations')).toMatchObject({
      status: 'pass',
      detail: '3 declared languages.',
    });
    expect(itemOf(readiness, 'screenshots')).toMatchObject({
      status: 'unmeasurable',
      detail: 'No screenshots yet.',
    });
  });

  it('leaves a reuse row unmeasurable when the rubric has no such check', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([checkWith('ratings-average', 'pass')]),
      extract: extractWith(),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'preview-video')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
    expect(itemOf(readiness, 'update-recency')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
    expect(itemOf(readiness, 'localizations')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
    expect(itemOf(readiness, 'screenshots')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
  });

  it('points the events row at the Apple documentation and the rest at the factors', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([checkWith('ratings-average', 'pass')]),
      extract: extractWith(),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'in-app-events').link).toEqual({
      href: 'https://developer.apple.com/app-store/in-app-events/',
      label: 'About in-app events',
    });
    expect(itemOf(readiness, 'rating').link).toEqual({
      href: '#factors-conversion',
      label: 'Where the audit scores it',
    });
    expect(readiness?.items.map((item) => item.id)).toEqual([
      'preview-video',
      'in-app-events',
      'nominations',
      'promotional-text',
      'rating',
      'update-recency',
      'localizations',
      'screenshots',
    ]);
  });

  it('leaves the console rows not measured without a stored read', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: null,
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
      link: null,
    });
    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
      link: null,
    });
  });

  it('passes the nominations row with the lead time to the publish window', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({
        submittedNominations: 1,
        submittedDate: new Date('2026-10-05T09:30:00.000Z'),
        publishStartDate: new Date('2026-11-19T00:00:00.000Z'),
        publishEndDate: new Date('2026-12-19T00:00:00.000Z'),
      }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'pass',
      detail: 'Submitted 45 days before the publish window.',
    });
  });

  it('rounds a nomination filed inside the last day up to one day', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({
        submittedNominations: 1,
        submittedDate: new Date('2026-11-18T18:00:00.000Z'),
        publishStartDate: new Date('2026-11-19T00:00:00.000Z'),
      }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'pass',
      detail: 'Submitted 1 day before the publish window.',
    });
  });

  it('passes the nominations row without a lead time when the dates are missing', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({ submittedNominations: 1 }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'pass',
      detail: 'A nomination is submitted for featuring.',
    });
  });

  it('asks for work when no submitted nomination exists', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({ archivedNominations: 2 }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'warn',
      detail:
        'Not nominated. Apple asks for nominations at least two weeks ahead.',
    });
  });

  it('mentions the unsubmitted draft when only a draft exists', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({ draftNominations: 1 }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'warn',
      detail:
        'A nomination is still a draft. Apple asks for nominations at least two weeks ahead.',
    });
  });

  it('says the window was missed when the current version shipped recently', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([checkWith('conversion-update-recency', 'pass')]),
      extract: extractWith(),
      featuring: readsWith(),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'warn',
      detail:
        'Not nominated. Apple asks for nominations at least two weeks ahead. The window for the current version was missed until the next release.',
    });
  });

  it('keeps the plain wording when the current version is not recent', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: factorsWith([checkWith('conversion-update-recency', 'fail')]),
      extract: extractWith(),
      featuring: readsWith({ draftNominations: 1 }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'warn',
      detail:
        'A nomination is still a draft. Apple asks for nominations at least two weeks ahead.',
    });
  });

  it('leaves the nominations row not measured when the key lacks the role', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({
        roleRefused: true,
        nominationsError: 'The App Store Connect key needs another role.',
        promoFilled: 21,
        promoTotal: 21,
      }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'unmeasurable',
      detail: 'The App Store Connect key needs another role.',
    });
    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'pass',
      detail: 'Promotional text is set for all 21 localizations.',
    });
  });

  it('leaves the nominations row not measured when the read was skipped', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({
        nominationsError: 'App Store Connect answered 500',
      }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'unmeasurable',
      detail: 'App Store Connect answered 500',
    });
  });

  it('leaves both rows not measured with the reason when the key stopped seeing the app', () => {
    const reason =
      'App Store Connect does not show this app to the connected key';
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({
        submittedNominations: 1,
        promoFilled: 21,
        promoTotal: 21,
        nominationsError: reason,
        promoError: reason,
      }),
      now: NOW,
    });

    expect(itemOf(readiness, 'nominations')).toMatchObject({
      status: 'unmeasurable',
      detail: reason,
    });
    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'unmeasurable',
      detail: reason,
    });
  });

  it('passes the promotional text row when every localization is filled', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({ promoFilled: 21, promoTotal: 21 }),
      now: NOW,
    });

    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'pass',
      detail: 'Promotional text is set for all 21 localizations.',
    });
  });

  it('asks for work when localizations carry no promotional text', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({ promoFilled: 19, promoTotal: 21 }),
      now: NOW,
    });

    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'warn',
      detail: 'Promotional text is set for 19 of 21 localizations.',
    });
  });

  it('leaves the promotional text row not measured when the read was skipped', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith({
        promoError:
          'App Store Connect has no released iOS version for this app yet',
      }),
      now: NOW,
    });

    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'unmeasurable',
      detail: 'App Store Connect has no released iOS version for this app yet',
    });
  });

  it('leaves the promotional text row not measured when nothing is served', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith(),
      featuring: readsWith(),
      now: NOW,
    });

    expect(itemOf(readiness, 'promotional-text')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
  });
});
