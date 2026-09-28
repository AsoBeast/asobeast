import {
  ACTION_FORMULA_VERSION,
  KeywordAddUncoveredEvidence,
} from '@asobeast/shared';
import { ActionRow, parseActionEvidence, toActionItem } from './actions.mapper';

const EVIDENCE: KeywordAddUncoveredEvidence = {
  rule: 'keyword.add_uncovered',
  opportunity: 66.5,
  traffic: 6.2,
  difficulty: 4.1,
  volume: 62,
  relevance: 80,
  latestPosition: null,
  indexedFields: ['title', 'subtitle', 'keywordField'],
  uncoveredFields: ['title'],
  keywordFieldCharsFree: 18,
  scoreProvenance: null,
};

const row = (overrides: Partial<ActionRow> = {}): ActionRow => ({
  id: 'act_1',
  rule: 'keyword.add_uncovered',
  category: 'metadata',
  status: 'OPEN',
  priority: 'high',
  impact: 71,
  formulaVersion: ACTION_FORMULA_VERSION,
  country: 'us',
  store: 'APP_STORE',
  evidence: EVIDENCE,
  firstSeenAt: new Date('2026-07-20T03:00:00.000Z'),
  lastSeenAt: new Date('2026-07-30T03:00:00.000Z'),
  resolvedAt: null,
  snoozedUntil: null,
  closedAt: null,
  verifiedAt: null,
  reopenCount: 0,
  note: null,
  aiExplanation: null,
  aiModel: null,
  aiGeneratedAt: null,
  app: { id: 'app_1', name: 'Budget' },
  keyword: { id: 'kw_1', text: 'budget planner' },
  ...overrides,
});

describe('toActionItem', () => {
  it('maps a healthy row onto the shared contract', () => {
    const item = toActionItem(row());

    expect(item).toMatchObject({
      id: 'act_1',
      rule: 'keyword.add_uncovered',
      category: 'metadata',
      status: 'OPEN',
      priority: 'high',
      impact: 71,
      degraded: false,
      firstSeenAt: '2026-07-20T03:00:00.000Z',
      lastSeenAt: '2026-07-30T03:00:00.000Z',
      resolvedAt: null,
      reopenCount: 0,
    });
    expect(item.evidence).toEqual(EVIDENCE);
  });

  it('reads scope names live so a rename never renders stale', () => {
    const item = toActionItem(
      row({
        app: { id: 'app_1', name: 'Renamed' },
        keyword: { id: 'kw_1', text: 'retyped phrase' },
      }),
    );

    expect(item.scope).toEqual({
      appId: 'app_1',
      appName: 'Renamed',
      store: 'APP_STORE',
      country: 'us',
      keywordId: 'kw_1',
      keywordText: 'retyped phrase',
    });
  });

  it('reports an app-scoped action with a null keyword scope', () => {
    const item = toActionItem(row({ keyword: null }));

    expect(item.scope.keywordId).toBeNull();
    expect(item.scope.keywordText).toBeNull();
  });

  it('derives the category from the rule so it can never drift', () => {
    const item = toActionItem(row({ category: 'reputation' }));

    expect(item.category).toBe('metadata');
  });

  it('emits every timestamp as an ISO string or null', () => {
    const item = toActionItem(
      row({
        resolvedAt: new Date('2026-07-25T00:00:00.000Z'),
        snoozedUntil: new Date('2026-08-05T00:00:00.000Z'),
        closedAt: new Date('2026-07-26T00:00:00.000Z'),
        verifiedAt: new Date('2026-07-29T00:00:00.000Z'),
        aiGeneratedAt: new Date('2026-07-27T00:00:00.000Z'),
        aiExplanation: 'Summary',
        aiModel: 'gpt-4o',
      }),
    );

    expect(item).toMatchObject({
      resolvedAt: '2026-07-25T00:00:00.000Z',
      snoozedUntil: '2026-08-05T00:00:00.000Z',
      closedAt: '2026-07-26T00:00:00.000Z',
      verifiedAt: '2026-07-29T00:00:00.000Z',
    });
    expect(item.ai).toEqual({
      explanation: 'Summary',
      model: 'gpt-4o',
      generatedAt: '2026-07-27T00:00:00.000Z',
    });
  });

  describe('degraded rows', () => {
    const degradedCases: Array<[string, unknown]> = [
      ['null evidence', null],
      ['a primitive', 'broken'],
      ['an array', []],
      ['a mismatched rule', { ...EVIDENCE, rule: 'keyword.defend' }],
      ['a missing required field', { rule: 'keyword.add_uncovered' }],
    ];

    it.each(degradedCases)('marks %s as degraded', (_label, evidence) => {
      const item = toActionItem(row({ evidence }));

      expect(item.degraded).toBe(true);
      expect(item.evidence).toBeNull();
      expect(item.id).toBe('act_1');
    });

    it('never throws and never leaks the raw payload', () => {
      const item = toActionItem(
        row({ evidence: { rule: 'keyword.add_uncovered', secret: 'token' } }),
      );

      expect(item.evidence).toBeNull();
      expect(JSON.stringify(item)).not.toContain('token');
    });
  });

  it('falls back to safe values for an unknown stored vocabulary', () => {
    const item = toActionItem(
      row({ rule: 'mystery', status: 'WEIRD', priority: 'urgent' }),
    );

    expect(item.status).toBe('OPEN');
    expect(item.priority).toBe('low');
    expect(item.degraded).toBe(true);
  });
});

