export function workspaceCloseTarget(
  root: ParentNode,
  workspaceId: string,
  searchLabel: string,
): HTMLElement | null {
  const search = CSS.escape(searchLabel);
  return (
    root.querySelector<HTMLElement>(
      `[data-workspace-sheet="${CSS.escape(workspaceId)}"]`,
    ) ?? root.querySelector<HTMLElement>(`input[aria-label="${search}"]`)
  );
}
