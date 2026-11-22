import {
  LintIssue,
  lintShortDescription,
  MetadataFieldAudit,
  tokenize,
} from '@asobeast/shared';
import type { ActionContextApp } from '../action-context';
import { actionFingerprint } from '../action-fingerprint';
import { scoreImpact } from '../action-impact';
import {
  detectMetadataFixLint,
  metadataFixLintDetector,
} from './metadata-fix-lint';
import { actionContext, contextApp } from './rule-context.fixture';

const OVER_LIMIT: LintIssue = {
  rule: 'over-limit',
  severity: 'error',
  message: 'Exceeds the 30 character limit (34).',
};

const EMOJI: LintIssue = {
  rule: 'emoji',
  severity: 'error',
  message: 'Emoji are not allowed in the title.',
  offendingText: '🔥',
};

const UNDER_USED: LintIssue = {
  rule: 'under-utilized',
  severity: 'warn',
  message: 'Uses less than half of the available characters.',
};

const field = (
  overrides: Partial<MetadataFieldAudit> = {},
): MetadataFieldAudit => ({
  field: 'title',
  value: 'Budget Planner and Money Tracker!',
  chars: 34,
  limit: 30,
  indexed: true,
  issues: [OVER_LIMIT],
  ...overrides,
});

const app = (
  metadataFields: MetadataFieldAudit[],
  overrides: Partial<ActionContextApp> = {},
): ActionContextApp => contextApp({ metadataFields, ...overrides });

const detect = (apps: ActionContextApp[]) =>
  detectMetadataFixLint(actionContext(apps));

describe('metadata.fix_lint', () => {
  it('opens one action for a field with an error', () => {
    const [detection] = detect([app([field()])]);

    expect(detection).toEqual({
      rule: 'metadata.fix_lint',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: null,
      discriminator: 'title',
      terms: { reach: 0.8, severity: 0.6, confidence: 1 },
      evidence: {
        rule: 'metadata.fix_lint',
        field: 'title',
        chars: 34,
        limit: 30,
        issues: [
          {
            rule: 'over-limit',
            message: 'Exceeds the 30 character limit (34).',
            offendingText: null,
          },
        ],
      },
    });
    expect(metadataFixLintDetector.rule).toBe('metadata.fix_lint');
  });

  it('gives two fields with errors two fingerprints', () => {
    const detections = detect([
      app([
        field(),
        field({ field: 'subtitle', chars: 12, limit: 30, issues: [EMOJI] }),
      ]),
    ]);

    expect(detections.map((detection) => detection.discriminator)).toEqual([
      'title',
      'subtitle',
    ]);
    expect(new Set(detections.map(actionFingerprint)).size).toBe(2);
  });

  it('stays silent for a field with warnings only', () => {
    expect(detect([app([field({ issues: [UNDER_USED] })])])).toEqual([]);
  });

  it('stays silent for a field without issues', () => {
    expect(detect([app([field({ issues: [] })])])).toEqual([]);
  });

  it('keeps only the errors, in lint order, and raises severity per error', () => {
    const [detection] = detect([
      app([field({ issues: [EMOJI, UNDER_USED, OVER_LIMIT] })]),
    ]);

    expect(detection.evidence).toMatchObject({
      issues: [
        { rule: 'emoji', offendingText: '🔥' },
        { rule: 'over-limit', offendingText: null },
      ],
    });
    expect(detection.terms.severity).toBeCloseTo(0.8);
  });

  it('caps severity at one however many errors a field has', () => {
    const [detection] = detect([
      app([field({ issues: Array.from({ length: 5 }, () => OVER_LIMIT) })]),
    ]);

    expect(detection.terms.severity).toBe(1);
  });

  it('scores a title error above a subtitle error', () => {
    const [title, subtitle] = detect([
      app([field(), field({ field: 'subtitle', issues: [EMOJI] })]),
    ]);

    expect(scoreImpact(title.rule, title.terms)).toEqual({
      impact: 77,
      priority: 'high',
    });
    expect(scoreImpact(subtitle.rule, subtitle.terms)).toEqual({
      impact: 68,
      priority: 'high',
    });
  });

  it('scopes a Google Play short description error to that field', () => {
    const [detection] = detect([
      app(
        [
          field({
            field: 'shortDescription',
            chars: 84,
            limit: 80,
            issues: [
              {
                ...OVER_LIMIT,
                message: 'Exceeds the 80 character limit (84).',
              },
            ],
          }),
        ],
        { store: 'GOOGLE_PLAY', country: 'de' },
      ),
    ]);

    expect(detection).toMatchObject({
      store: 'GOOGLE_PLAY',
      country: 'de',
      discriminator: 'shortDescription',
      terms: { reach: 0.6 },
      evidence: { field: 'shortDescription', limit: 80 },
    });
  });
});

