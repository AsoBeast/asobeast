import type { ActionItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatDateInLocale } from "@/lib/format";

export interface ActionStatusTag {
  label: string;
  tone: "warning" | "success" | "neutral";
}

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

function doneTag(item: ActionItem, t: MessageTranslator): ActionStatusTag {
  if (item.verifiedAt)
    return { label: t("stateTags.confirmed"), tone: "success" };
  const stillDetected =
    item.closedAt !== null && item.lastSeenAt > item.closedAt;
  return stillDetected
    ? { label: t("stateTags.stillDetected"), tone: "warning" }
    : { label: t("stateTags.verifying"), tone: "neutral" };
}

export function actionStatusTag(
  item: ActionItem,
  t: MessageTranslator = english,
  locale: Locale = "en",
): ActionStatusTag | null {
  if (item.degraded) {
    return { label: t("stateTags.evidenceUnavailable"), tone: "warning" };
  }
  switch (item.status) {
    case "SNOOZED":
      return item.snoozedUntil
        ? {
            label: t("stateTags.snoozedUntil", {
              date: formatDateInLocale(item.snoozedUntil, locale),
            }),
            tone: "neutral",
          }
        : { label: t("stateTags.snoozed"), tone: "neutral" };
    case "DONE":
      return doneTag(item, t);
    case "RESOLVED":
      return { label: t("stateTags.resolvedOwn"), tone: "neutral" };
    case "DISMISSED":
    case "OPEN":
      return item.reopenCount > 0
        ? {
            label: t("stateTags.reopened", { count: item.reopenCount }),
            tone: "neutral",
          }
        : null;
  }
}
