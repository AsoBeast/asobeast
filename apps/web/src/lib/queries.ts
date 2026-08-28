import type {
  AlertChannel,
  FirstRunStatus,
  KeywordSort,
  KeywordSuggestionStrategy,
} from "@asobeast/shared";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  getActionAiStatus,
  getActions,
  getActionSummary,
  getAlertDeliveryStatus,
  getAppActions,
  getAlertsConfig,
  getApiTokens,
  getApp,
  getApps,
  getAuditHistory,
  getAccountPlan,
  getAuthMe,
  getAuthStatus,
  getWorkspaceTeam,
  getBillingCatalog,
  getBudget,
  getCategoryRanks,
  getChanges,
  getEmailAlerts,
  getComparison,
  getCompetitorDiscovery,
  getCompetitors,
  getFirstRun,
  getHealth,
  getKeywordCountries,
  getKeywordField,
  getKeywords,
  getMarketAvailability,
  getPortfolio,
  getRankDistributionHistory,
  getRankings,
  getRatingsHistogram,
  getRatingsHistory,
  getRecentChanges,
  getRunStatus,
  getReviews,
  getSerp,
  getSerpMovers,
  getWebHealth,
  getSpiderStatus,
  getSuggestions,
  getSummary,
  getVisibilityHistory,
  getWebhooks,
  type ActionFilters,
  type RangeParams,
  type RankingParams,
  type ReviewFilters,
} from "./api";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const appKeys = {
  all: ["apps"] as const,
  detail: (id: string) => [...appKeys.all, id] as const,
  summary: (id: string) => [...appKeys.detail(id), "summary"] as const,
  keywordsRoot: (id: string) => [...appKeys.detail(id), "keywords"] as const,
  compareRoot: (id: string) => [...appKeys.detail(id), "compare"] as const,
  keywords: (id: string, sort?: KeywordSort, country?: string) =>
    [...appKeys.detail(id), "keywords", { sort, country }] as const,
  keywordCountries: (id: string) =>
    [...appKeys.detail(id), "keyword-countries"] as const,
  keywordField: (id: string) =>
    [...appKeys.detail(id), "keyword-field"] as const,
  suggestions: (
    id: string,
    strategy: KeywordSuggestionStrategy,
    country?: string,
  ) => [...appKeys.detail(id), "suggestions", strategy, { country }] as const,
  spider: (id: string, term: string, country?: string) =>
    [...appKeys.detail(id), "spider", { term, country }] as const,
  compare: (id: string, onlyGaps: boolean) =>
    [...appKeys.detail(id), "compare", { onlyGaps }] as const,
  rankings: (id: string, params: RankingParams) =>
    [...appKeys.detail(id), "rankings", params] as const,
  serpMoversRoot: (id: string) =>
    [...appKeys.detail(id), "serp-movers"] as const,
  serpMovers: (id: string, days: number) =>
    [...appKeys.detail(id), "serp-movers", { days }] as const,
  categoryRanks: (id: string, params: RangeParams) =>
    [...appKeys.detail(id), "category-ranks", params] as const,
  auditHistory: (id: string, params: RangeParams) =>
    [...appKeys.detail(id), "audit-history", params] as const,
  visibility: (id: string, params: RangeParams) =>
    [...appKeys.detail(id), "visibility", params] as const,
  rankDistribution: (id: string, params: RangeParams) =>
    [...appKeys.detail(id), "rank-distribution", params] as const,
  competitors: (id: string) => [...appKeys.detail(id), "competitors"] as const,
  discoveryRoot: (id: string) => [...appKeys.detail(id), "discovery"] as const,
  discovery: (id: string, days: number) =>
    [...appKeys.detail(id), "discovery", { days }] as const,
  changesRoot: (id: string) => [...appKeys.detail(id), "changes"] as const,
  changes: (id: string, days: number) =>
    [...appKeys.detail(id), "changes", { days }] as const,
  reviewsRoot: (id: string) => [...appKeys.detail(id), "reviews"] as const,
  reviews: (id: string, filters: ReviewFilters) =>
    [...appKeys.detail(id), "reviews", filters] as const,
  ratingsHistory: (id: string, params: RangeParams) =>
    [...appKeys.detail(id), "ratings-history", params] as const,
  ratingsHistogram: (id: string) =>
    [...appKeys.detail(id), "ratings-histogram"] as const,
  marketAvailability: (id: string, country: string) =>
    [...appKeys.detail(id), "market-availability", { country }] as const,
  firstRun: (id: string) => [...appKeys.detail(id), "first-run"] as const,
  serp: (keywordId: string) => ["serp", keywordId] as const,
};

