import type { ActionOpenedPayload } from '@asobeast/shared';
import {
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  RankFirstPayload,
  RankImprovedPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
  ReviewNegativePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { outboxRows } from './outbox-rows';

const milestone: RankMilestonePayload = {
  event: 'rank.milestone',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'app1', name: 'App One' },
  keyword: { id: 'kw1', text: 'game', store: 'APP_STORE', country: 'us' },
  tier: 10,
  direction: 'entered',
  from: 14,
  to: 8,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
};

const firstRanking: RankFirstPayload = {
  event: 'rank.first',
  occurredAt: milestone.occurredAt,
  app: milestone.app,
  keyword: milestone.keyword,
  position: 37,
  depth: RANK_DEPTH,
};

const overtake: RankOvertakenPayload = {
  event: 'rank.overtaken',
  occurredAt: milestone.occurredAt,
  app: milestone.app,
  keyword: milestone.keyword,
  competitor: { id: 'c1', name: 'Rival', from: 9, to: 4 },
  from: 5,
  to: 6,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
};

const actionOpened: ActionOpenedPayload = {
  event: 'action.opened',
  occurredAt: '2026-07-30T03:10:00.000Z',
  app: { id: 'a', name: 'Alpha', store: 'APP_STORE', country: 'us' },
  action: {
    id: 'act_1',
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
    indexedFields: ['title', 'subtitle', 'keywordField'],
    uncoveredFields: ['title', 'subtitle', 'keywordField'],
    keywordFieldCharsFree: 18,
    scoreProvenance: null,
  },
  link: null,
};

describe('outboxRows', () => {
  it('splits a multi-field metadata change into one row per field', () => {
    const payload: MetadataChangedPayload = {
      event: 'metadata.changed',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'app1', name: 'App One', isCompetitor: false },
      changes: [
        { field: 'title', before: 'a', after: 'b' },
        { field: 'subtitle', before: 'c', after: 'd' },
      ],
    };

    const rows = outboxRows(payload);

    expect(rows).toHaveLength(2);
    expect(rows[0].dedupeKey).toBe('change:app1:title:2026-07-22');
    expect(rows[1].dedupeKey).toBe('change:app1:subtitle:2026-07-22');
    expect((rows[0].payload as MetadataChangedPayload).changes).toHaveLength(1);
    expect(rows[0].appId).toBe('app1');
  });

  it('keys a rank alert by app, keyword and day', () => {
    const payload: RankDroppedPayload = {
      event: 'rank.dropped',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'app1', name: 'App One' },
      keyword: { id: 'kw1', text: 'game' },
      from: 3,
      to: 12,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    };

    const [row] = outboxRows(payload);

    expect(row.dedupeKey).toBe('rank:app1:kw1:2026-07-22');
    expect(row.appId).toBe('app1');
  });

  it('keys a serp entrant by keyword and its date, with no app', () => {
    const payload: SerpEntrantPayload = {
      event: 'serp.entrant',
      occurredAt: '2026-07-22T10:00:00.000Z',
      keyword: { id: 'kw1', text: 'game' },
      date: '2026-07-22',
      entrants: [],
    };

    const [row] = outboxRows(payload);

    expect(row.dedupeKey).toBe('entrant:kw1:2026-07-22');
    expect(row.appId).toBeNull();
  });

  it('fingerprints a review so distinct reviews do not collide', () => {
    const base: ReviewNegativePayload = {
      event: 'review.negative',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'app1', name: 'App One' },
      review: {
        score: 1,
        title: 'Bad',
        text: 'crashes',
        version: '1.0',
        reviewedAt: '2026-07-22T09:00:00.000Z',
      },
    };
    const other: ReviewNegativePayload = {
      ...base,
      review: { ...base.review, text: 'freezes' },
    };

    expect(outboxRows(base)[0].dedupeKey).not.toBe(
      outboxRows(other)[0].dedupeKey,
    );
    expect(outboxRows(base)[0].dedupeKey).toBe(outboxRows(base)[0].dedupeKey);
  });
});

describe('outboxRows for action.opened', () => {
  it('dedupes on the action identity, not on its magnitudes', () => {
    const rows = outboxRows(actionOpened);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'action.opened',
      appId: 'a',
      dedupeKey: 'action.opened~act_1',
    });
  });

  it('gives a reopened action the same dedupe key as its first notification', () => {
    const reopened = {
      ...actionOpened,
      action: { ...actionOpened.action, reopened: true, impact: 90 },
    };

    expect(outboxRows(reopened)[0].dedupeKey).toBe(
      outboxRows(actionOpened)[0].dedupeKey,
    );
  });
});

describe('outboxRows for the rank milestone events', () => {
  it('keys a milestone on the owned app, keyword and day', () => {
    expect(outboxRows(milestone)).toEqual([
      {
        event: 'rank.milestone',
        appId: 'app1',
        dedupeKey: 'milestone:app1:kw1:2026-07-22',
        payload: milestone,
      },
    ]);
  });

  it('keys a first ranking on the owned app, keyword and day', () => {
    expect(outboxRows(firstRanking)).toEqual([
      {
        event: 'rank.first',
        appId: 'app1',
        dedupeKey: 'first:app1:kw1:2026-07-22',
        payload: firstRanking,
      },
    ]);
  });

  it('keys an overtake on each competitor', () => {
    const second: RankOvertakenPayload = {
      ...overtake,
      competitor: { ...overtake.competitor, id: 'c2' },
    };

    expect(
      [overtake, second].flatMap(outboxRows).map((row) => row.dedupeKey),
    ).toEqual([
      'overtaken:app1:kw1:c1:2026-07-22',
      'overtaken:app1:kw1:c2:2026-07-22',
    ]);
  });

  it('never shares a key with the rank alert of the same move', () => {
    const improved: RankImprovedPayload = {
      event: 'rank.improved',
      occurredAt: milestone.occurredAt,
      app: milestone.app,
      keyword: milestone.keyword,
      from: 14,
      to: 8,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    };

    const [milestoneRow] = outboxRows(milestone);
    const [improvedRow] = outboxRows(improved);

    expect(milestoneRow.dedupeKey).not.toBe(improvedRow.dedupeKey);
  });
});
