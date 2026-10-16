import { describe, expect, it } from 'vitest';
import {
  APP_RUN_STAGES,
  appRunTotals,
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  RUN_STATES,
  STORE_HEALTH_SOURCES,
  STORE_HEALTH_STATES,
} from './jobs';
import type {
  AppRunStage,
  AppRunStatus,
  FirstRunStage,
  FirstRunStatus,
  StoreHealthReport,
  StoreHealthSource,
  StoreHealthState,
} from './jobs';

const EVERY_HEALTH_STATE: Record<StoreHealthState, true> = {
  ok: true,
  broken: true,
  unreachable: true,
  unknown: true,
};

const EVERY_HEALTH_SOURCE: Record<StoreHealthSource, true> = {
  canary: true,
  published: true,
};

const EVERY_STAGE: Record<FirstRunStage, true> = {
  metadata: true,
  keywords: true,
  rankings: true,
  scores: true,
  reviews: true,
  history: true,
};

describe('first run stages', () => {
  it('lists every stage exactly once', () => {
    expect([...FIRST_RUN_STAGES].sort()).toEqual(
      Object.keys(EVERY_STAGE).sort(),
    );
    expect(new Set(FIRST_RUN_STAGES).size).toBe(FIRST_RUN_STAGES.length);
  });

  it('keeps the stages disjoint from the workspace run states', () => {
    const states: string[] = [...RUN_STATES];
    expect(FIRST_RUN_STAGES.some((stage) => states.includes(stage))).toBe(
      false,
    );
  });

  it('needs a week of captures before the trend rules can read anything', () => {
    expect(FIRST_RUN_HISTORY_DAYS).toBe(7);
  });

  it('calls an envelope complete only when every stage is', () => {
    const status: FirstRunStatus = {
      appId: 'app-1',
      complete: true,
      stages: FIRST_RUN_STAGES.map((stage) => ({
        stage,
        ready: 1,
        total: 1,
        complete: true,
        expectedBy: null,
      })),
    };

    expect(status.stages).toHaveLength(FIRST_RUN_STAGES.length);
    expect(status.complete).toBe(
      status.stages.every((stage) => stage.complete),
    );
  });
});

describe('store health', () => {
  it('lists every state exactly once', () => {
    expect([...STORE_HEALTH_STATES].sort()).toEqual(
      Object.keys(EVERY_HEALTH_STATE).sort(),
    );
    expect(new Set(STORE_HEALTH_STATES).size).toBe(STORE_HEALTH_STATES.length);
  });

  it('lists every source exactly once, published included from the start', () => {
    expect([...STORE_HEALTH_SOURCES].sort()).toEqual(
      Object.keys(EVERY_HEALTH_SOURCE).sort(),
    );
    expect(STORE_HEALTH_SOURCES).toContain('published');
  });

  it('keeps the health states disjoint from the workspace run states', () => {
    const states: string[] = [...RUN_STATES];
    expect(STORE_HEALTH_STATES.some((state) => states.includes(state))).toBe(
      false,
    );
  });

  it('calls a report degraded only when a store is broken', () => {
    const report: StoreHealthReport = {
      stores: [
        {
          store: 'APP_STORE',
          state: 'broken',
          source: 'canary',
          since: '2026-08-28T02:00:00.000Z',
          checkedAt: '2026-08-28T08:00:00.000Z',
          detail: 'parsed app is missing title',
        },
        {
          store: 'GOOGLE_PLAY',
          state: 'unreachable',
          source: 'canary',
          since: null,
          checkedAt: '2026-08-28T08:00:00.000Z',
          detail: null,
        },
      ],
      degraded: true,
    };

    expect(report.degraded).toBe(
      report.stores.some((store) => store.state === 'broken'),
    );
  });
});

describe('the app run status', () => {
  it('lists every app run stage exactly once, in the order the pill shows them', () => {
    const every: Record<AppRunStage, true> = {
      listings: true,
      keywords: true,
      categories: true,
    };

    expect(APP_RUN_STAGES).toEqual(['listings', 'keywords', 'categories']);
    expect(new Set(APP_RUN_STAGES).size).toBe(Object.keys(every).length);
  });

  it('sums the counts of a status', () => {
    const status: Pick<AppRunStatus, 'stages'> = {
      stages: [
        { stage: 'listings', ready: 2, total: 6, complete: false },
        { stage: 'keywords', ready: 12, total: 40, complete: false },
        { stage: 'categories', ready: 1, total: 1, complete: true },
      ],
    };

    expect(appRunTotals(status)).toEqual({ ready: 15, total: 47 });
    expect(appRunTotals({ stages: [] })).toEqual({ ready: 0, total: 0 });
  });

  it('keeps the run states closed and the paused flag optional', () => {
    const base = {
      appId: 'app_1',
      date: '2026-10-16',
      state: 'running',
      startedAt: '2026-10-16T03:00:00.000Z',
      lastCaptureAt: null,
      stages: [],
    } satisfies AppRunStatus;
    const paused = { ...base, paused: true } satisfies AppRunStatus;

    expect([...RUN_STATES]).toEqual(['idle', 'running', 'complete', 'delayed']);
    expect(base).not.toHaveProperty('paused');
    expect(paused.paused).toBe(true);
  });
});
