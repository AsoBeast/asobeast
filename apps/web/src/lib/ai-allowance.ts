import type { AiAllowanceDetail, AiCallUsage } from "@asobeast/shared";
import { formatDate, formatNumber } from "@/lib/format";

export function aiRenewalText(resetsAt: string): string {
  return `Renews ${formatDate(resetsAt)}`;
}

export function aiAllowanceSpent(usage: AiCallUsage | undefined): boolean {
  return (
    usage !== undefined && usage.limit !== null && usage.used >= usage.limit
  );
}

export function aiCallsLeftText(usage: AiCallUsage): string | null {
  if (usage.limit === null) return null;
  if (usage.limit === 0) return "This plan includes no AI calls";
  if (aiAllowanceSpent(usage)) {
    return `AI calls used up. ${aiRenewalText(usage.resetsAt)}`;
  }
  return `${formatNumber(usage.limit - usage.used)} of ${formatNumber(usage.limit)} AI calls left this month`;
}

export function aiAllowanceRefusal(detail: AiAllowanceDetail): string {
  return `This workspace has used the ${formatNumber(detail.limit)} AI calls its plan includes this month. ${aiRenewalText(detail.resetsAt)}.`;
}
