import type { AlertEventItem } from "@asobeast/shared";
import { exactKeywordSearch } from "@/components/keywords/keyword-search";
import { tableHref } from "@/components/top-charts/chart-params";
import { sectionHref } from "@/lib/app-sections";

function appPath(
  appId: string | null,
  segment: string,
  query: Record<string, string> = {},
): string | null {
  if (appId === null) return null;
  const params = new URLSearchParams(query).toString();
  const path = sectionHref(appId, segment);
  return params ? `${path}?${params}` : path;
}

export function alertEventHref(item: AlertEventItem): string | null {
  const { payload, primaryAppId } = item;
  switch (payload.event) {
    case "rank.dropped":
    case "rank.improved":
    case "rank.milestone":
    case "rank.first":
      return appPath(primaryAppId, "keywords", {
        country: payload.keyword.country,
        q: exactKeywordSearch(payload.keyword.text),
      });
    case "rank.overtaken":
      return appPath(primaryAppId, "competitors", {
        country: payload.keyword.country,
        keyword: payload.keyword.id,
      });
    case "serp.entrant":
      return appPath(primaryAppId, "keywords", {
        country: payload.keyword.country,
        serp: payload.keyword.id,
      });
    case "metadata.changed":
      return appPath(primaryAppId, "changes");
    case "review.negative":
      return appPath(primaryAppId, "reviews", {
        score: String(payload.review.score),
      });
    case "rating.dropped":
    case "review.spike":
      return appPath(primaryAppId, "reviews");
    case "app.delisted":
      return appPath(primaryAppId, "");
    case "app.unlisted_market":
      return appPath(primaryAppId, "keywords", { country: payload.market });
    case "action.opened":
      return `/actions?${new URLSearchParams({ action: payload.action.id }).toString()}`;
    case "chart.entered":
    case "chart.left":
    case "chart.milestone":
      return tableHref(payload.chart, { date: payload.date });
    case "review.new":
    case "digest.weekly":
      return null;
    default: {
      const never: never = payload;
      return never;
    }
  }
}
