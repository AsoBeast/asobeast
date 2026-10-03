import type { FilterChip } from "@/components/data-table/FilterChips";

export function workspaceChip(
  workspaceId: string | null,
  rows: readonly { workspaceId: string; workspaceName: string }[],
  onRemove: () => void,
): FilterChip[] {
  if (workspaceId === null) return [];
  const name =
    rows.find((row) => row.workspaceId === workspaceId)?.workspaceName ??
    workspaceId;
  return [{ key: "workspace", label: `Workspace: ${name}`, onRemove }];
}
