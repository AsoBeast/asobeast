import type { KeywordDiscoveryList } from "@asobeast/shared";
import { pluralize } from "@/lib/format";
import { rankText } from "@/components/keywords/discovery/discovery-rows";

export const FIRST_DISCOVERIES_LIMIT = 5;

export interface FirstDiscoveryRow {
  keywordId: string;
  text: string;
  rank: string;
}

export type FirstDiscoveries =
  | { status: "collecting" }
  | { status: "ready"; headline: string; rows: FirstDiscoveryRow[] };

const rankOf = (item: KeywordDiscoveryList["items"][number]): string =>
  item.position === null
    ? (rankText(item) ?? "not checked yet")
    : `#${item.position}`;

function headlineOf({ checks, counts }: KeywordDiscoveryList): string {
  const found = `Found ${pluralize(counts.all, "keyword")} near your listing.`;
  if (counts.ranked > 0) {
    return `${found} Your app already ranks for ${counts.ranked} of them.`;
  }
  const unranked =
    checks.checkedAt === null
      ? "None of them has been checked yet."
      : "None of them rank yet.";
  return `${found} ${unranked} Track the ones that fit your app.`;
}

const isCollecting = ({ checks, counts }: KeywordDiscoveryList): boolean =>
  checks.checkedAt === null && counts.ranked === 0 && checks.pending > 0;

export function firstDiscoveries(
  list: KeywordDiscoveryList | undefined,
): FirstDiscoveries | null {
  if (!list) return null;
  if (isCollecting(list)) return { status: "collecting" };
  if (list.items.length === 0) return null;
  return {
    status: "ready",
    headline: headlineOf(list),
    rows: list.items.slice(0, FIRST_DISCOVERIES_LIMIT).map((item) => ({
      keywordId: item.keywordId,
      text: item.text,
      rank: rankOf(item),
    })),
  };
}
