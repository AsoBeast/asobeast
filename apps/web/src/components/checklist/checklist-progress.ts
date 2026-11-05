import type {
  WorkspaceChecklist,
  WorkspaceChecklistItem,
  WorkspaceChecklistItemId,
} from "@asobeast/shared";

export interface ChecklistProgress {
  done: number;
  total: number;
}

export const pillVisible = (checklist: WorkspaceChecklist): boolean =>
  checklist.dismissedAt === null &&
  checklist.total > 0 &&
  checklist.done < checklist.total;

export const pillLabel = (done: number, total: number): string =>
  `${done} of ${total} done`;

export function progressAnnouncement(
  previous: ChecklistProgress | null,
  current: ChecklistProgress,
): string | null {
  if (previous === null) return null;
  if (previous.done === current.done && previous.total === current.total) {
    return null;
  }
  return `Setup checklist: ${pillLabel(current.done, current.total)}`;
}

export const nextItemId = (
  items: readonly WorkspaceChecklistItem[],
): WorkspaceChecklistItemId | null =>
  items.find((item) => !item.done)?.id ?? null;

export const ringFraction = (done: number, total: number): number =>
  total === 0 ? 0 : done / total;