describe('metadata.fix_lint on a google play short description', () => {
  const text = 'Zakupy online, płatności, dostawa i zwroty w jednej aplikacji';
  const titleWords = tokenize('Allegro: zakupy online');
  const shortDescription = (extra: string) => {
    const value = `${text}${extra}`;
    return app(
      [
        field({
          field: 'shortDescription',
          value,
          chars: value.length,
          limit: 80,
          issues: lintShortDescription(value, { titleWords }, 80),
        }),
      ],
      { store: 'GOOGLE_PLAY' },
    );
  };

  it('opens no action when the only issue is repeating title words', () => {
    expect(detect([shortDescription('')])).toEqual([]);
  });

  it('lists only the real errors when a repeat sits beside one', () => {
    const [detection] = detect([shortDescription(' Download now')]);

    expect(detection.evidence).toMatchObject({
      issues: [{ rule: 'policy-term', offendingText: 'download now' }],
    });
  });
});

describe('metadata.fix_lint in market listings', () => {
  const REPEAT: LintIssue = {
    rule: 'repeats-title-word',
    severity: 'error',
    message: '"friends" already appears in the title.',
    offendingText: 'friends',
  };
  const subtitle = (value: string) =>
    field({
      field: 'subtitle',
      value,
      chars: value.length,
      issues: [REPEAT],
    });
  const withMarkets = (
    home: MetadataFieldAudit[],
    markets: Array<[string, MetadataFieldAudit[]]>,
  ) =>
    app(home, {
      marketMetadata: markets.map(([country, fields]) => ({
        country,
        coverage: [],
        fields,
      })),
    });

  it('opens an action in a market whose own listing breaks a rule', () => {
    const detections = detect([
      withMarkets([], [['tr', [subtitle('Arkadaşlar ana ekranında')]]]),
    ]);

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      country: 'tr',
      discriminator: 'subtitle',
    });
  });

  it('reports a problem shared with the home listing once, in the home market', () => {
    const shared = subtitle('Friends on your home screen');
    const detections = detect([
      withMarkets(
        [shared],
        [
          ['gb', [shared]],
          ['ca', [shared]],
        ],
      ),
    ]);

    expect(detections.map((detection) => detection.country)).toEqual(['us']);
  });

  it('reports a shared market problem in the first market by country', () => {
    const shared = subtitle('Amis sur ton écran');
    const detections = detect([
      withMarkets(
        [],
        [
          ['be', [shared]],
          ['fr', [shared]],
        ],
      ),
    ]);

    expect(detections.map((detection) => detection.country)).toEqual(['be']);
  });

  it('keeps one action per market when the field text differs', () => {
    const detections = detect([
      withMarkets(
        [subtitle('Friends on your home screen')],
        [['tr', [subtitle('Arkadaşlar ana ekranında')]]],
      ),
    ]);

    expect(detections.map((detection) => detection.country)).toEqual([
      'us',
      'tr',
    ]);
  });

  it('mints distinct fingerprints per market', () => {
    const detections = detect([
      withMarkets(
        [subtitle('Friends on your home screen')],
        [['tr', [subtitle('Arkadaşlar ana ekranında')]]],
      ),
    ]);

    const fingerprints = detections.map((detection) =>
      actionFingerprint({
        rule: detection.rule,
        appId: detection.appId,
        store: detection.store,
        country: detection.country,
        keywordId: detection.keywordId,
        discriminator: detection.discriminator,
      }),
    );
    expect(new Set(fingerprints).size).toBe(2);
  });
});
