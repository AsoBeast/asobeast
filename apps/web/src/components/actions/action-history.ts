import type {
  ActionDismissReason,
  ActionEventItem,
  ActionEventType,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatDateInLocale } from "@/lib/format";
import { actionPriorityLabel } from "./action-copy";

export const ACTION_EVENT_LABEL: Record<ActionEventType, string> = {
  opened: "Opened",
  reopened: "Reopened",
  snoozed: "Snoozed",
  woke: "Woke up",
  done: "Marked done",
  dismissed: "Dismissed",
  resolved: "Resolved on its own",
  verified: "Confirmed fixed",
};

export const ACTION_DISMISS_REASON_LABEL: Record<ActionDismissReason, string> =
  {
    not_relevant: "Not relevant to this app",
    handled_elsewhere: "Already handled elsewhere",
    disagree_with_data: "The data looks wrong",
  };

export interface HistoryEntry {
  id: string;
  date: string;
  label: string;
  detail: string | null;
  actor: string;
}

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

export const actionEventLabel = (
  type: ActionEventType,
  t: MessageTranslator = english,
): string => t(`events.${type}`);

export const actionDismissReasonLabel = (
  reason: ActionDismissReason,
  t: MessageTranslator = english,
): string => t(`dismissReasons.${reason}`);

function detailOf(
  event: ActionEventItem,
  t: MessageTranslator,
  locale: Locale,
): string | null {
  switch (event.type) {
    case "snoozed":
      return event.snoozedUntil
        ? t("historyUntil", {
            date: formatDateInLocale(event.snoozedUntil, locale),
          })
        : null;
    case "dismissed":
      return event.reason ? actionDismissReasonLabel(event.reason, t) : null;
    case "opened":
    case "reopened":
      return t("historyPriorityImpact", {
        priority: actionPriorityLabel(event.priority, t),
        impact: event.impact,
      });
    default:
      return null;
  }
}

export function historyEntries(
  events: readonly ActionEventItem[],
  t: MessageTranslator = english,
  locale: Locale = "en",
): HistoryEntry[] {
  return [...events].reverse().map((event) => ({
    id: event.id,
    date: event.occurredAt,
    label: actionEventLabel(event.type, t),
    detail: detailOf(event, t, locale),
    actor:
      event.actor === "system"
        ? PRODUCT_NAME
        : (event.actorName ?? t("teammate")),
  }));
}
