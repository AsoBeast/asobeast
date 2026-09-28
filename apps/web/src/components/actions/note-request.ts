import type { ActionItem, ActionUpdateRequest } from "@asobeast/shared";

export const ACTION_NOTE_MAX_LENGTH = 500;

export function noteRequest(
  item: ActionItem,
  note: string,
): ActionUpdateRequest | null {
  switch (item.status) {
    case "RESOLVED":
      return null;
    case "SNOOZED":
      return item.snoozedUntil
        ? { status: "SNOOZED", snoozedUntil: item.snoozedUntil, note }
        : null;
    case "OPEN":
    case "DONE":
    case "DISMISSED":
      return { status: item.status, note };
  }
}
