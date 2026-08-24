import type { ActionItem } from "@asobeast/shared";

export function actionHref(item: ActionItem): string {
  const { appId, keywordId, country } = item.scope;
  switch (item.rule) {
    case "keyword.add_uncovered":
      return `/apps/${appId}/metadata${keywordId ? `?keyword=${keywordId}` : ""}`;
    case "keyword.defend":
      return `/apps/${appId}/keywords?country=${country}${keywordId ? `&serp=${keywordId}` : ""}`;
    case "keyword.prune":
      return `/apps/${appId}/keywords?country=${country}&sort=position`;
    case "rank.investigate_drop":
      return `/apps/${appId}/changes`;
    case "serp.hold_volatile":
      return `/apps/${appId}/keywords?country=${country}&sort=volatility`;
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
