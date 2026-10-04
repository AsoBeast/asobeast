import {
  NO_AI_CALLS_MESSAGE,
  type AiAllowanceDetail,
  type AiCallUsage,
} from "@asobeast/shared";
import { formatDate, formatNumber } from "@/lib/format";

export function aiRenewalText(resetsAt: string): string {
  return `Renews ${formatDate(resetsAt)}`;
}

export function aiAllowanceSpent(usage: AiCallUsage | undefined): boolean {
  return (
    usage !== undefined && usage.limit !== null && usage.used >= usage.limit
  );
}

export function aiUsageNote(usage: AiCallUsage): string | undefined {
  return usage.limit === 0 ? undefined : aiRenewalText(usage.resetsAt);
}

export function aiCallsLeftText(usage: AiCallUsage): string | null {
  if (usage.limit === null) return null;
  if (usage.limit === 0) return NO_AI_CALLS_MESSAGE;
  if (aiAllowanceSpent(usage)) {
    return `AI calls used up. ${aiRenewalText(usage.resetsAt)}`;
  }
  return `${formatNumber(usage.limit - usage.used)} of ${formatNumber(usage.limit)} AI calls left this month`;
}

export function aiAllowanceRefusal(detail: AiAllowanceDetail): string {
  if (detail.limit === 0) return `${NO_AI_CALLS_MESSAGE}.`;
  return `This workspace has used the ${formatNumber(detail.limit)} AI calls its plan includes this month. ${aiRenewalText(detail.resetsAt)}.`;
}
