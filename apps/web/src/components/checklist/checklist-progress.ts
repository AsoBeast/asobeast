import type {
  WorkspaceChecklist,
  WorkspaceChecklistItem,
  WorkspaceChecklistItemId,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

export interface ChecklistProgress {
  done: number;
  total: number;
}

export const pillVisible = (checklist: WorkspaceChecklist): boolean =>
  checklist.dismissedAt === null &&
  checklist.total > 0 &&
  checklist.done < checklist.total;

export const pillLabel = (
  done: number,
  total: number,
  translator: MessageTranslator,
): string => translator("checklist.progress", { done, total });

export function progressAnnouncement(
  previous: ChecklistProgress | null,
  current: ChecklistProgress,
  translator: MessageTranslator,
): string | null {
  if (previous === null) return null;
  if (previous.done === current.done && previous.total === current.total) {
    return null;
  }
  return translator("checklist.announcement", {
    progress: pillLabel(current.done, current.total, translator),
  });
}

export const nextItemId = (
  items: readonly WorkspaceChecklistItem[],
): WorkspaceChecklistItemId | null =>
  items.find((item) => !item.done)?.id ?? null;

export const ringFraction = (done: number, total: number): number =>
  total === 0 ? 0 : done / total;
