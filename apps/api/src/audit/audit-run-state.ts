import { AuditAiRun } from '@asobeast/shared';

export const CREATIVE_RUN_TIMEOUT_MS = 10 * 60 * 1000;
export const CREATIVE_RUN_ATTEMPTS = 2;
export const CREATIVE_RUN_BACKOFF_MS = 15_000;

export const COMPETITOR_RUN_MESSAGE =
  'Creative analysis runs on your own apps.';
export const NOTHING_TO_ANALYZE_MESSAGE =
  'This listing has no icon or screenshots to analyze yet. Refresh the app, then try again.';
export const RUN_UNFINISHED_MESSAGE = 'The analysis did not finish. Try again.';
export const RUN_NOT_QUEUED_MESSAGE =
  'The analysis could not be queued. Try again.';

export const ACTIVE_STATES = ['queued', 'running'] as const;

export interface StoredRun {
  runState: string;
  runError: string | null;
  requestedAt: Date | null;
  generatedAt: Date | null;
}

export const isActive = (state: string): boolean =>
  (ACTIVE_STATES as readonly string[]).includes(state);

export const expired = (run: StoredRun, now: Date): boolean =>
  run.requestedAt === null ||
  now.getTime() - run.requestedAt.getTime() > CREATIVE_RUN_TIMEOUT_MS;

export function effectiveRun(
  run: StoredRun | null,
  now: Date,
): AuditAiRun | null {
  if (run === null) {
    return null;
  }
  const requestedAt = run.requestedAt?.toISOString() ?? null;
  if (isActive(run.runState)) {
    return expired(run, now)
      ? {
          state: 'failed',
          requestedAt,
          finishedAt: null,
          error: RUN_UNFINISHED_MESSAGE,
        }
      : {
          state: run.runState === 'running' ? 'running' : 'queued',
          requestedAt,
          finishedAt: null,
          error: null,
        };
  }
  if (run.runState === 'failed') {
    return {
      state: 'failed',
      requestedAt,
      finishedAt: null,
      error: run.runError,
    };
  }
  return {
    state: 'completed',
    requestedAt,
    finishedAt: run.generatedAt?.toISOString() ?? null,
    error: null,
  };
}
