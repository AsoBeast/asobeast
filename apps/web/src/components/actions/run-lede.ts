import type { ActionActivity, ActionSummary } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";

export const NOT_GENERATED_LEDE =
  "A prioritized list of ASO work, computed from your stored history.";

export const QUIET_RUN_LEDE =
  "Nothing opened or closed on the day of the last run.";

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

export const notGeneratedLede = (t: MessageTranslator = english): string =>
  t("notGeneratedLede");

export const quietRunLede = (t: MessageTranslator = english): string =>
  t("quietRunLede");

export type RunChanges =
  | { kind: "unknown" }
  | { kind: "stale"; days: number }
  | { kind: "day"; changes: string[] };

export function runChanges(
  summary: ActionSummary,
  activity: ActionActivity,
  t: MessageTranslator = english,
): RunChanges {
  if (summary.generatedAt === null) return { kind: "unknown" };
  const runDay = summary.generatedAt.slice(0, 10);
  const day = activity.days.find((entry) => entry.date === runDay);
  if (!day) {
    return runDay < activity.from
      ? { kind: "stale", days: activity.days.length }
      : { kind: "unknown" };
  }
  const opened = day.opened + day.reopened;
  const closed = day.done + day.dismissed;
  return {
    kind: "day",
    changes: [
      opened > 0 ? t("run.opened", { count: opened }) : null,
      closed > 0 ? t("run.closedByYou", { count: closed }) : null,
      day.resolved > 0 ? t("run.resolvedOwn", { count: day.resolved }) : null,
      day.verified > 0 ? t("run.confirmed", { count: day.verified }) : null,
    ].filter((part): part is string => part !== null),
  };
}
