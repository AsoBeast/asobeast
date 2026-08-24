import type {
  AppSummary,
  PortfolioSummary,
  RankDistributionHistory,
  VisibilityHistory,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";
import type { RangeParams } from "./client";

export function getSummary(appId: string): Promise<AppSummary> {
  return apiFetch<AppSummary>(`/apps/${appId}/summary`);
}

export function getPortfolio(): Promise<PortfolioSummary> {
  return apiFetch<PortfolioSummary>("/portfolio");
}

export function getVisibilityHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<VisibilityHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<VisibilityHistory>(
    withQuery(`/apps/${appId}/visibility-history`, params),
  );
}

export function getRankDistributionHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<RankDistributionHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<RankDistributionHistory>(
    withQuery(`/apps/${appId}/rank-distribution-history`, params),
  );
}
