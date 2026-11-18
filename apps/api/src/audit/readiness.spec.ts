import { Store } from '@prisma/client';
import {
  AppReadiness,
  AuditCheckResult,
  AuditCheckStatus,
  AuditFactorResult,
  ReadinessItem,
} from '@asobeast/shared';
import { AuditCheckId, AuditExtract } from './audit-scoring';
import { buildReadiness } from './readiness';
import { PageExtractFacts } from '../store-providers/page-extract-facts';

const EXTRACT_AS_OF = '2026-11-14';

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
): AuditExtract => ({ facts: factsWith(overrides), asOf: EXTRACT_AS_OF });

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
    });

    expect(itemOf(readiness, 'preview-video')).toMatchObject({
      status: 'unmeasurable',
      detail: null,
    });
    expect(itemOf(readiness, 'in-app-events')).toMatchObject({
      status: 'fail',
      detail: 'No in-app event is on the store page.',
    });
    expect(itemOf(readiness, 'accessibility')).toMatchObject({
      status: 'unmeasurable',
      detail: 'Declared accessibility features are not read yet.',
      link: null,
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
    });

    expect(
      readiness?.items
        .filter((item) => ['preview-video', 'in-app-events'].includes(item.id))
        .every(
          (item) => item.status === 'unmeasurable' && item.detail === null,
        ),
    ).toBe(true);
    expect(itemOf(readiness, 'accessibility')).toMatchObject({
      status: 'unmeasurable',
    });
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
    });

    expect(itemOf(readiness, 'in-app-events').detail).toBe(
      'The store page lists 2 in-app events.',
    );
  });

  it('leaves accessibility not measured while the declared features are unread', () => {
    const readiness = buildReadiness({
      store: Store.APP_STORE,
      factors: [],
      extract: extractWith({
        accessibilityStatement:
          'The developer has not yet indicated which accessibility features this app supports. Learn More',
      }),
    });

    expect(itemOf(readiness, 'accessibility')).toMatchObject({
      status: 'unmeasurable',
      detail: 'Declared accessibility features are not read yet.',
      link: null,
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
    });

    expect(itemOf(readiness, 'in-app-events').link).toEqual({
      href: 'https://developer.apple.com/app-store/in-app-events/',
      label: 'About in-app events',
    });
    expect(itemOf(readiness, 'accessibility').link).toBeNull();
    expect(itemOf(readiness, 'rating').link).toEqual({
      href: '#factors-conversion',
      label: 'Where the audit scores it',
    });
    expect(readiness?.items.map((item) => item.id)).toEqual([
      'preview-video',
      'in-app-events',
      'accessibility',
      'rating',
      'update-recency',
      'localizations',
      'screenshots',
    ]);
  });
});
