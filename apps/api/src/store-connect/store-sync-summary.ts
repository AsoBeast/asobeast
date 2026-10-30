export interface SyncSummary {
  apps: number;
  instances: number;
  unchanged: number;
  rows: number;
  rateLimited: boolean;
  failed: number;
  unresolved: string[];
}

export const emptySummary = (): SyncSummary => ({
  apps: 0,
  instances: 0,
  unchanged: 0,
  rows: 0,
  rateLimited: false,
  failed: 0,
  unresolved: [],
});

export const retriesFailures = (
  summary: SyncSummary,
  finalAttempt: boolean,
): boolean => !finalAttempt && !summary.rateLimited && summary.failed > 0;

export class PartialSyncRetryError extends Error {
  constructor(failed: number) {
    super(
      `${failed} failed part${failed === 1 ? '' : 's'} of the sync ${failed === 1 ? 'is' : 'are'} tried again`,
    );
    this.name = 'PartialSyncRetryError';
  }
}
