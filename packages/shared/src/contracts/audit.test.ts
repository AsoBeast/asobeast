import { describe, expect, it } from 'vitest';

import type {
  AppAuditResult,
  AppReadiness,
  AuditAiRunState,
  AuditEffort,
  AuditGrade,
  AuditTarget,
  AuditUnlockKind,
  ReadinessStatus,
} from './audit';

const v1: AppAuditResult = {
  appId: 'app-1',
  store: 'APP_STORE',
  overall: 71,
  coveredWeight: 90,
  totalWeight: 110,
  factors: [
    {
      id: 'title',
      label: 'Title',
      weight: 20,
      score: 10,
      needsInput: false,
      checks: [
        {
          id: 'title-keyword',
          label: 'Primary keyword in title',
          kind: 'auto',
          status: 'pass',
          score: 10,
          detail: 'Matched.',
        },
      ],
    },
  ],
  recommendations: { quickWins: [], highImpact: [], strategic: [] },
  ai: { configured: true, model: 'gpt-4o', generatedAt: null },
  generatedAt: '2026-09-17T14:00:00.000Z',
};

const v2: AppAuditResult = {
  ...v1,
  rubricVersion: 'v2',
  grade: 'B',
  confidence: 0.82,
  potential: 86,
  groups: [
    {
      id: 'discoverability',
      label: 'Search visibility',
      score: 6.4,
      confidence: 0.9,
    },
  ],
  limitations: [
    { id: 'preview-video', label: 'App previews', detail: 'Not visible.' },
  ],
  unlocks: [{ kind: 'ai-analysis', label: 'Analyze creative', checks: 9 }],
  creative: {
    analyzedAt: '2026-09-17T14:00:00.000Z',
    model: 'gpt-4o',
    stale: false,
    icon: {
      url: 'https://is1-ssl.mzstatic.com/i.png',
      hasText: false,
      elementCount: 'one',
      contrast: 'high',
      similarCompetitor: null,
    },
    screenshots: [
      {
        position: 1,
        url: 'https://is1-ssl.mzstatic.com/s1.png',
        captionText: 'Guess any place',
        captionReadable: true,
        captionLanguage: 'en',
        message: 'benefit',
        keywordHits: ['geo quiz'],
      },
    ],
  },
  benchmarks: {
    competitors: 3,
    rows: [
      {
        metric: 'rating-count',
        label: 'Ratings',
        better: 'higher',
        you: 341,
        median: 300,
        best: 5200,
        bestAppId: 'c1',
      },
    ],
  },
  ai: {
    configured: true,
    model: 'gpt-4o',
    generatedAt: '2026-09-17T14:00:00.000Z',
    stale: false,
    run: {
      state: 'completed',
      requestedAt: '2026-09-17T13:59:50.000Z',
      finishedAt: '2026-09-17T14:00:00.000Z',
      error: null,
    },
  },
};

describe('AppAuditResult', () => {
  it('accepts a v1 shaped result and a v2 result', () => {
    expect(v2.factors).toEqual(v1.factors);
  });

  it('accepts a result with the optional readiness panel', () => {
    const readiness: AppReadiness = {
      items: [
        {
          id: 'preview-video',
          label: 'Preview video',
          status: 'pass',
          detail: 'The store page shows 2 preview videos.',
          link: {
            href: 'https://developer.apple.com/app-store/product-page/',
            label: 'About the product page',
          },
        },
        {
          id: 'nominations',
          label: 'Nominations',
          status: 'pass',
          detail: 'Submitted 45 days before the publish window.',
          link: null,
        },
        {
          id: 'promotional-text',
          label: 'Promotional text',
          status: 'warn',
          detail: 'Promotional text is set for 19 of 21 localizations.',
          link: null,
        },
        {
          id: 'rating',
          label: 'Average rating',
          status: 'unmeasurable',
          detail: null,
          link: null,
        },
      ],
      editorial: { stories: 1, editorsChoiceBadge: true },
      extractAsOf: '2026-11-14',
    };
    const withReadiness: AppAuditResult = { ...v1, readiness };

    expect(withReadiness.readiness?.items[0].id).toBe('preview-video');
    expect(withReadiness.readiness?.items[1].id).toBe('nominations');
    expect(withReadiness.readiness?.items[2].id).toBe('promotional-text');
    const statuses: ReadinessStatus[] = [
      'pass',
      'warn',
      'fail',
      'unmeasurable',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('keeps the unions the web maps over', () => {
    const grades: AuditGrade[] = ['A', 'B', 'C', 'D', 'F'];
    const efforts: AuditEffort[] = ['minutes', 'hours', 'weeks'];
    const targets: AuditTarget[] = [
      'metadata',
      'keywords',
      'competitors',
      'reviews',
      'rankings',
      'store-console',
      'ai-analysis',
    ];
    const unlocks: AuditUnlockKind[] = [
      'ai-analysis',
      'keyword-field',
      'keywords',
      'competitors',
      'history',
      'reviews',
    ];
    const states: AuditAiRunState[] = [
      'queued',
      'running',
      'completed',
      'failed',
    ];

    expect([
      grades.length,
      efforts.length,
      targets.length,
      unlocks.length,
      states.length,
    ]).toEqual([5, 3, 7, 6, 4]);
  });
});