describe('parseActionEvidence', () => {
  it('accepts each variant carrying its required fields', () => {
    expect(
      parseActionEvidence('serp.hold_volatile', {
        rule: 'serp.hold_volatile',
        volatility: 61,
        observedDays: 7,
        dampenedRules: ['keyword.defend'],
      }),
    ).not.toBeNull();
  });

  it('accepts a push evidence and degrades one missing its position', () => {
    const push = {
      rule: 'keyword.push_to_top10',
      latestPosition: 12,
      daysInBand: 6,
      coveredFields: ['keywordField'],
    };

    expect(parseActionEvidence('keyword.push_to_top10', push)).not.toBeNull();
    expect(
      parseActionEvidence('keyword.push_to_top10', {
        ...push,
        latestPosition: undefined,
      }),
    ).toBeNull();
  });

  it('accepts a lint evidence and degrades one missing its issues', () => {
    const lint = {
      rule: 'metadata.fix_lint',
      field: 'title',
      chars: 34,
      limit: 30,
      issues: [],
    };

    expect(parseActionEvidence('metadata.fix_lint', lint)).not.toBeNull();
    expect(
      parseActionEvidence('metadata.fix_lint', { ...lint, issues: undefined }),
    ).toBeNull();
  });

  it('accepts an unexplained drop evidence and degrades one missing its delta', () => {
    const drop = {
      rule: 'rank.investigate_unexplained_drop',
      country: 'us',
      visibilityDelta: 7.5,
      droppedKeywords: [],
    };

    expect(
      parseActionEvidence('rank.investigate_unexplained_drop', drop),
    ).not.toBeNull();
    expect(
      parseActionEvidence('rank.investigate_unexplained_drop', {
        ...drop,
        visibilityDelta: undefined,
      }),
    ).toBeNull();
  });

  it('accepts an overtake evidence and degrades one missing its keywords', () => {
    const overtake = {
      rule: 'competitor.investigate_overtake',
      competitorAppId: 'comp_1',
      changedAt: '2026-07-27',
      fields: ['title'],
      keywords: [],
    };

    expect(
      parseActionEvidence('competitor.investigate_overtake', overtake),
    ).not.toBeNull();
    expect(
      parseActionEvidence('competitor.investigate_overtake', {
        ...overtake,
        keywords: undefined,
      }),
    ).toBeNull();
  });

  it('accepts a rating decline evidence and degrades one missing its drop', () => {
    const decline = {
      rule: 'reviews.investigate_rating_decline',
      recentAverage: 3.5,
      baselineAverage: 4.5,
      drop: 1,
      sampleReviewIds: [],
    };

    expect(
      parseActionEvidence('reviews.investigate_rating_decline', decline),
    ).not.toBeNull();
    expect(
      parseActionEvidence('reviews.investigate_rating_decline', {
        ...decline,
        drop: undefined,
      }),
    ).toBeNull();
  });

  it('accepts a reply evidence and degrades one missing its unanswered count', () => {
    const reply = {
      rule: 'reviews.reply_negative',
      unanswered: 3,
      checked: 4,
      sampleReviewIds: [],
    };

    expect(parseActionEvidence('reviews.reply_negative', reply)).not.toBeNull();
    expect(
      parseActionEvidence('reviews.reply_negative', {
        ...reply,
        unanswered: undefined,
      }),
    ).toBeNull();
  });

  it('accepts a stale listing evidence and degrades one missing its age', () => {
    const stale = {
      rule: 'listing.ship_update',
      storeUpdatedAt: '2026-03-10T00:00:00.000Z',
      daysSinceUpdate: 142,
    };

    expect(parseActionEvidence('listing.ship_update', stale)).not.toBeNull();
    expect(
      parseActionEvidence('listing.ship_update', {
        ...stale,
        daysSinceUpdate: undefined,
      }),
    ).toBeNull();
  });

  it('rejects an unknown rule', () => {
    expect(parseActionEvidence('mystery', { rule: 'mystery' })).toBeNull();
  });
});
