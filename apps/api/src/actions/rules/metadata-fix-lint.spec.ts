import { LintIssue, MetadataFieldAudit } from '@asobeast/shared';
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
