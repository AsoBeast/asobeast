import type {
  AppSummary,
  PortfolioInsights,
  PortfolioSummary,
  RankDistributionHistory,
  VisibilityHistory,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";
import type { RangeParams } from "./client";

export function getSummary(
  appId: string,
  country?: string,
): Promise<AppSummary> {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  return apiFetch<AppSummary>(withQuery(`/apps/${appId}/summary`, params));
}

export function getPortfolio(): Promise<PortfolioSummary> {
  return apiFetch<PortfolioSummary>("/portfolio");
}

export function getPortfolioInsights(): Promise<PortfolioInsights> {
  return apiFetch<PortfolioInsights>("/portfolio/insights");
}

export function getVisibilityHistory(
  appId: string,
  { from, to }: RangeParams = {},
  country?: string,
): Promise<VisibilityHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (country) params.set("country", country);
  return apiFetch<VisibilityHistory>(
    withQuery(`/apps/${appId}/visibility-history`, params),
  );
}

export function getRankDistributionHistory(
  appId: string,
  { from, to }: RangeParams = {},
  country?: string,
): Promise<RankDistributionHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (country) params.set("country", country);
  return apiFetch<RankDistributionHistory>(
    withQuery(`/apps/${appId}/rank-distribution-history`, params),
  );
}
