import { describe, expect, it } from 'vitest';
import {
  FIRST_RUN_HISTORY_DAYS,
  FIRST_RUN_STAGES,
  RUN_STATES,
  STORE_HEALTH_SOURCES,
  STORE_HEALTH_STATES,
} from './jobs';
import type {
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
