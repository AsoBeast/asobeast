import { adminSearchLabel, WORKSPACE_NOUN } from "../admin-search";

export function workspaceCloseTarget(
  root: ParentNode,
  workspaceId: string,
): HTMLElement | null {
  const search = CSS.escape(adminSearchLabel(WORKSPACE_NOUN));
  return (
    root.querySelector<HTMLElement>(
      `[data-workspace-sheet="${CSS.escape(workspaceId)}"]`,
    ) ?? root.querySelector<HTMLElement>(`input[aria-label="${search}"]`)
  );
}