export const portfolioKey = ["portfolio"] as const;

export const recentChangesKey = (limit?: number) =>
  ["changes", "recent", { limit }] as const;

export const webhookKeys = {
  all: ["webhooks"] as const,
};

export const emailAlertKeys = {
  all: ["email-alerts"] as const,
};

export const alertsConfigKey = ["alerts", "config"] as const;

export const alertDeliveryKey = ["alerts", "delivery"] as const;

export const deliveryKeys = {
  all: ["alert-deliveries"] as const,
  list: (channel: AlertChannel, id: string) =>
    ["alert-deliveries", channel, id] as const,
};

export const healthKey = ["health"] as const;

export const webHealthKey = ["web-health"] as const;

export const budgetKey = ["budget"] as const;

export const runStatusKey = ["run-status"] as const;

export const authStatusKey = ["auth", "status"] as const;

export const authMeKey = ["auth", "me"] as const;

export const accountPlanKey = ["auth", "plan"] as const;

export const apiTokenKeys = {
  all: ["auth", "tokens"] as const,
};

export const workspaceTeamKey = ["auth", "team"] as const;

export const billingCatalogKey = ["billing", "catalog"] as const;

export const authStatusOptions = queryOptions({
  queryKey: authStatusKey,
  queryFn: getAuthStatus,
  staleTime: 60 * 1000,
});

export const authMeOptions = queryOptions({
  queryKey: authMeKey,
  queryFn: getAuthMe,
  retry: false,
});

export const accountPlanOptions = queryOptions({
  queryKey: accountPlanKey,
  queryFn: getAccountPlan,
  retry: false,
  staleTime: 30 * 1000,
});

export const billingCatalogOptions = queryOptions({
  queryKey: billingCatalogKey,
  queryFn: getBillingCatalog,
  retry: false,
  staleTime: 5 * 60 * 1000,
});

export const workspaceTeamOptions = queryOptions({
  queryKey: workspaceTeamKey,
  queryFn: getWorkspaceTeam,
  retry: false,
});

export const apiTokensOptions = queryOptions({
  queryKey: apiTokenKeys.all,
  queryFn: getApiTokens,
});

export function invalidateAuth(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: authStatusKey });
  void client.invalidateQueries({ queryKey: authMeKey });
  void client.invalidateQueries({ queryKey: accountPlanKey });
}

export function invalidateWorkspaceTeamMutation(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: workspaceTeamKey });
}

export function invalidateApiTokenMutation(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: apiTokenKeys.all });
}

export const portfolioOptions = queryOptions({
  queryKey: portfolioKey,
  queryFn: getPortfolio,
});

export const actionKeys = {
  all: ["actions"] as const,
  list: (filters: ActionFilters, appId?: string) =>
    ["actions", "list", appId ?? null, filters] as const,
  summary: ["actions", "summary"] as const,
  aiStatus: ["actions", "ai-status"] as const,
  appRoot: (id: string) => [...appKeys.detail(id), "actions"] as const,
};

export const actionsOptions = (filters: ActionFilters, appId?: string) =>
  queryOptions({
    queryKey: actionKeys.list(filters, appId),
    queryFn: () =>
      appId ? getAppActions(appId, filters) : getActions(filters),
  });

export const actionSummaryOptions = queryOptions({
  queryKey: actionKeys.summary,
  queryFn: getActionSummary,
});

