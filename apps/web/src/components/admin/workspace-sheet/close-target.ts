const WORKSPACE_SEARCH = 'input[aria-label="Search workspaces"]';

export function workspaceCloseTarget(
  root: ParentNode,
  workspaceId: string,
): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>(
      `[data-workspace-sheet="${CSS.escape(workspaceId)}"]`,
    ) ?? root.querySelector<HTMLElement>(WORKSPACE_SEARCH)
  );
}
