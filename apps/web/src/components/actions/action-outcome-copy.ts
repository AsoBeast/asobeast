import {
  RANK_DEPTH,
  type ActionOutcome,
  type ActionOutcomeVerdict,
} from "@asobeast/shared";
import { formatDate, formatMeasure } from "@/lib/format";
import { TREND_METRIC_LABEL } from "./action-trend-chart";

export const OUTCOME_VERDICT_LABEL: Record<ActionOutcomeVerdict, string> = {
  improved: "Improved",
  worsened: "Worsened",
  unchanged: "No change",
  pending: "Measuring",
};

export const OUTCOME_CAVEAT =
  "Other changes in the same days can also move this number.";

function valueOf(
  outcome: ActionOutcome,
  value: number | null,
  depth: number,
): string {
  if (outcome.metric !== "position") {
    return value === null ? "—" : formatMeasure(value);
  }
  return value === null ? `not in the top ${depth}` : `#${value}`;
}

export function outcomeSentence(
  outcome: ActionOutcome,
  depth: number | null,
): string {
  if (outcome.verdict === "pending") {
    const from = outcome.beforeDate ?? outcome.afterDate;
    return `${from ? `Measured from ${formatDate(from)}. ` : ""}AsoBeast needs three days of data after you marked it done.`;
  }
  const scale = depth ?? RANK_DEPTH;
  const label = TREND_METRIC_LABEL[outcome.metric];
  return `${label} ${valueOf(outcome, outcome.before, scale)} → ${valueOf(outcome, outcome.after, scale)} between ${formatDate(outcome.beforeDate)} and ${formatDate(outcome.afterDate)}.`;
}
