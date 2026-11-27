import {
  RANK_DEPTH,
  type ActionOutcome,
  type ActionOutcomeVerdict,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatDateInLocale } from "@/lib/format";
import { metricValue } from "./action-trend-chart";

export const OUTCOME_VERDICT_LABEL: Record<ActionOutcomeVerdict, string> = {
  improved: "Improved",
  worsened: "Worsened",
  unchanged: "No change",
  pending: "Measuring",
};

export const OUTCOME_CAVEAT =
  "Other changes in the same days can also move this number.";

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

const VERDICT_KEY = {
  improved: "improved",
  worsened: "worsened",
  unchanged: "unchanged",
  pending: "measuring",
} as const satisfies Record<
  ActionOutcomeVerdict,
  keyof typeof enActions.outcome
>;

export const outcomeVerdictLabel = (
  verdict: ActionOutcomeVerdict,
  t: MessageTranslator = english,
): string => t(`outcome.${VERDICT_KEY[verdict]}`);

export const outcomeCaveat = (t: MessageTranslator = english): string =>
  t("outcome.caveat");

function valueOf(
  outcome: ActionOutcome,
  value: number | null,
  depth: number,
  t: MessageTranslator,
): string {
  if (outcome.metric !== "position") {
    return value === null ? "—" : metricValue(outcome.metric, value);
  }
  return value === null ? t("outcome.notInTop", { depth }) : `#${value}`;
}

export function outcomeSentence(
  outcome: ActionOutcome,
  depth: number | null,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  if (outcome.verdict === "pending") {
    const from = outcome.beforeDate ?? outcome.afterDate;
    return `${from ? t("outcome.pendingFrom", { date: formatDateInLocale(from, locale) }) : ""}${t("outcome.pending")}`;
  }
  const scale = depth ?? RANK_DEPTH;
  return t("outcome.sentence", {
    metric: t(`trend.metrics.${outcome.metric}`),
    before: valueOf(outcome, outcome.before, scale, t),
    after: valueOf(outcome, outcome.after, scale, t),
    from: formatDateInLocale(outcome.beforeDate, locale),
    to: formatDateInLocale(outcome.afterDate, locale),
  });
}
