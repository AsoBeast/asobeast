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
