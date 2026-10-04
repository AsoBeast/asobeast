import type { BudgetCompletion } from "@asobeast/shared";
import { formatDateTime, pluralize } from "@/lib/format";

export function budgetCompletionSentence({
  startsAt,
  completesAt,
  hours,
}: BudgetCompletion): string | null {
  if (startsAt === null) return null;

  const starts = `The next run starts ${formatDateTime(startsAt)}`;
  if (completesAt === null || hours === null) return `${starts}.`;
  if (hours === 0) return `${starts} and has nothing to collect yet.`;

  return `${starts} and is expected to finish around ${formatDateTime(completesAt)}, after about ${pluralize(hours, "hour")} of collection.`;
}
