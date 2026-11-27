import { createTranslator } from "next-intl";
import type {
  DiscoverySource,
  KeywordDiscoveryCount,
  DiscoveryState,
  KeywordDiscoveryChecks,
  KeywordDiscoveryCounts,
  KeywordDiscoveryItem,
  KeywordDiscoveryList,
  KeywordDiscoveryRefreshResult,
  KeywordDiscoveryTrackResult,
  Store,
} from "@asobeast/shared";
import enKeywordInspector from "../../messages/en/keywordInspector.json";
import type { MessageTranslator } from "@/i18n/translator";
import { FIRST_CHECK_POLL_LIMIT, FIRST_CHECK_POLL_MS } from "./keyword-checks";

const DAY_MS = 86_400_000;

const english = createTranslator({
  locale: "en",
  namespace: "keywordInspector",
  messages: { keywordInspector: enKeywordInspector },
});

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const SOURCE_KEYS: Record<DiscoverySource, string> = {
  title: "title",
  subtitle: "subtitle",
  description: "description",
  competitors: "competitors",
  reviews: "reviews",
  popularity: "popularity",
  portfolio: "portfolio",
};

export function keywordDiscoveriesPollInterval(
  list: KeywordDiscoveryList | undefined,
  updates: number,
): number | false {
  if (!list || updates >= FIRST_CHECK_POLL_LIMIT) return false;
  return list.checks.pending > 0 ? FIRST_CHECK_POLL_MS : false;
}

export const visibleDiscoveries = (
  items: readonly KeywordDiscoveryItem[],
  state: DiscoveryState,
): KeywordDiscoveryItem[] =>
  state === "all" ? [...items] : items.filter((item) => item.state === state);

const lessBy = (count: number, removed: number): number =>
  Math.max(0, count - removed);

export function withoutDiscoveries(
  list: KeywordDiscoveryList,
  keywordIds: readonly string[],
): KeywordDiscoveryList {
  const ids = new Set(keywordIds);
  const removed = list.items.filter((item) => ids.has(item.keywordId));
  const removedIn = (state: KeywordDiscoveryItem["state"]): number =>
    removed.filter((item) => item.state === state).length;
  const ranked = removedIn("ranked");
  return {
    ...list,
    items: list.items.filter((item) => !ids.has(item.keywordId)),
    counts: {
      all: lessBy(list.counts.all, removed.length),
      ranked: lessBy(list.counts.ranked, ranked),
      opportunity: lessBy(list.counts.opportunity, removedIn("opportunity")),
    },
    unfit: lessBy(list.unfit, ranked),
  };
}

export const discoveryTabLabel = (
  counts: KeywordDiscoveryCounts | undefined,
  t: MessageTranslator = english,
): string =>
  counts
    ? t("discovery.tabs.discoveredCount", { count: counts.all })
    : t("discovery.tabs.discovered");

export const discoverySourceLabel = (
  source: DiscoverySource,
  store: Store,
  t: MessageTranslator = english,
): string =>
  t(
    source === "description" && store === "GOOGLE_PLAY"
      ? "discovery.sources.shortDescription"
      : `discovery.sources.${SOURCE_KEYS[source]}`,
  );

const utcDayNumber = (instant: Date): number =>
  Math.floor(instant.getTime() / DAY_MS);

function checkedSentence(
  checkedAt: string | null,
  now: Date,
  t: MessageTranslator,
): string {
  if (checkedAt === null) return t("discovery.footer.notChecked");
  const days = Math.max(
    0,
    utcDayNumber(now) - utcDayNumber(new Date(checkedAt)),
  );
  return days === 0
    ? t("discovery.footer.checkedToday")
    : t("discovery.footer.checkedDaysAgo", { count: days });
}

function weeklySentence(
  checks: KeywordDiscoveryChecks,
  t: MessageTranslator,
): string {
  const budget = t("discovery.footer.weeklyBudget", {
    count: checks.perWeek,
    used: checks.usedThisWeek > 0 ? checks.usedThisWeek : "none",
  });
  if (checks.nextRunAt === null) {
    return t("discovery.footer.weeklyOff", { budget });
  }
  const weekday = WEEKDAYS[new Date(checks.nextRunAt).getUTCDay()];
  return t("discovery.footer.nextRun", {
    budget,
    weekday: t(`discovery.footer.weekdays.${weekday}`),
  });
}

export const discoveryFooter = (
  checks: KeywordDiscoveryChecks,
  now: Date,
  t: MessageTranslator = english,
): string =>
  t("discovery.footer.combined", {
    checked: checkedSentence(checks.checkedAt, now, t),
    weekly: weeklySentence(checks, t),
  });

export const pendingChecksText = (
  pending: number,
  t: MessageTranslator = english,
): string =>
  pending > 0 ? t("discovery.footer.pending", { count: pending }) : "";

export const unfitNotice = (
  unfit: number,
  t: MessageTranslator = english,
): string => (unfit > 0 ? t("discovery.footer.unfit", { count: unfit }) : "");

export function trackedToast(
  { tracked, skipped }: KeywordDiscoveryTrackResult,
  t: MessageTranslator = english,
): string {
  if (tracked === 0) {
    return skipped > 0
      ? t("discovery.toast.nothingFit")
      : t("discovery.toast.nothingNew");
  }
  const tracking = t("discovery.toast.tracked", { count: tracked });
  return skipped > 0
    ? t("discovery.toast.trackedPartial", {
        tracking,
        unfit: unfitNotice(skipped, t),
      })
    : tracking;
}

export function refreshedToast(
  { queued, resolved }: KeywordDiscoveryRefreshResult,
  t: MessageTranslator = english,
): string {
  if (queued > 0) return t("discovery.toast.queued", { count: queued });
  return resolved > 0
    ? t("discovery.toast.refreshed")
    : t("discovery.toast.nothingToCheck");
}

export function discoveriesLine(
  count: KeywordDiscoveryCount | undefined,
  t: MessageTranslator = english,
): string | null {
  if (!count || count.open === 0) return null;
  const found = t("discovery.line.found", { count: count.open });
  return count.ranked > 0
    ? t("discovery.line.ranked", { found, ranked: count.ranked })
    : found;
}

export const discoveriesHref = (appId: string, country?: string): string =>
  `/apps/${appId}/keywords?tab=discovered${country ? `&country=${country}` : ""}`;
