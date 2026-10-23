import {
  QueryClient,
  QueryObserver,
  type QueryKey,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { QUERY_BOUNDS, STORE_SUGGESTION_STRATEGIES } from "@asobeast/shared";
import type {
  AppAuditResult,
  ChartPage,
  AuditAiRunState,
  EmailAlertItem,
  WebhookItem,
} from "@asobeast/shared";
import { APP_AUDIT_EXAMPLE } from "@/components/audit/audit-example";
import { queryMarket } from "./market";
import {
  chartKeys,
  chartPageOptions,
  invalidateChartMutation,
  seedChartCapture,
  adminKeys,
  actionActivityOptions,
  actionDetailOptions,
  actionKeys,
  actionsOptions,
  actionSummaryOptions,
  actionSummaryFor,
  alertsConfigKey,
  apiTokenKeys,
  appKeys,
  appDetailOptions,
  appSummaryOptions,
  AUDIT_RUN_POLL_MS,
  auditHistoryOptions,
  auditOptions,
  accountPlanKey,
  authMeKey,
  authStatusKey,
  budgetKey,
  categoryRanksOptions,
  changeImpactOptions,
  changesOptions,
  competitorsOptions,
  comparisonOptions,
  keywordBreakdownOptions,
  discoveryOptions,
  competitorSuggestionsOptions,
  storeSearchKey,
  storeSearchOptions,
  emailAlertKeys,
  healthKey,
  invalidateApiTokenMutation,
  invalidateActionMutation,
  invalidateAiUsage,
  invalidateAppListing,
  invalidateRunResults,
  removeAppQueries,
  invalidateAuth,
  invalidatePasswordChange,
  invalidateCompetitorMutation,
  invalidateReviewReplyMutation,
  invalidateEmailAlertMutation,
  invalidateAudit,
  invalidateKeywordImport,
  invalidateKeywordFieldMutation,
  invalidateLocalizationMutation,
  invalidateKeywordMutation,
  invalidateMarketSeed,
  invalidateKeywords,
  invalidateLinkMutation,
  invalidateSetupMutation,
  invalidateWebhookMutation,
  seedEmailAlert,
  seedWebhook,
  keywordCountriesOptions,
  keywordFieldOptions,
  appLocalizationsOptions,
  marketKeywordFieldsOptions,
  keywordsOptions,
  appListingOptions,
  listingMarketsOptions,
  marketAvailabilityOptions,
  marketSuggestionsOptions,
  metadataAuditOptions,
  portfolioInsightsKey,
  portfolioInsightsOptions,
  portfolioKey,
  rankDistributionHistoryOptions,
  rankingsOptions,
  ratingsHistogramOptions,
  ratingsHistoryOptions,
  REVIEWS_EXPORT_LIMIT,
  reviewsExportOptions,
  reviewsOptions,
  serpMoversOptions,
  screenshotsOptions,
  serpOptions,
  setupKey,
  setupOptions,
  spiderOptions,
  pickerSuggestionsOptions,
  suggestionsOptions,
  visibilityOptions,
  webhookKeys,
  refetchFailedQueries,
} from "./queries";

const APP = "app-1";
const OTHER_APP = "app-2";
const RANGE = { from: "2026-01-01", to: "2026-01-31" };

function invalidatedKeys(
  invalidate: (client: QueryClient) => void,
): QueryKey[] {
  const client = new QueryClient();
  const spy = vi
    .spyOn(client, "invalidateQueries")
    .mockResolvedValue(undefined);
  invalidate(client);
  return spy.mock.calls.map(([filters]) => filters!.queryKey as QueryKey);
}

function isPrefixOf(prefix: QueryKey, key: QueryKey): boolean {
  return prefix.every(
    (part, index) =>
      JSON.stringify(part) === JSON.stringify((key as unknown[])[index]),
  );
}

const APP_SCOPED_OPTIONS = [
  ["detail", appDetailOptions(APP), appKeys.detail(APP)],
  ["summary", appSummaryOptions(APP), appKeys.summary(APP)],
  ["market summary", appSummaryOptions(APP, "de"), appKeys.summary(APP, "de")],
  ["keywords", keywordsOptions(APP, "us"), appKeys.keywords(APP, "us")],
  [
    "keywordCountries",
    keywordCountriesOptions(APP),
    appKeys.keywordCountries(APP),
  ],
  [
    "keywordField",
    keywordFieldOptions(APP, { country: "de", localization: "en-GB" }),
    appKeys.keywordField(APP, { country: "de", localization: "en-GB" }),
  ],
  ["localizations", appLocalizationsOptions(APP), appKeys.localizations(APP)],
  [
    "marketKeywordFields",
    marketKeywordFieldsOptions(APP, "de"),
    appKeys.marketKeywordFields(APP, "de"),
  ],
  [
    "spider",
    spiderOptions(APP, "fitness", "de"),
    appKeys.spider(APP, "fitness", "de"),
  ],
  ["comparison", comparisonOptions(APP, true), appKeys.compare(APP, true)],
  [
    "keyword breakdown",
    keywordBreakdownOptions(APP, "kw-1"),
    appKeys.keywordBreakdown(APP, "kw-1"),
  ],
  ["rankings", rankingsOptions(APP, RANGE), appKeys.rankings(APP, RANGE)],
  ["serpMovers", serpMoversOptions(APP, 7), appKeys.serpMovers(APP, 7)],
  ["visibility", visibilityOptions(APP, RANGE), appKeys.visibility(APP, RANGE)],
  [
    "market visibility",
    visibilityOptions(APP, RANGE, "de"),
    appKeys.visibility(APP, RANGE, "de"),
  ],
  [
    "categoryRanks",
    categoryRanksOptions(APP, RANGE),
    appKeys.categoryRanks(APP, RANGE),
  ],
  ["audit", auditOptions(APP), appKeys.audit(APP)],
  [
    "auditHistory",
    auditHistoryOptions(APP, RANGE),
    appKeys.auditHistory(APP, RANGE),
  ],
  [
    "rankDistribution",
    rankDistributionHistoryOptions(APP, RANGE),
    appKeys.rankDistribution(APP, RANGE),
  ],
  [
    "market rankDistribution",
    rankDistributionHistoryOptions(APP, RANGE, "de"),
    appKeys.rankDistribution(APP, RANGE, "de"),
  ],
  ["competitors", competitorsOptions(APP), appKeys.competitors(APP)],
  ["discovery", discoveryOptions(APP, 30), appKeys.discovery(APP, 30)],
  ["changes", changesOptions(APP, 90), appKeys.changes(APP, 90)],
  [
    "changeImpact",
    changeImpactOptions(APP, 90, "us"),
    appKeys.changeImpact(APP, 90, "us"),
  ],
  [
    "reviews",
    reviewsOptions(APP, { score: 1 }),
    appKeys.reviews(APP, { score: 1 }),
  ],
  [
    "reviewsExport",
    reviewsExportOptions(APP, { score: 1 }),
    appKeys.reviews(APP, { score: 1, limit: QUERY_BOUNDS.reviewsLimit.max }),
  ],
  [
    "ratingsHistory",
    ratingsHistoryOptions(APP, RANGE),
    appKeys.ratingsHistory(APP, RANGE),
  ],
  [
    "ratingsHistogram",
    ratingsHistogramOptions(APP),
    appKeys.ratingsHistogram(APP),
  ],
  [
    "marketAvailability",
    marketAvailabilityOptions(APP, "us"),
    appKeys.marketAvailability(APP, "us"),
  ],
  [
    "marketSuggestions",
    marketSuggestionsOptions(APP),
    appKeys.marketSuggestions(APP),
  ],
  ["listingMarkets", listingMarketsOptions(APP), appKeys.listingMarkets(APP)],
  ["listing", appListingOptions(APP, "de"), appKeys.listing(APP, "de")],
  [
    "metadataAudit",
    metadataAuditOptions(APP, "de"),
    appKeys.metadataAudit(APP, "de"),
  ],
  [
    "screenshots",
    screenshotsOptions(APP, "de"),
    appKeys.screenshots(APP, "de"),
  ],
] as const;

const SUGGESTION_OPTIONS = [
  [
    "search suggestions",
    suggestionsOptions(APP, "search", "us"),
    appKeys.suggestions(APP, "search", "us"),
  ],
  [
    "metadata suggestions",
    suggestionsOptions(APP, "metadata", "us"),
    appKeys.suggestions(APP, "metadata", "us"),
  ],
  [
    "picker suggestions",
    pickerSuggestionsOptions(APP, "search", "us"),
    appKeys.suggestions(APP, "search", "us"),
  ],
] as const;

const LOCAL_SUGGESTION_STRATEGIES = [
  "metadata",
  "competitors",
  "seasonal",
  "reviews",
] as const;

const ROOT_TO_LEAF = [
  ["all", appKeys.all, appKeys.detail(APP)],
  ["detail", appKeys.detail(APP), appKeys.summary(APP)],
  [
    "suggestionsRoot",
    appKeys.suggestionsRoot(APP),
    appKeys.suggestions(APP, "search", "us"),
  ],
  [
    "compare to breakdown",
    appKeys.compareRoot(APP),
    appKeys.keywordBreakdown(APP, "kw-1"),
  ],
  ["summary", appKeys.summary(APP), appKeys.summary(APP, "de")],
  [
    "visibility",
    appKeys.visibility(APP, RANGE),
    appKeys.visibility(APP, RANGE, "de"),
  ],
  [
    "rankDistribution",
    appKeys.rankDistribution(APP, RANGE),
    appKeys.rankDistribution(APP, RANGE, "de"),
  ],
  ["keywordsRoot", appKeys.keywordsRoot(APP), appKeys.keywords(APP, "us")],
  [
    "marketKeywordFieldsRoot",
    appKeys.marketKeywordFieldsRoot(APP),
    appKeys.marketKeywordFields(APP, "de"),
  ],
  ["compareRoot", appKeys.compareRoot(APP), appKeys.compare(APP, true)],
  ["serpMoversRoot", appKeys.serpMoversRoot(APP), appKeys.serpMovers(APP, 7)],
  ["discoveryRoot", appKeys.discoveryRoot(APP), appKeys.discovery(APP, 30)],
  ["changesRoot", appKeys.changesRoot(APP), appKeys.changes(APP, 90)],
  [
    "changesRoot impact",
    appKeys.changesRoot(APP),
    appKeys.changeImpact(APP, 90, "us"),
  ],
  ["reviewsRoot", appKeys.reviewsRoot(APP), appKeys.reviews(APP, { score: 1 })],
  [
    "reviewsRoot to an export",
    appKeys.reviewsRoot(APP),
    reviewsExportOptions(APP, { score: 1 }).queryKey,
  ],
  ["actions all", actionKeys.all, actionKeys.list({}, undefined)],
  ["actions appRoot", appKeys.detail(APP), actionKeys.appRoot(APP)],
] as const;

describe("appKeys", () => {
  it("W-QRY-05 keys the reads of each market apart", () => {
    expect(appKeys.marketKeywordFields(APP, "de")).not.toEqual(
      appKeys.marketKeywordFields(APP, "pl"),
    );
  });

  it.each(APP_SCOPED_OPTIONS)(
    "keys the %s query from the hierarchy",
    (_name, options, key) => {
      expect(options.queryKey).toEqual(key);
    },
  );

  it.each(APP_SCOPED_OPTIONS)(
    "scopes the %s query under its app",
    (_name, options) => {
      expect(isPrefixOf(appKeys.detail(APP), options.queryKey)).toBe(true);
    },
  );

  it.each(APP_SCOPED_OPTIONS)(
    "never collides the %s query across apps",
    (_name, options, key) => {
      expect(isPrefixOf(appKeys.detail(OTHER_APP), key)).toBe(false);
      expect(options.queryKey).not.toEqual(
        JSON.parse(JSON.stringify(key).replaceAll(APP, OTHER_APP)),
      );
    },
  );

  it.each(APP_SCOPED_OPTIONS)("serializes the %s key", (_name, options) => {
    expect(JSON.parse(JSON.stringify(options.queryKey))).toEqual(
      options.queryKey,
    );
  });

  it.each(ROOT_TO_LEAF)(
    "invalidating %s reaches its leaves",
    (_name, root, leaf) => {
      expect(isPrefixOf(root, leaf)).toBe(true);
    },
  );

  it("keys every market apart from one market and from another", () => {
    const keys = [
      appKeys.summary(APP),
      appKeys.summary(APP, "de"),
      appKeys.summary(APP, "pl"),
    ].map((key) => JSON.stringify(key));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keys a reviews export apart from the list it was filtered from", () => {
    expect(reviewsExportOptions(APP, { score: 1 }).queryKey).not.toEqual(
      reviewsOptions(APP, { score: 1 }).queryKey,
    );
    expect(REVIEWS_EXPORT_LIMIT).toBe(QUERY_BOUNDS.reviewsLimit.max);
  });

  it("keeps every app scoped key distinct", () => {
    const keys = APP_SCOPED_OPTIONS.map(([, options]) =>
      JSON.stringify(options.queryKey),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keys a change impact report by its window and its market", () => {
    expect(appKeys.changeImpact(APP, 90, "us")).not.toEqual(
      appKeys.changeImpact(APP, 90, "gb"),
    );
    expect(appKeys.changeImpact(APP, 90, "us")).not.toEqual(
      appKeys.changeImpact(APP, 30, "us"),
    );
  });

  it("keeps the key of the home change timeline as it was", () => {
    expect(appKeys.changes(APP, 90, undefined)).toEqual(
      appKeys.changes(APP, 90),
    );
  });

  it("keys the change timeline of each market apart", () => {
    expect(appKeys.changes(APP, 90, "de")).not.toEqual(
      appKeys.changes(APP, 90),
    );
    expect(appKeys.changes(APP, 90, "de")).not.toEqual(
      appKeys.changes(APP, 90, "pl"),
    );
  });

  it("audits the home listing without naming its country", async () => {
    const requested: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      requested.push(String(input));
      return Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const options = metadataAuditOptions(APP, queryMarket("us", "us"));
    await new QueryClient().fetchQuery(options);
    vi.unstubAllGlobals();

    expect(options.queryKey).toEqual(appKeys.metadataAudit(APP));
    expect(requested[0]).toMatch(/\/apps\/app-1\/metadata\/audit$/);
  });

  it("keys the metadata audit and the listing of each market apart", () => {
    expect(appKeys.metadataAudit(APP, "de")).not.toEqual(
      appKeys.metadataAudit(APP, "pl"),
    );
    expect(appKeys.screenshots(APP, "de")).not.toEqual(
      appKeys.screenshots(APP),
    );
    expect(appKeys.listing(APP, "de")).not.toEqual(appKeys.listing(APP, "pl"));
  });

  it("refreshes every listing of an app when one is invalidated", () => {
    const client = new QueryClient();
    client.setQueryData(appKeys.listing(APP, "de"), {});
    client.setQueryData(appKeys.metadataAudit(APP, "de"), {});
    client.setQueryData(appKeys.screenshots(APP, "de"), {});

    invalidateAppListing(client, APP);

    expect(
      client.getQueryState(appKeys.screenshots(APP, "de"))?.isInvalidated,
    ).toBe(true);

    expect(
      client.getQueryState(appKeys.listing(APP, "de"))?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(appKeys.metadataAudit(APP, "de"))?.isInvalidated,
    ).toBe(true);
  });

  it("refreshes what a run collects without asking for the run status again", () => {
    const client = new QueryClient();
    client.setQueryData(appKeys.keywords(APP, "de"), []);
    client.setQueryData(appKeys.listing(APP, "de"), {});
    client.setQueryData(appKeys.runStatus(APP), {});

    invalidateRunResults(client, APP);

    expect(
      client.getQueryState(appKeys.keywords(APP, "de"))?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(appKeys.listing(APP, "de"))?.isInvalidated,
    ).toBe(true);
    expect(client.getQueryState(appKeys.runStatus(APP))?.isInvalidated).toBe(
      false,
    );
  });

  it("keys a deep search by its storefront", () => {
    expect(appKeys.spider(APP, "fitness", "de")).not.toEqual(
      appKeys.spider(APP, "fitness", "us"),
    );
  });

  it("keys a name search by its store, storefront and name rather than by an app", () => {
    const options = storeSearchOptions("APP_STORE", "us", "focus");

    expect(options.queryKey).toEqual(
      storeSearchKey("APP_STORE", "us", "focus"),
    );
    expect(options.retry).toBe(false);
    expect(isPrefixOf(appKeys.all, options.queryKey)).toBe(false);
    expect(storeSearchKey("APP_STORE", "us", "focus")).not.toEqual(
      storeSearchKey("GOOGLE_PLAY", "us", "focus"),
    );
    expect(storeSearchKey("APP_STORE", "us", "focus")).not.toEqual(
      storeSearchKey("APP_STORE", "de", "focus"),
    );
  });

  it("keys competitor suggestions outside the app so only a competitor change refetches them", async () => {
    const client = new QueryClient();
    const options = competitorSuggestionsOptions(APP);
    client.setQueryData(options.queryKey, {
      store: "APP_STORE",
      country: "us",
      similar: "ok",
      items: [],
    });

    expect(options.queryKey).toEqual(appKeys.competitorSuggestions(APP));
    expect(options.retry).toBe(false);
    expect(isPrefixOf(appKeys.detail(APP), options.queryKey)).toBe(false);

    await client.invalidateQueries({ queryKey: appKeys.detail(APP) });
    expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(false);

    invalidateCompetitorMutation(client, APP);
    expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
  });

  it.each(SUGGESTION_OPTIONS)(
    "keys the %s query from the hierarchy",
    (_name, options, key) => {
      expect(options.queryKey).toEqual(key);
    },
  );

  it.each(SUGGESTION_OPTIONS)(
    "never collides the %s query across apps",
    (_name, options, key) => {
      expect(isPrefixOf(appKeys.suggestionsRoot(OTHER_APP), key)).toBe(false);
      expect(options.queryKey).not.toEqual(
        JSON.parse(JSON.stringify(key).replaceAll(APP, OTHER_APP)),
      );
    },
  );

  it.each(SUGGESTION_OPTIONS)("serializes the %s key", (_name, options) => {
    expect(JSON.parse(JSON.stringify(options.queryKey))).toEqual(
      options.queryKey,
    );
  });

  it("keys a serp by its keyword rather than by an app", () => {
    expect(serpOptions("kw-1").queryKey).toEqual(appKeys.serp("kw-1"));
    expect(isPrefixOf(appKeys.all, appKeys.serp("kw-1"))).toBe(false);
  });
});

describe("localized listing keys", () => {
  it("keeps the key of a default listing and extends it for a localization", () => {
    expect(appKeys.metadataAudit(APP, "pl")).toEqual(
      appKeys.metadataAudit(APP, "pl", undefined),
    );
    expect(appKeys.metadataAudit(APP, "pl", "pl")).not.toEqual(
      appKeys.metadataAudit(APP, "pl"),
    );
    expect(appKeys.screenshots(APP, "pl", "pl")).not.toEqual(
      appKeys.screenshots(APP, "pl"),
    );
  });

  it("invalidates a localized listing with the rest of the app", () => {
    const client = new QueryClient();
    client.setQueryData(appKeys.metadataAudit(APP, "pl", "pl"), {});
    client.setQueryData(appKeys.screenshots(APP, "pl", "pl"), {});

    invalidateAppListing(client, APP);

    expect(
      client.getQueryState(appKeys.metadataAudit(APP, "pl", "pl"))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(appKeys.screenshots(APP, "pl", "pl"))?.isInvalidated,
    ).toBe(true);
  });
});

describe("chartKeys", () => {
  const QUERY = {
    store: "APP_STORE",
    country: "us",
    collection: "free",
    genre: "6014",
    device: "iphone",
    compare: "1d",
  } as const;

  it("carries the whole query in the page key", () => {
    expect(chartPageOptions(QUERY).queryKey).toEqual(["charts", "page", QUERY]);
  });

  it("keeps two days of one chart apart", () => {
    expect(
      chartPageOptions({ ...QUERY, date: "2026-10-12" }).queryKey,
    ).not.toEqual(chartPageOptions({ ...QUERY, date: "2026-10-13" }).queryKey);
  });

  it("seeds the newest page of the captured chart and marks the rest stale", () => {
    const client = new QueryClient();
    const older = { ...QUERY, date: "2026-10-12" };
    client.setQueryData(chartKeys.page(older), { stale: true });
    const page = {
      chart: { ...QUERY, genreName: "Games" },
      compare: "1d",
    } as unknown as ChartPage;

    seedChartCapture(client, page);

    expect(client.getQueryData(chartKeys.page(QUERY))).toBe(page);
    expect(client.getQueryState(chartKeys.page(QUERY))?.isInvalidated).toBe(
      false,
    );
    expect(client.getQueryState(chartKeys.page(older))?.isInvalidated).toBe(
      true,
    );
  });

  it("invalidates every chart page after a follow changes", () => {
    const client = new QueryClient();
    client.setQueryData(chartKeys.page(QUERY), {});

    invalidateChartMutation(client);

    expect(client.getQueryState(chartKeys.page(QUERY))?.isInvalidated).toBe(
      true,
    );
  });

  it("reaches every chart page from the chart root", () => {
    expect(isPrefixOf(chartKeys.all, chartPageOptions(QUERY).queryKey)).toBe(
      true,
    );
  });
});

describe("actionKeys", () => {
  it("separates a global action list from an app scoped one", () => {
    expect(actionsOptions({}, APP).queryKey).not.toEqual(
      actionsOptions({}, undefined).queryKey,
    );
  });

  it("keeps the detail and the activity under the action root", () => {
    expect(
      isPrefixOf(actionKeys.all, actionDetailOptions("act-1").queryKey),
    ).toBe(true);
    expect(
      isPrefixOf(actionKeys.all, actionActivityOptions({ days: 30 }).queryKey),
    ).toBe(true);
  });

  it("prefixes every action list with the lists key", () => {
    expect(isPrefixOf(actionKeys.lists, actionsOptions({}).queryKey)).toBe(
      true,
    );
    expect(
      isPrefixOf(
        actionKeys.lists,
        actionsOptions({ status: ["DONE"] }, APP).queryKey,
      ),
    ).toBe(true);
  });

  it("keeps the app scoped summary under the action root", () => {
    const scoped = actionSummaryFor(APP).queryKey;

    expect(isPrefixOf(actionKeys.all, scoped)).toBe(true);
    expect(scoped).not.toEqual(actionSummaryOptions.queryKey);
  });

  it("separates action lists by their filters", () => {
    expect(actionsOptions({ status: ["OPEN"] }).queryKey).not.toEqual(
      actionsOptions({ status: ["DONE"] }).queryKey,
    );
  });
});

describe("invalidation sets", () => {
  it("invalidates every query of the app once its listing settles", () => {
    expect(
      invalidatedKeys((client) => invalidateAppListing(client, APP)),
    ).toEqual([
      appKeys.detail(APP),
      portfolioKey,
      appKeys.suggestionsRoot(APP),
    ]);
  });

  it("invalidates only the keyword list when keywords are refetched", () => {
    expect(
      invalidatedKeys((client) => invalidateKeywords(client, APP)),
    ).toEqual([appKeys.keywordsRoot(APP)]);
  });

  it("refreshes the audit, its history and the app actions after a run", () => {
    expect(invalidatedKeys((client) => invalidateAudit(client, APP))).toEqual([
      appKeys.audit(APP),
      [...appKeys.detail(APP), "audit-history"],
      actionKeys.appRoot(APP),
    ]);
  });

  it("invalidates everything a keyword mutation changes", () => {
    expect(
      invalidatedKeys((client) => invalidateKeywordMutation(client, APP)),
    ).toEqual([
      appKeys.audit(APP),
      appKeys.keywordsRoot(APP),
      appKeys.keywordCountries(APP),
      appKeys.keywordFieldRoot(APP),
      appKeys.summary(APP),
      appKeys.compareRoot(APP),
      portfolioKey,
      appKeys.localizations(APP),
      appKeys.marketKeywordFieldsRoot(APP),
      appKeys.marketSuggestions(APP),
      appKeys.firstRun(APP),
    ]);
  });

  it("refreshes the listing markets and the budget after a market seed", () => {
    expect(
      invalidatedKeys((client) => {
        void invalidateMarketSeed(client, APP);
      }),
    ).toEqual([
      appKeys.audit(APP),
      appKeys.keywordsRoot(APP),
      appKeys.keywordCountries(APP),
      appKeys.keywordFieldRoot(APP),
      appKeys.summary(APP),
      appKeys.compareRoot(APP),
      portfolioKey,
      appKeys.localizations(APP),
      appKeys.marketKeywordFieldsRoot(APP),
      appKeys.marketSuggestions(APP),
      appKeys.firstRun(APP),
      appKeys.listingMarkets(APP),
      budgetKey,
    ]);
  });

  it("invalidates the metadata audit after a keyword field save", () => {
    expect(
      invalidatedKeys((client) => invalidateKeywordFieldMutation(client, APP)),
    ).toEqual([
      appKeys.audit(APP),
      appKeys.keywordsRoot(APP),
      appKeys.keywordCountries(APP),
      appKeys.keywordFieldRoot(APP),
      appKeys.summary(APP),
      appKeys.compareRoot(APP),
      portfolioKey,
      appKeys.localizations(APP),
      appKeys.marketKeywordFieldsRoot(APP),
      appKeys.marketSuggestions(APP),
      appKeys.firstRun(APP),
      appKeys.metadataAuditRoot(APP),
    ]);
  });

  it("W-QRY-02 refreshes the localizations and the plan after a localization mutation", () => {
    expect(
      invalidatedKeys((client) => invalidateLocalizationMutation(client, APP)),
    ).toEqual([
      appKeys.audit(APP),
      appKeys.keywordsRoot(APP),
      appKeys.keywordCountries(APP),
      appKeys.keywordFieldRoot(APP),
      appKeys.summary(APP),
      appKeys.compareRoot(APP),
      portfolioKey,
      appKeys.localizations(APP),
      appKeys.marketKeywordFieldsRoot(APP),
      appKeys.marketSuggestions(APP),
      appKeys.firstRun(APP),
      appKeys.metadataAuditRoot(APP),
      accountPlanKey,
    ]);
  });

  it("invalidates a keyword import with the preview it was planned from", () => {
    expect(
      invalidatedKeys((client) => invalidateKeywordImport(client, APP)),
    ).toEqual([
      appKeys.audit(APP),
      appKeys.keywordsRoot(APP),
      appKeys.keywordCountries(APP),
      appKeys.keywordFieldRoot(APP),
      appKeys.summary(APP),
      appKeys.compareRoot(APP),
      portfolioKey,
      appKeys.localizations(APP),
      appKeys.marketKeywordFieldsRoot(APP),
      appKeys.marketSuggestions(APP),
      appKeys.firstRun(APP),
      appKeys.importPreviewRoot(APP),
    ]);
  });

  it("refreshes the setup and the portfolio after a setup mutation", () => {
    expect(
      invalidatedKeys((client) => {
        void invalidateSetupMutation(client, APP);
      }),
    ).toEqual([setupKey(APP), portfolioKey]);
  });

  it("marks the review lists and the themes stale after a reply change", () => {
    expect(
      invalidatedKeys((client) => invalidateReviewReplyMutation(client, APP)),
    ).toEqual([appKeys.reviewsRoot(APP), appKeys.reviewThemesRoot(APP)]);
  });

  it("invalidates everything a competitor mutation changes", () => {
    expect(
      invalidatedKeys((client) => invalidateCompetitorMutation(client, APP)),
    ).toEqual([
      appKeys.detail(APP),
      appKeys.discoveryRoot(APP),
      appKeys.competitorSuggestions(APP),
      appKeys.serpMoversRoot(APP),
      portfolioKey,
      appKeys.firstRun(APP),
      appKeys.suggestionsRoot(APP),
    ]);
  });

  it("invalidates both sides of a link mutation and the portfolio", () => {
    expect(
      invalidatedKeys((client) =>
        invalidateLinkMutation(client, APP, OTHER_APP),
      ),
    ).toEqual([
      appKeys.detail(APP),
      appKeys.detail(OTHER_APP),
      appKeys.all,
      portfolioKey,
    ]);
  });

  it("invalidates the whole action surface for a global action mutation", () => {
    expect(
      invalidatedKeys((client) => invalidateActionMutation(client)),
    ).toEqual([actionKeys.all, portfolioInsightsKey]);
  });

  it("also invalidates the app action list for an app scoped action mutation", () => {
    expect(
      invalidatedKeys((client) => invalidateActionMutation(client, APP)),
    ).toEqual([actionKeys.all, portfolioInsightsKey, actionKeys.appRoot(APP)]);
  });

  it("invalidates every account query when the session changes", () => {
    expect(invalidatedKeys(invalidateAuth)).toEqual([
      authStatusKey,
      authMeKey,
      accountPlanKey,
    ]);
  });

  it("also invalidates the api token list when the password changes", () => {
    expect(invalidatedKeys(invalidatePasswordChange)).toEqual([
      authStatusKey,
      authMeKey,
      accountPlanKey,
      apiTokenKeys.all,
    ]);
  });

  it.each([
    ["api token", invalidateApiTokenMutation, apiTokenKeys.all],
    ["webhook", invalidateWebhookMutation, webhookKeys.all],
    ["email alert", invalidateEmailAlertMutation, emailAlertKeys.all],
    ["ai allowance", invalidateAiUsage, accountPlanKey],
  ] as const)("invalidates only the %s list", (_name, invalidate, key) => {
    expect(invalidatedKeys(invalidate)).toEqual([key]);
  });
});

describe("seeding a saved alert channel", () => {
  const webhook = (id: string, url: string): WebhookItem => ({
    id,
    url,
    events: ["metadata.changed"],
    active: true,
    hasSecret: false,
    createdAt: "2026-09-25T00:00:00.000Z",
  });

  it("replaces only the saved webhook in the cached list", () => {
    const client = new QueryClient();
    const other = webhook("hook-2", "https://hooks.example.com/b");
    client.setQueryData(webhookKeys.all, [
      webhook("hook-1", "https://hooks.example.com/a"),
      other,
    ]);
    const saved: WebhookItem = {
      ...webhook("hook-1", "https://hooks.example.com/a"),
      events: ["rank.milestone"],
    };

    seedWebhook(client, saved);

    expect(client.getQueryData(webhookKeys.all)).toEqual([saved, other]);
  });

  it("replaces the saved email alert and leaves an empty cache empty", () => {
    const client = new QueryClient();
    const saved: EmailAlertItem = {
      id: "email-1",
      email: "ops@example.com",
      events: ["rank.first"],
      active: true,
      createdAt: "2026-09-25T00:00:00.000Z",
    };

    seedEmailAlert(client, saved);
    expect(client.getQueryData(emailAlertKeys.all)).toBeUndefined();

    client.setQueryData(emailAlertKeys.all, [
      { ...saved, events: ["metadata.changed"] },
    ]);
    seedEmailAlert(client, saved);
    expect(client.getQueryData(emailAlertKeys.all)).toEqual([saved]);
  });
});

describe("portfolio insights key", () => {
  it("sits under the portfolio key so a portfolio invalidation reaches it", () => {
    expect(isPrefixOf(portfolioKey, portfolioInsightsKey)).toBe(true);
    expect(portfolioInsightsOptions.queryKey).toEqual(portfolioInsightsKey);
  });
});

describe("setup key", () => {
  it("sits outside the app detail so a listing or competitor invalidation never refetches it mid save", () => {
    expect(isPrefixOf(appKeys.detail(APP), setupKey(APP))).toBe(false);
    expect(isPrefixOf(appKeys.all, setupKey(APP))).toBe(false);
    expect(setupOptions(APP).queryKey).toEqual(setupKey(APP));
  });

  it("refetches whenever another tab or device may have changed it", () => {
    expect(setupOptions(APP).staleTime).toBe(0);
    expect(setupOptions(APP).refetchOnWindowFocus).toBe(true);
  });
});

describe("admin keys", () => {
  it("keeps every admin key under the admin root", () => {
    for (const key of [
      adminKeys.overview(),
      adminKeys.capacity(),
      adminKeys.proxyPool(),
      adminKeys.workspaces(),
      adminKeys.users(),
      adminKeys.users("ws_1"),
      adminKeys.apps(),
      adminKeys.apps("ws_1"),
    ]) {
      expect(isPrefixOf(adminKeys.all, key)).toBe(true);
      expect(isPrefixOf(appKeys.all, key)).toBe(false);
    }
  });

  it("caches one workspace's list apart from the whole list", () => {
    expect(adminKeys.users("ws_1")).not.toEqual(adminKeys.users());
    expect(adminKeys.apps("ws_1")).not.toEqual(adminKeys.apps());
  });
});

describe("standalone keys", () => {
  it.each([
    ["portfolio", portfolioKey],
    ["health", healthKey],
    ["budget", budgetKey],
    ["alerts config", alertsConfigKey],
    ["webhooks", webhookKeys.all],
    ["email alerts", emailAlertKeys.all],
    ["api tokens", apiTokenKeys.all],
    ["auth status", authStatusKey],
    ["auth me", authMeKey],
  ] as const)("keeps the %s key outside the app hierarchy", (_name, key) => {
    expect(isPrefixOf(appKeys.all, key)).toBe(false);
  });
});

describe("auditOptions polling", () => {
  const withRun = (state: AuditAiRunState | null): AppAuditResult => ({
    ...APP_AUDIT_EXAMPLE,
    ai: {
      ...APP_AUDIT_EXAMPLE.ai,
      run: state
        ? { state, requestedAt: null, finishedAt: null, error: null }
        : null,
    },
  });

  it.each([
    [null, false],
    ["queued", AUDIT_RUN_POLL_MS],
    ["running", AUDIT_RUN_POLL_MS],
    ["completed", false],
    ["failed", false],
  ] as const)("polls a %s run: %s", (state, interval) => {
    const options = auditOptions("app-1");
    const refetchInterval = options.refetchInterval as (query: {
      state: { data: AppAuditResult };
    }) => number | false;

    expect(refetchInterval({ state: { data: withRun(state) } })).toBe(interval);
  });
});

describe("keyword suggestion keys", () => {
  it("keys keyword suggestions outside the app so app invalidations never refetch a store lookup", async () => {
    const client = new QueryClient();
    const keys = STORE_SUGGESTION_STRATEGIES.map(
      (strategy) => suggestionsOptions(APP, strategy, "us").queryKey,
    );
    for (const key of keys) client.setQueryData(key, []);

    for (const key of keys) {
      expect(isPrefixOf(appKeys.detail(APP), key)).toBe(false);
      expect(isPrefixOf(appKeys.suggestionsRoot(APP), key)).toBe(true);
    }

    await client.invalidateQueries({ queryKey: appKeys.detail(APP) });
    invalidateCompetitorMutation(client, APP);
    invalidateAppListing(client, APP);
    invalidateRunResults(client, APP);

    for (const key of keys) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }
  });

  it("keeps a store lookup for a day and never retries it", () => {
    for (const strategy of STORE_SUGGESTION_STRATEGIES) {
      const options = suggestionsOptions(APP, strategy, "us");
      expect(options.staleTime).toBe(24 * 60 * 60 * 1000);
      expect(options.retry).toBe(false);
    }
  });

  it("leaves the local sources on the default freshness", () => {
    for (const strategy of LOCAL_SUGGESTION_STRATEGIES) {
      const options = suggestionsOptions(APP, strategy, "us");
      expect(options.staleTime).toBeUndefined();
      expect(options.retry).toBeUndefined();
    }
  });

  it.each([
    ["the listing settles", invalidateAppListing],
    ["a competitor changes", invalidateCompetitorMutation],
    ["a run stage lands", invalidateRunResults],
  ] as const)(
    "refreshes the local sources with the rest of the app when %s",
    (_when, invalidate) => {
      const client = new QueryClient();
      const keys = LOCAL_SUGGESTION_STRATEGIES.map(
        (strategy) => suggestionsOptions(APP, strategy, "us").queryKey,
      );
      for (const key of keys) client.setQueryData(key, []);

      invalidate(client, APP);

      for (const key of keys) {
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      }
    },
  );

  it("keeps the setup picker at a day for the listing source", () => {
    expect(pickerSuggestionsOptions(APP, "metadata", "us").staleTime).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(pickerSuggestionsOptions(APP, "search", "us").queryKey).toEqual(
      suggestionsOptions(APP, "search", "us").queryKey,
    );
  });

  it("keys a lookup by its storefront and app", () => {
    expect(appKeys.suggestions(APP, "search", "de")).not.toEqual(
      appKeys.suggestions(APP, "search", "us"),
    );
    expect(appKeys.suggestions(APP, "search", "us")).not.toEqual(
      appKeys.suggestions(OTHER_APP, "search", "us"),
    );
  });

  it("drops every suggestion of a deleted app", () => {
    const client = new QueryClient();
    client.setQueryData(appKeys.summary(APP), {});
    client.setQueryData(appKeys.suggestions(APP, "search", "us"), []);
    client.setQueryData(appKeys.suggestions(OTHER_APP, "search", "us"), []);

    removeAppQueries(client, APP);

    expect(client.getQueryState(appKeys.summary(APP))).toBeUndefined();
    expect(
      client.getQueryState(appKeys.suggestions(APP, "search", "us")),
    ).toBeUndefined();
    expect(
      client.getQueryState(appKeys.suggestions(OTHER_APP, "search", "us")),
    ).toBeDefined();
  });
});

describe("refetchFailedQueries", () => {
  it("refetches the queries in error and nothing else", async () => {
    const client = new QueryClient();
    let apiUp = false;
    const apps = vi.fn(async () => {
      if (!apiUp) throw new Error("down");
      return ["app"];
    });
    const health = vi.fn(async () => "ok");
    const me = vi.fn(async () => "me");
    const observers = [
      new QueryObserver(client, {
        queryKey: ["apps"],
        queryFn: apps,
        retry: false,
      }),
      new QueryObserver(client, {
        queryKey: ["health"],
        queryFn: health,
        retry: false,
      }),
      new QueryObserver(client, {
        queryKey: ["me"],
        queryFn: me,
        retry: false,
        enabled: false,
      }),
    ];
    const unsubscribe = observers.map((observer) =>
      observer.subscribe(() => undefined),
    );
    await vi.waitFor(() =>
      expect(observers[0].getCurrentResult().status).toBe("error"),
    );

    apiUp = true;
    await refetchFailedQueries(client);

    expect(observers[0].getCurrentResult().data).toEqual(["app"]);
    expect(apps).toHaveBeenCalledTimes(2);
    expect(health).toHaveBeenCalledTimes(1);
    expect(me).not.toHaveBeenCalled();
    unsubscribe.forEach((stop) => stop());
  });

  it("refetches a failed query nobody observes, so its next reader finds the fetch", async () => {
    const client = new QueryClient();
    const page = vi.fn(async () => {
      throw new Error("down");
    });
    await client.prefetchQuery({
      queryKey: ["page"],
      queryFn: page,
      retry: false,
    });

    await refetchFailedQueries(client);

    expect(page).toHaveBeenCalledTimes(2);
  });
});
