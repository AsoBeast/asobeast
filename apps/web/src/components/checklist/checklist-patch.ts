import {
  orderChecklistItems,
  type WorkspaceChecklist,
  type WorkspaceChecklistUpdateRequest,
} from "@asobeast/shared";

function dismissedAtAfter(
  current: string | null,
  dismissed: boolean | undefined,
  now: Date,
): string | null {
  if (dismissed === undefined) return current;
  return dismissed ? (current ?? now.toISOString()) : null;
}

export function applyChecklistPatch(
  checklist: WorkspaceChecklist,
  patch: WorkspaceChecklistUpdateRequest,
  now: Date,
): WorkspaceChecklist {
  const goal = patch.goal === undefined ? checklist.goal : patch.goal;
  return {
    ...checklist,
    goal,
    dismissedAt: dismissedAtAfter(checklist.dismissedAt, patch.dismissed, now),
    items: orderChecklistItems(checklist.items, goal),
  };
}