export const actionAiStatusOptions = queryOptions({
  queryKey: actionKeys.aiStatus,
  queryFn: getActionAiStatus,
  staleTime: 60_000,
});

export function invalidateActionMutation(
  client: QueryClient,
  appId?: string,
): void {
  void client.invalidateQueries({ queryKey: actionKeys.all });
  if (appId) {
    void client.invalidateQueries({ queryKey: actionKeys.appRoot(appId) });
  }
}

export const appsOptions = queryOptions({
  queryKey: appKeys.all,
  queryFn: getApps,
});

export const recentChangesOptions = (limit?: number) =>
  queryOptions({
    queryKey: recentChangesKey(limit),
    queryFn: () => getRecentChanges(limit),
  });

export const appDetailOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.detail(id),
    queryFn: () => getApp(id),
  });

export const appSummaryOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.summary(id),
    queryFn: () => getSummary(id),
  });

export const keywordsOptions = (
  id: string,
  sort?: KeywordSort,
  country?: string,
) =>
  queryOptions({
    queryKey: appKeys.keywords(id, sort, country),
    queryFn: () => getKeywords(id, sort, country),
  });

export const keywordCountriesOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.keywordCountries(id),
    queryFn: () => getKeywordCountries(id),
  });

export const keywordFieldOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.keywordField(id),
    queryFn: () => getKeywordField(id),
  });

export const suggestionsOptions = (
  id: string,
  strategy: KeywordSuggestionStrategy,
  country?: string,
) =>
  queryOptions({
    queryKey: appKeys.suggestions(id, strategy, country),
    queryFn: () => getSuggestions(id, strategy, undefined, country),
  });

export const spiderOptions = (id: string, term: string, country?: string) =>
  queryOptions({
    queryKey: appKeys.spider(id, term, country),
    queryFn: () => getSpiderStatus(id, term, country),
    refetchInterval: (query) => (query.state.data?.complete ? false : 3000),
  });

export const comparisonOptions = (id: string, onlyGaps: boolean) =>
  queryOptions({
    queryKey: appKeys.compare(id, onlyGaps),
    queryFn: () => getComparison(id, onlyGaps),
  });

export const rankingsOptions = (id: string, params: RankingParams) =>
  queryOptions({
    queryKey: appKeys.rankings(id, params),
    queryFn: () => getRankings(id, params),
  });

export const serpMoversOptions = (id: string, days: number) =>
  queryOptions({
    queryKey: appKeys.serpMovers(id, days),
    queryFn: () => getSerpMovers(id, days),
  });

export const visibilityOptions = (id: string, params: RangeParams) =>
  queryOptions({
    queryKey: appKeys.visibility(id, params),
    queryFn: () => getVisibilityHistory(id, params),
  });

export const categoryRanksOptions = (id: string, params: RangeParams) =>
  queryOptions({
    queryKey: appKeys.categoryRanks(id, params),
    queryFn: () => getCategoryRanks(id, params),
  });

export const auditHistoryOptions = (id: string, params: RangeParams = {}) =>
  queryOptions({
    queryKey: appKeys.auditHistory(id, params),
    queryFn: () => getAuditHistory(id, params),
  });

export const rankDistributionHistoryOptions = (
  id: string,
  params: RangeParams,
) =>
  queryOptions({
    queryKey: appKeys.rankDistribution(id, params),
    queryFn: () => getRankDistributionHistory(id, params),
  });

export const competitorsOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.competitors(id),
    queryFn: () => getCompetitors(id),
  });

export const discoveryOptions = (id: string, days: number) =>
  queryOptions({
    queryKey: appKeys.discovery(id, days),
    queryFn: () => getCompetitorDiscovery(id, days),
  });

export const changesOptions = (id: string, days: number) =>
  queryOptions({
    queryKey: appKeys.changes(id, days),
    queryFn: () => getChanges(id, days),
  });

export const reviewsOptions = (id: string, filters: ReviewFilters) =>
  queryOptions({
    queryKey: appKeys.reviews(id, filters),
    queryFn: () => getReviews(id, filters),
  });

