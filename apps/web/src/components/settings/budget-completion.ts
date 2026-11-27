import type { BudgetCompletion } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import { formatDateTimeInLocale } from "@/lib/format";

const MINUTES_PER_HOUR = 60;

export function budgetCompletionSentence(
  { startsAt, completesAt, hours }: BudgetCompletion,
  totalRequests: number,
  context: TranslationContext,
): string | null {
  if (startsAt === null) return null;

  const starts = formatDateTimeInLocale(startsAt, context.locale);
  if (totalRequests === 0) {
    return context.translator("capacity.completion.empty", { date: starts });
  }
  if (completesAt === null || hours === null) {
    return context.translator("capacity.completion.only", { date: starts });
  }
  if (hours * MINUTES_PER_HOUR < 1) {
    return context.translator("capacity.completion.withinMinute", {
      date: starts,
    });
  }

  return context.translator("capacity.completion.estimated", {
    date: starts,
    finish: formatDateTimeInLocale(completesAt, context.locale),
    hours,
  });
}
