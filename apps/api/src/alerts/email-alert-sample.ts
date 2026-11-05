import { AlertBatchPayload, RANK_DEPTH } from '@asobeast/shared';

export function sampleAlertPayload(): AlertBatchPayload {
  const occurredAt = new Date().toISOString();
  return {
    event: 'alerts.batch',
    scope: 'owned_apps',
    occurredAt,
    window: { from: '2026-07-21', to: '2026-07-22' },
    totals: { events: 6, apps: 2 },
    apps: [
      {
        app: { id: 'a', name: 'Sample App', store: 'APP_STORE', country: 'us' },
        rankDrops: [
          {
            event: 'rank.dropped',
            occurredAt,
            app: { id: 'a', name: 'Sample App' },
            keyword: {
              id: 'k1',
              text: 'habit tracker',
              store: 'APP_STORE',
              country: 'us',
            },
            from: 4,
            to: 12,
            fromDepth: RANK_DEPTH,
            toDepth: RANK_DEPTH,
            threshold: 5,
          },
        ],
        rankImprovements: [],
        rankMilestones: [],
        firstRankings: [],
        overtakes: [],
        chartMoves: [
          {
            event: 'chart.entered',
            occurredAt,
            app: { id: 'a', name: 'Sample App' },
            chart: {
              store: 'APP_STORE',
              country: 'us',
              collection: 'free',
              genre: '6007',
              genreName: 'Productivity',
              device: 'iphone',
            },
            date: '2026-07-22',
            from: null,
            to: 7,
            depth: 100,
          },
        ],
        serpEntrants: [
          {
            event: 'serp.entrant',
            occurredAt,
            keyword: {
              id: 'k1',
              text: 'habit tracker',
              store: 'APP_STORE',
              country: 'us',
            },
            date: '2026-07-22',
            entrants: [
              {
                position: 3,
                storeAppId: 'newcomer',
                title: 'Newcomer',
                appId: null,
                isCompetitor: false,
              },
            ],
          },
        ],
        changes: [
          {
            event: 'metadata.changed',
            occurredAt,
            app: { id: 'a', name: 'Sample App', isCompetitor: false },
            changes: [
              { field: 'title', before: 'Old title', after: 'New title' },
            ],
          },
        ],
        negativeReviews: [
          {
            event: 'review.negative',
            occurredAt,
            app: { id: 'a', name: 'Sample App' },
            review: {
              score: 2,
              title: 'Buggy',
              text: 'Crashes on launch after the latest update.',
              version: '3.1.0',
              reviewedAt: null,
            },
          },
        ],
        actions: [],
        competitors: [],
      },
      {
        app: {
          id: 'b',
          name: 'Second App',
          store: 'GOOGLE_PLAY',
          country: 'gb',
        },
        rankDrops: [],
        rankImprovements: [
          {
            event: 'rank.improved',
            occurredAt,
            app: { id: 'b', name: 'Second App' },
            keyword: {
              id: 'k2',
              text: 'budget planner',
              store: 'GOOGLE_PLAY',
              country: 'de',
            },
            from: 18,
            to: 9,
            fromDepth: RANK_DEPTH,
            toDepth: RANK_DEPTH,
            threshold: 5,
          },
        ],
        rankMilestones: [],
        firstRankings: [],
        overtakes: [],
        serpEntrants: [],
        changes: [],
        negativeReviews: [],
        actions: [],
        competitors: [],
      },
    ],
    events: [],
  };
}
