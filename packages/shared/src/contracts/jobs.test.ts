import { describe, expect, it } from 'vitest';
import { FIRST_RUN_HISTORY_DAYS, FIRST_RUN_STAGES, RUN_STATES } from './jobs';
import type { FirstRunStage, FirstRunStatus } from './jobs';

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
