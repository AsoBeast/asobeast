import type { BudgetQuota, QuotaUsage } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";

export type QuotaCounted = "tracked" | "followed" | "used";

export function hasNoCapacity({ limit }: QuotaUsage): boolean {
  return limit === 0;
}

export function formatQuotaUsage(
  usage: QuotaUsage,
  counted: QuotaCounted,
  context: TranslationContext,
): string {
  if (hasNoCapacity(usage)) {
    return context.translator("quota.noneIncluded", {
      used: usage.used,
      counted,
    });
  }
  return context.translator(
    usage.limit === null ? "quota.unlimited" : "quota.of",
    {
      used: usage.used,
      ...(usage.limit === null ? {} : { limit: usage.limit }),
    },
  );
}

export function keywordLimitExceededSince(
  quota: BudgetQuota | null,
): string | null {
  if (!quota?.overLimitSince || hasNoCapacity(quota.keywordMarkets)) {
    return null;
  }
  return quota.overLimitSince;
}
