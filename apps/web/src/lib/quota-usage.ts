import type { QuotaUsage } from "@asobeast/shared";
import { formatNumber, formatPlanLimit } from "@/lib/format";

export function hasNoCapacity({ limit }: QuotaUsage): boolean {
  return limit === 0;
}

export function formatQuotaUsage(usage: QuotaUsage): string {
  if (hasNoCapacity(usage)) {
    return `${formatNumber(usage.used)} tracked, none included`;
  }
  return `${formatNumber(usage.used)} of ${formatPlanLimit(usage.limit)}`;
}
