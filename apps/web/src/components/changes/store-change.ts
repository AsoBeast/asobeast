import type {
  AppEventRef,
  AppEventsDetail,
  ChangeEventItem,
  EditorsChoiceDetail,
  FeaturingDetail,
  StoryRef,
} from "@asobeast/shared";
import { isoDateOrNull } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

export { isStoreField } from "@asobeast/shared";

export const EVENT_FALLBACK_TITLE = "In-app event";

export const STORY_FALLBACK_TITLE = "Featured story";

export const eventTitle = (
  ref: AppEventRef,
  t: MessageTranslator = english,
): string => ref.title ?? ref.kind ?? t("store.eventFallback");

export const storyTitle = (
  ref: StoryRef,
  t: MessageTranslator = english,
): string => ref.title ?? ref.heading ?? t("store.storyFallback");

function eventRange(
  ref: AppEventRef,
  t: MessageTranslator,
  locale: Locale,
): string | null {
  const startsAt = isoDateOrNull(ref.startsAt);
  const endsAt = isoDateOrNull(ref.endsAt);
  if (startsAt !== null && endsAt !== null) {
    return t("store.range", {
      from: formatDayMonthInLocale(startsAt, locale),
      to: formatDayMonthInLocale(endsAt, locale),
    });
  }
  if (startsAt !== null) {
    return t("store.from", { date: formatDayMonthInLocale(startsAt, locale) });
  }
  if (endsAt !== null) {
    return t("store.until", { date: formatDayMonthInLocale(endsAt, locale) });
  }
  return null;
}

export function eventMeta(
  ref: AppEventRef,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string | null {
  const parts = [
    ref.title === null ? null : ref.kind,
    ref.badge,
    eventRange(ref, t, locale),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

const named = (
  label: string,
  name: string | null,
  t: MessageTranslator,
): string => (name === null ? label : t("store.named", { label, name }));

const storyName = (ref: StoryRef): string | null => ref.title ?? ref.heading;

function summaryLine<T>(
  items: readonly T[],
  labels: { singular: string; plural: string },
  nameOf: (item: T) => string | null,
  t: MessageTranslator,
): string | null {
  const [one] = items;
  if (one && items.length === 1) {
    return named(t(labels.singular), nameOf(one), t);
  }
  return items.length > 1 ? t(labels.plural, { count: items.length }) : null;
}

const joined = (lines: Array<string | null>): string =>
  lines.filter((line) => line !== null).join(", ");

function eventsSummary(detail: AppEventsDetail, t: MessageTranslator): string {
  return joined([
    summaryLine(
      detail.added,
      { singular: "store.eventAdded", plural: "store.eventsAdded" },
      (ref) => ref.title ?? ref.kind,
      t,
    ),
    summaryLine(
      detail.removed,
      { singular: "store.eventRemoved", plural: "store.eventsRemoved" },
      (ref) => ref.title ?? ref.kind,
      t,
    ),
  ]);
}

function featuringSummary(
  detail: FeaturingDetail,
  t: MessageTranslator,
): string {
  return joined([
    summaryLine(
      detail.added,
      { singular: "store.storyAdded", plural: "store.storiesAdded" },
      storyName,
      t,
    ),
    summaryLine(
      detail.removed,
      { singular: "store.storyRemoved", plural: "store.storiesRemoved" },
      storyName,
      t,
    ),
  ]);
}

function editorsChoiceSummary(
  detail: EditorsChoiceDetail,
  t: MessageTranslator,
): string {
  return t(detail.showsBadge ? "store.editorsAdded" : "store.editorsRemoved");
}

export function storeChangeSummary(
  event: Pick<ChangeEventItem, "field" | "detail">,
  t: MessageTranslator = english,
): string {
  const detail = event.detail;
  if (detail?.kind === "events") return eventsSummary(detail, t);
  if (detail?.kind === "featuring") return featuringSummary(detail, t);
  if (detail?.kind === "editorsChoice") return editorsChoiceSummary(detail, t);
  return "";
}
