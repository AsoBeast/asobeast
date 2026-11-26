import type { AiAllowanceDetail, AiCallUsage } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import { formatDateInLocale } from "@/lib/format";

export function aiRenewalText(
  resetsAt: string,
  context: TranslationContext,
): string {
  return context.translator("ai.renewal", {
    date: formatDateInLocale(resetsAt, context.locale),
  });
}

export function aiAllowanceSpent(usage: AiCallUsage | undefined): boolean {
  return (
    usage !== undefined && usage.limit !== null && usage.used >= usage.limit
  );
}

export function aiUsageNote(
  usage: AiCallUsage,
  trialing: boolean,
  context: TranslationContext,
): string | undefined {
  if (usage.limit === 0) return undefined;
  const renewal = aiRenewalText(usage.resetsAt, context);
  return trialing
    ? context.translator("ai.usageNoteTrial", {
        renewal,
        trial: context.translator("ai.trialAllowance"),
      })
    : renewal;
}

export function aiCallsLeftText(
  usage: AiCallUsage,
  context: TranslationContext,
): string | null {
  if (usage.limit === null) return null;
  if (usage.limit === 0) return context.translator("ai.noCalls");
  const renewal = aiRenewalText(usage.resetsAt, context);
  if (aiAllowanceSpent(usage)) {
    return context.translator("ai.spent", { renewal });
  }
  return context.translator("ai.callsLeft", {
    left: usage.limit - usage.used,
    limit: usage.limit,
  });
}

export function aiAllowanceRefusal(
  detail: AiAllowanceDetail,
  context: TranslationContext,
): string {
  if (detail.limit === 0) {
    return `${context.translator("ai.noCalls")}.`;
  }
  return context.translator("ai.refusal", {
    limit: detail.limit,
    renewal: aiRenewalText(detail.resetsAt, context),
  });
}
