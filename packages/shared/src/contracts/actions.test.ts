import { describe, expect, it } from 'vitest';
import {
  ACTION_ADVISORY_RULES,
  ACTION_CATEGORIES,
  ACTION_IMPACT_WEIGHTS,
  ACTION_PRIORITIES,
  ACTION_PRIORITY_BANDS,
  ACTION_RULES,
  ACTION_RULE_CATEGORY,
  ACTION_STATUSES,
  ACTION_UPDATE_STATUSES,
  isActionCategory,
  isActionPriority,
  isActionRule,
  isActionStatus,
} from './actions';
import type {
  ActionEvidence,
  ActionOpenedPayload,
  ActionPriority,
} from './actions';
import { WEBHOOK_EVENTS } from './changes';

const REJECTED: unknown[] = [
  '',
  null,
  undefined,
  0,
  1,
  {},
  [],
  true,
  'keyword.add',
  'OPEN ',
  'Critical',
];

const bandOf = (impact: number): ActionPriority =>
  impact >= ACTION_PRIORITY_BANDS.critical
    ? 'critical'
    : impact >= ACTION_PRIORITY_BANDS.high
      ? 'high'
      : impact >= ACTION_PRIORITY_BANDS.medium
        ? 'medium'
        : 'low';

const describeEvidence = (evidence: ActionEvidence): string => {
  switch (evidence.rule) {
    case 'keyword.add_uncovered':
      return `opportunity ${evidence.opportunity}`;
    case 'keyword.defend':
      return `entrants ${evidence.entrants.length}`;
    case 'keyword.prune':
      return `saved ${evidence.dailyRequestsSaved}`;
    case 'rank.investigate_drop':
      return `changed ${evidence.changedAt}`;
    case 'serp.hold_volatile':
      return `volatility ${evidence.volatility}`;
    case 'audit.fix_factor':
      return `factor ${evidence.factorId}`;
    case 'reviews.investigate_theme':
      return `theme ${evidence.theme}`;
    case 'market.improve_country':
      return `gap ${evidence.gap}`;
    default: {
      const never: never = evidence;
      return never;
    }
  }
};

describe('action vocabularies', () => {
  it('accepts every declared value and rejects everything else', () => {
    expect(ACTION_RULES.every(isActionRule)).toBe(true);
    expect(ACTION_STATUSES.every(isActionStatus)).toBe(true);
    expect(ACTION_PRIORITIES.every(isActionPriority)).toBe(true);
    expect(ACTION_CATEGORIES.every(isActionCategory)).toBe(true);

    for (const value of REJECTED) {
      expect(isActionRule(value)).toBe(false);
      expect(isActionStatus(value)).toBe(false);
      expect(isActionPriority(value)).toBe(false);
      expect(isActionCategory(value)).toBe(false);
    }
  });

  it('maps every rule to exactly one known category', () => {
    expect(Object.keys(ACTION_RULE_CATEGORY).sort()).toEqual(
      [...ACTION_RULES].sort(),
    );
    expect(Object.values(ACTION_RULE_CATEGORY).every(isActionCategory)).toBe(
      true,
    );
  });

  it('keeps advisory rules inside the rule vocabulary', () => {
    expect(ACTION_ADVISORY_RULES.every(isActionRule)).toBe(true);
  });

  it('excludes RESOLVED from user-settable statuses', () => {
    expect(ACTION_UPDATE_STATUSES).not.toContain('RESOLVED');
    expect(ACTION_UPDATE_STATUSES.every(isActionStatus)).toBe(true);
  });

  it('registers action.opened as a webhook event', () => {
    expect(WEBHOOK_EVENTS).toContain('action.opened');
  });
});

describe('impact constants', () => {
  it('sums the weights to exactly one', () => {
    const sum =
      ACTION_IMPACT_WEIGHTS.reach +
      ACTION_IMPACT_WEIGHTS.severity +
      ACTION_IMPACT_WEIGHTS.confidence;

    expect(Math.round(sum * 1e12) / 1e12).toBe(1);
  });

  it('bands each boundary on the documented side', () => {
    expect(bandOf(34)).toBe('low');
    expect(bandOf(35)).toBe('medium');
    expect(bandOf(59)).toBe('medium');
    expect(bandOf(60)).toBe('high');
    expect(bandOf(79)).toBe('high');
    expect(bandOf(80)).toBe('critical');
    expect(bandOf(0)).toBe('low');
    expect(bandOf(100)).toBe('critical');
  });
});

