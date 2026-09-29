import type { ActionItem } from "@asobeast/shared";
import { formatDate } from "@/lib/format";

export interface ActionStatusTag {
  label: string;
  tone: "warning" | "success" | "neutral";
}

function doneTag(item: ActionItem): ActionStatusTag {
  if (item.verifiedAt) return { label: "Confirmed fixed", tone: "success" };
  const stillDetected =
    item.closedAt !== null && item.lastSeenAt > item.closedAt;
  return stillDetected
    ? { label: "Still detected", tone: "warning" }
    : { label: "Verifying", tone: "neutral" };
}

export function actionStatusTag(item: ActionItem): ActionStatusTag | null {
  if (item.degraded) return { label: "Evidence unavailable", tone: "warning" };
  switch (item.status) {
    case "SNOOZED":
      return item.snoozedUntil
        ? {
            label: `Snoozed until ${formatDate(item.snoozedUntil)}`,
            tone: "warning",
          }
        : { label: "Snoozed", tone: "warning" };
    case "DONE":
      return doneTag(item);
    case "RESOLVED":
      return { label: "Resolved on its own", tone: "neutral" };
    case "DISMISSED":
    case "OPEN":
      return item.reopenCount > 0
        ? { label: `Reopened ${item.reopenCount}×`, tone: "neutral" }
        : null;
  }
}