export const ratingsHistoryOptions = (id: string, params: RangeParams) =>
  queryOptions({
    queryKey: appKeys.ratingsHistory(id, params),
    queryFn: () => getRatingsHistory(id, params),
  });

export const ratingsHistogramOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.ratingsHistogram(id),
    queryFn: () => getRatingsHistogram(id),
  });

export const marketAvailabilityOptions = (id: string, country: string) =>
  queryOptions({
    queryKey: appKeys.marketAvailability(id, country),
    queryFn: () => getMarketAvailability(id, country),
    staleTime: (query) =>
      query.state.data?.status === "unknown" ? 0 : ONE_DAY_MS,
  });

export const serpOptions = (keywordId: string) =>
  queryOptions({
    queryKey: appKeys.serp(keywordId),
    queryFn: () => getSerp(keywordId),
  });

export const webhooksOptions = queryOptions({
  queryKey: webhookKeys.all,
  queryFn: getWebhooks,
});

export const emailAlertsOptions = queryOptions({
  queryKey: emailAlertKeys.all,
  queryFn: getEmailAlerts,
});

export const alertsConfigOptions = queryOptions({
  queryKey: alertsConfigKey,
  queryFn: getAlertsConfig,
});

export const alertDeliveryOptions = queryOptions({
  queryKey: alertDeliveryKey,
  queryFn: getAlertDeliveryStatus,
});

export const healthOptions = queryOptions({
  queryKey: healthKey,
  queryFn: getHealth,
  refetchInterval: 30_000,
});

export const webHealthOptions = queryOptions({
  queryKey: webHealthKey,
  queryFn: getWebHealth,
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
});

export const budgetOptions = queryOptions({
  queryKey: budgetKey,
  queryFn: getBudget,
});

export const runStatusOptions = queryOptions({
  queryKey: runStatusKey,
  queryFn: getRunStatus,
  refetchInterval: 300_000,
});

export const FIRST_RUN_POLL_MS = 15_000;

const collectingNow = (status: FirstRunStatus | undefined): boolean =>
  status?.stages.some(
    (stage) => !stage.complete && stage.stage !== "history",
  ) ?? false;

export const firstRunOptions = (id: string) =>
  queryOptions({
    queryKey: appKeys.firstRun(id),
    queryFn: () => getFirstRun(id),
    refetchInterval: (query) =>
      collectingNow(query.state.data) ? FIRST_RUN_POLL_MS : false,
  });

export function invalidateKeywords(client: QueryClient, id: string): void {
  void client.invalidateQueries({ queryKey: appKeys.keywordsRoot(id) });
}

export function invalidateKeywordMutation(
  client: QueryClient,
  id: string,
): void {
  void client.invalidateQueries({ queryKey: appKeys.keywordsRoot(id) });
  void client.invalidateQueries({ queryKey: appKeys.keywordCountries(id) });
  void client.invalidateQueries({ queryKey: appKeys.keywordField(id) });
  void client.invalidateQueries({ queryKey: appKeys.summary(id) });
  void client.invalidateQueries({ queryKey: appKeys.compareRoot(id) });
}

export function invalidateCompetitorMutation(
  client: QueryClient,
  id: string,
): void {
  void client.invalidateQueries({ queryKey: appKeys.detail(id) });
  void client.invalidateQueries({ queryKey: appKeys.discoveryRoot(id) });
  void client.invalidateQueries({ queryKey: appKeys.serpMoversRoot(id) });
}

export function invalidateLinkMutation(
  client: QueryClient,
  id: string,
  counterpartId: string,
): void {
  void client.invalidateQueries({ queryKey: appKeys.detail(id) });
  void client.invalidateQueries({ queryKey: appKeys.detail(counterpartId) });
  void client.invalidateQueries({ queryKey: appKeys.all });
  void client.invalidateQueries({ queryKey: portfolioKey });
}

export function invalidateWebhookMutation(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: webhookKeys.all });
}

export function invalidateEmailAlertMutation(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: emailAlertKeys.all });
}