describe('action evidence', () => {
  it('is exhaustive over every rule variant', () => {
    const samples: ActionEvidence[] = [
      {
        rule: 'keyword.add_uncovered',
        opportunity: 66.5,
        traffic: 6.2,
        difficulty: 4.1,
        volume: 62,
        relevance: 80,
        latestPosition: null,
        indexedFields: ['title', 'subtitle', 'keywordField'],
        uncoveredFields: ['title', 'subtitle', 'keywordField'],
        keywordFieldCharsFree: 18,
        scoreProvenance: null,
      },
      {
        rule: 'keyword.defend',
        yourPosition: 6,
        previousPosition: 4,
        windowDays: 7,
        observedDays: 6,
        volatility: 12,
        entrants: [
          {
            storeAppId: '123',
            title: 'Rival',
            position: 3,
            appId: null,
            isCompetitor: false,
          },
        ],
        entrantsAtOrAbove: 1,
        volume: 55,
      },
      {
        rule: 'keyword.prune',
        observedDays: 40,
        checkedDays: 40,
        rankedDays: 0,
        bestPosition: null,
        volume: 3,
        traffic: 0.3,
        relevance: 20,
        dailyRequestsSaved: 1,
        budgetUtilization: 0.72,
      },
      {
        rule: 'rank.investigate_drop',
        changedAt: '2026-07-01',
        fields: ['title'],
        visibilityBefore: 42.1,
        visibilityAfter: 31.4,
        visibilityDelta: 10.7,
        windowDays: 14,
        trackedKeywords: 40,
        droppedKeywords: [
          { keywordId: 'k1', text: 'budget planner', from: 4, to: 19 },
        ],
        meanVolatility: 12,
      },
      {
        rule: 'serp.hold_volatile',
        volatility: 61,
        windowDays: 8,
        observedDays: 7,
        yourPosition: 12,
        dampenedRules: ['keyword.defend'],
      },
      {
        rule: 'audit.fix_factor',
        factorId: 'screenshots',
        factorLabel: 'Screenshots',
        score: 3,
        weight: 15,
        overall: 61,
        coveredWeight: 85,
        totalWeight: 100,
        auditDate: '2026-07-29',
        failingChecks: [
          {
            id: 'screenshot-count',
            label: 'Screenshot count',
            status: 'fail',
            score: 2,
          },
        ],
      },
      {
        rule: 'reviews.investigate_theme',
        theme: 'crashes on launch',
        version: '4.2.0',
        previousVersion: '4.1.0',
        mentions: 9,
        previousMentions: 1,
        negativeReviews: 22,
        totalReviews: 61,
        ratingAvgDelta: -0.4,
        sampleReviewIds: ['r1', 'r2'],
      },
      {
        rule: 'market.improve_country',
        country: 'de',
        homeCountry: 'us',
        marketVisibility: 18.2,
        homeVisibility: 44.7,
        gap: 26.5,
        trackedKeywords: 12,
        rankedKeywords: 4,
        observedDays: 12,
        windowDays: 14,
      },
    ];

    expect(samples.map((evidence) => evidence.rule).sort()).toEqual(
      [...ACTION_RULES].sort(),
    );
    expect(samples.map(describeEvidence)).toEqual([
      'opportunity 66.5',
      'entrants 1',
      'saved 1',
      'changed 2026-07-01',
      'volatility 61',
      'factor screenshots',
      'theme crashes on launch',
      'gap 26.5',
    ]);
  });

  it('carries a nullable link on the alert payload', () => {
    const payload: ActionOpenedPayload = {
      event: 'action.opened',
      occurredAt: '2026-07-30T03:10:00.000Z',
      app: { id: 'a1', name: 'Budget', store: 'APP_STORE', country: 'us' },
      action: {
        id: 'act1',
        rule: 'keyword.add_uncovered',
        category: 'metadata',
        priority: 'high',
        impact: 71,
        firstSeenAt: '2026-07-30T03:10:00.000Z',
        reopened: false,
      },
      keyword: { id: 'k1', text: 'budget planner' },
      evidence: {
        rule: 'keyword.add_uncovered',
        opportunity: 66.5,
        traffic: null,
        difficulty: null,
        volume: 62,
        relevance: 80,
        latestPosition: null,
        indexedFields: ['title'],
        uncoveredFields: ['title'],
        keywordFieldCharsFree: null,
        scoreProvenance: null,
      },
      link: null,
    };

    expect(payload.link).toBeNull();
    expect(ACTION_RULE_CATEGORY[payload.action.rule]).toBe(
      payload.action.category,
    );
  });
});
