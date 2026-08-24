export const DELETION_CONFIRMATION = 'DELETE';

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
