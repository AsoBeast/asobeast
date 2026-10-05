import type { BudgetCompletion } from "@asobeast/shared";
import { formatDateTime, pluralize } from "@/lib/format";

const MINUTES_PER_HOUR = 60;

export function budgetCompletionSentence(
  { startsAt, completesAt, hours }: BudgetCompletion,
  totalRequests: number,
): string | null {
  if (startsAt === null) return null;

  const starts = `The next run starts ${formatDateTime(startsAt)}`;
  if (totalRequests === 0) return `${starts} and has nothing to collect yet.`;
  if (completesAt === null || hours === null) return `${starts}.`;
  if (hours * MINUTES_PER_HOUR < 1)
    return `${starts} and is expected to finish within a minute.`;

  return `${starts} and is expected to finish around ${formatDateTime(completesAt)}, after about ${pluralize(hours, "hour")} of collection.`;
}
