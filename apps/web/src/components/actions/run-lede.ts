import type { ActionActivity, ActionSummary } from "@asobeast/shared";
import { formatNumber, pluralize } from "@/lib/format";

export const NOT_GENERATED_LEDE =
  "A prioritized list of ASO work, computed from your stored history.";

export const QUIET_RUN_LEDE = "The last run opened and closed nothing.";

const was = (count: number): string => (count === 1 ? "was" : "were");

export function runChanges(
  summary: ActionSummary,
  activity: ActionActivity,
): string[] | null {
  if (summary.generatedAt === null) return null;
  const runDay = summary.generatedAt.slice(0, 10);
  const day = activity.days.find((entry) => entry.date === runDay);
  if (!day) return [];
  const opened = day.opened + day.reopened;
  const closed = day.done + day.dismissed;
  return [
    opened > 0 ? `${pluralize(opened, "action")} opened` : null,
    closed > 0 ? `${formatNumber(closed)} ${was(closed)} closed by you` : null,
    day.resolved > 0
      ? `${formatNumber(day.resolved)} resolved on ${day.resolved === 1 ? "its" : "their"} own`
      : null,
    day.verified > 0
      ? `${formatNumber(day.verified)} ${was(day.verified)} confirmed fixed`
      : null,
  ].filter((part): part is string => part !== null);
}
