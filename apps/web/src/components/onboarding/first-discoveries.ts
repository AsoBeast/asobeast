import { listsNoApps, type KeywordDiscoveryList } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";
import { pluralize } from "@/lib/format";
import { rankText } from "@/components/keywords/discovery/discovery-rows";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

export const FIRST_DISCOVERIES_LIMIT = 5;

export interface FirstDiscoveryRow {
  keywordId: string;
  text: string;
  rank: string;
}

export type FirstDiscoveries =
  | { status: "collecting" }
  | { status: "ready"; headline: string; rows: FirstDiscoveryRow[] };

const rankOf = (
  item: KeywordDiscoveryList["items"][number],
  t: MessageTranslator,
): string => {
  if (item.position !== null) return `#${item.position}`;
  if (listsNoApps(item.resultCount)) return t("firstDiscoveries.noApps");
  return rankText(item, t) ?? t("firstDiscoveries.notChecked");
};

function uncheckedSentence(
  { items, counts }: KeywordDiscoveryList,
  t: MessageTranslator,
): string {
  if (items.some(({ checkedOn }) => checkedOn !== null)) {
    return t("firstDiscoveries.noneRank");
  }
  return items.length < counts.all
    ? t("firstDiscoveries.noneCheckedShown")
    : t("firstDiscoveries.noneCheckedAll");
}

function headlineOf(list: KeywordDiscoveryList, t: MessageTranslator): string {
  const { counts } = list;
  const found = t("firstDiscoveries.found", { count: counts.all });
  if (counts.ranked > 0) {
    return t("firstDiscoveries.ranked", { found, count: counts.ranked });
  }
  return t("firstDiscoveries.unrankedHeadline", {
    found,
    sentence: uncheckedSentence(list, t),
    track: t("firstDiscoveries.trackFit"),
  });
}

const isCollecting = ({ checks, counts }: KeywordDiscoveryList): boolean =>
  checks.checkedAt === null && counts.ranked === 0 && checks.pending > 0;

export function firstDiscoveries(
  list: KeywordDiscoveryList | undefined,
  t: MessageTranslator = english,
): FirstDiscoveries | null {
  if (!list) return null;
  if (isCollecting(list)) return { status: "collecting" };
  if (list.items.length === 0) return null;
  return {
    status: "ready",
    headline: headlineOf(list, t),
    rows: list.items.slice(0, FIRST_DISCOVERIES_LIMIT).map((item) => ({
      keywordId: item.keywordId,
      text: item.text,
      rank: rankOf(item, t),
    })),
  };
}
