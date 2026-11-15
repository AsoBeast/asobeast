export const DELETION_CONFIRMATION = 'DELETE';

export const DELETION_REASONS = [
  'too-expensive',
  'missing-feature',
  'not-using',
  'switched-tool',
  'other',
] as const;

export type DeletionReason = (typeof DELETION_REASONS)[number];

export interface WorkspaceDeletionRequest {
  confirm: string;
  reason?: DeletionReason;
}

export interface WorkspaceDeletionStatus {
  scheduled: boolean;
  requestedAt: string | null;
  requestedBy: string | null;
  dueAt: string | null;
  graceDays: number;
}

export interface WorkspaceExportTable {
  table: string;
  rows: number;
}

export interface WorkspaceExportManifest {
  workspaceId: string;
  exportedAt: string;
  format: 'ndjson';
  tables: WorkspaceExportTable[];
}
