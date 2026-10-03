import type { BudgetQuota, QuotaUsage } from "@asobeast/shared";
import { formatNumber, formatPlanLimit } from "@/lib/format";

export function hasNoCapacity({ limit }: QuotaUsage): boolean {
  return limit === 0;
}

export function formatQuotaUsage(
  usage: QuotaUsage,
  counted = "tracked",
): string {
  if (hasNoCapacity(usage)) {
    return `${formatNumber(usage.used)} ${counted}, none included`;
  }
  return `${formatNumber(usage.used)} of ${formatPlanLimit(usage.limit)}`;
}

export function keywordLimitExceededSince(
  quota: BudgetQuota | null,
): string | null {
  if (!quota?.overLimitSince || hasNoCapacity(quota.keywordMarkets)) {
    return null;
  }
  return quota.overLimitSince;
}
