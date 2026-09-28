import type { ActionItem } from "@asobeast/shared";

export function actionHref(item: ActionItem): string {
  const { appId, keywordId, country } = item.scope;
  switch (item.rule) {
    case "keyword.add_uncovered":
    case "keyword.push_to_top10":
      return `/apps/${appId}/metadata${keywordId ? `?keyword=${keywordId}` : ""}`;
    case "keyword.defend":
      return `/apps/${appId}/keywords?country=${country}${keywordId ? `&serp=${keywordId}` : ""}`;
    case "keyword.prune":
      return `/apps/${appId}/keywords?country=${country}&sort=position`;
    case "rank.investigate_drop":
      return `/apps/${appId}/changes`;
    case "serp.hold_volatile":
      return `/apps/${appId}/keywords?country=${country}&sort=volatility`;
    case "metadata.fix_lint":
      return `/apps/${appId}/metadata`;
    case "audit.fix_factor":
      return `/apps/${appId}/audit`;
    case "reviews.investigate_theme":
      return `/apps/${appId}/reviews?score=1`;
    case "market.improve_country":
      return `/apps/${appId}/keywords?country=${country}`;
    default: {
      const never: never = item.rule;
      return never;
    }
  }
}

const SECTION_LABEL: Record<string, string> = {
  metadata: "Metadata",
  keywords: "Keywords",
  changes: "Changes",
  audit: "Audit",
  reviews: "Reviews",
};

export function actionSection(href: string): string {
  const segment = href.split("?")[0].split("/")[3] ?? "";
  return SECTION_LABEL[segment] ?? "the app";
}
