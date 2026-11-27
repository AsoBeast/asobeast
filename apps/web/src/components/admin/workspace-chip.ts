import type { FilterChip } from "@/components/data-table/FilterChips";
import type { MessageTranslator } from "@/i18n/translator";

export function workspaceChip(
  workspaceId: string | null,
  rows: readonly { workspaceId: string; workspaceName: string }[],
  onRemove: () => void,
  translator: MessageTranslator,
): FilterChip[] {
  if (workspaceId === null) return [];
  const name =
    rows.find((row) => row.workspaceId === workspaceId)?.workspaceName ??
    workspaceId;
  return [
    {
      key: "workspace",
      label: translator("workspaces.workspaceChip", { name }),
      onRemove,
    },
  ];
}
