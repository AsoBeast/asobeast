export interface SyncSummary {
  apps: number;
  instances: number;
  unchanged: number;
  rows: number;
  rateLimited: boolean;
  failed: number;
  unresolved: string[];
  fields: number;
  fieldsChanged: number;
}

export const emptySummary = (): SyncSummary => ({
  apps: 0,
  instances: 0,
  unchanged: 0,
  rows: 0,
  rateLimited: false,
  failed: 0,
  unresolved: [],
  fields: 0,
  fieldsChanged: 0,
});
