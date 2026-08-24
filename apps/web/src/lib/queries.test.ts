import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  actionKeys,
  actionsOptions,
  alertsConfigKey,
  apiTokenKeys,
  appKeys,
  appDetailOptions,
  appSummaryOptions,
  auditHistoryOptions,
  accountPlanKey,
  authMeKey,
  authStatusKey,
  budgetKey,
  categoryRanksOptions,
  changesOptions,
  competitorsOptions,
  comparisonOptions,
  discoveryOptions,
  emailAlertKeys,
  healthKey,
  invalidateApiTokenMutation,
  invalidateActionMutation,
  invalidateAuth,
  invalidateCompetitorMutation,
  invalidateEmailAlertMutation,
  invalidateKeywordMutation,
  invalidateKeywords,
  invalidateLinkMutation,
  invalidateWebhookMutation,
  keywordCountriesOptions,
  keywordsOptions,
  marketAvailabilityOptions,
  portfolioKey,
  rankDistributionHistoryOptions,
  rankingsOptions,
  ratingsHistogramOptions,
  ratingsHistoryOptions,
  reviewsOptions,
  serpMoversOptions,
  serpOptions,
  spiderOptions,
  suggestionsOptions,
  visibilityOptions,
  webhookKeys,
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
  [
    "keywords",
    keywordsOptions(APP, "traffic", "us"),
    appKeys.keywords(APP, "traffic", "us"),
  ],
  [
    "keywordCountries",
    keywordCountriesOptions(APP),
    appKeys.keywordCountries(APP),
  ],
  [
    "suggestions",
    suggestionsOptions(APP, "metadata", "us"),
    appKeys.suggestions(APP, "metadata", "us"),
  ],
  [
    "spider",
    spiderOptions(APP, "fitness", "de"),
    appKeys.spider(APP, "fitness", "de"),
  ],
  ["comparison", comparisonOptions(APP, true), appKeys.compare(APP, true)],
  ["rankings", rankingsOptions(APP, RANGE), appKeys.rankings(APP, RANGE)],
  ["serpMovers", serpMoversOptions(APP, 7), appKeys.serpMovers(APP, 7)],
  ["visibility", visibilityOptions(APP, RANGE), appKeys.visibility(APP, RANGE)],
  [
    "categoryRanks",
    categoryRanksOptions(APP, RANGE),
    appKeys.categoryRanks(APP, RANGE),
  ],
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
  ["competitors", competitorsOptions(APP), appKeys.competitors(APP)],
  ["discovery", discoveryOptions(APP, 30), appKeys.discovery(APP, 30)],
  ["changes", changesOptions(APP, 90), appKeys.changes(APP, 90)],
  [
    "reviews",
    reviewsOptions(APP, { score: 1 }),
    appKeys.reviews(APP, { score: 1 }),
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
] as const;

const ROOT_TO_LEAF = [
  ["all", appKeys.all, appKeys.detail(APP)],
  ["detail", appKeys.detail(APP), appKeys.summary(APP)],
  [
    "keywordsRoot",
    appKeys.keywordsRoot(APP),
    appKeys.keywords(APP, "traffic", "us"),
  ],
  ["compareRoot", appKeys.compareRoot(APP), appKeys.compare(APP, true)],
  ["serpMoversRoot", appKeys.serpMoversRoot(APP), appKeys.serpMovers(APP, 7)],
  ["discoveryRoot", appKeys.discoveryRoot(APP), appKeys.discovery(APP, 30)],
  ["changesRoot", appKeys.changesRoot(APP), appKeys.changes(APP, 90)],
  ["reviewsRoot", appKeys.reviewsRoot(APP), appKeys.reviews(APP, { score: 1 })],
  ["actions all", actionKeys.all, actionKeys.list({}, undefined)],
  ["actions appRoot", appKeys.detail(APP), actionKeys.appRoot(APP)],
] as const;

describe("appKeys", () => {
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

  it("keeps every app scoped key distinct", () => {
    const keys = APP_SCOPED_OPTIONS.map(([, options]) =>
      JSON.stringify(options.queryKey),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keys a deep search by its storefront", () => {
    expect(appKeys.spider(APP, "fitness", "de")).not.toEqual(
      appKeys.spider(APP, "fitness", "us"),
    );
  });

  it("keys a serp by its keyword rather than by an app", () => {
    expect(serpOptions("kw-1").queryKey).toEqual(appKeys.serp("kw-1"));
    expect(isPrefixOf(appKeys.all, appKeys.serp("kw-1"))).toBe(false);
  });
});

describe("actionKeys", () => {
  it("separates a global action list from an app scoped one", () => {
    expect(actionsOptions({}, APP).queryKey).not.toEqual(
      actionsOptions({}, undefined).queryKey,
    );
  });

  it("separates action lists by their filters", () => {
    expect(actionsOptions({ status: ["OPEN"] }).queryKey).not.toEqual(
      actionsOptions({ status: ["DONE"] }).queryKey,
    );
  });
});

describe("invalidation sets", () => {
  it("invalidates only the keyword list when keywords are refetched", () => {
    expect(
      invalidatedKeys((client) => invalidateKeywords(client, APP)),
    ).toEqual([appKeys.keywordsRoot(APP)]);
  });

  it("invalidates everything a keyword mutation changes", () => {
    expect(
      invalidatedKeys((client) => invalidateKeywordMutation(client, APP)),
    ).toEqual([
      appKeys.keywordsRoot(APP),
      appKeys.keywordCountries(APP),
      appKeys.summary(APP),
      appKeys.compareRoot(APP),
    ]);
  });

  it("invalidates everything a competitor mutation changes", () => {
    expect(
      invalidatedKeys((client) => invalidateCompetitorMutation(client, APP)),
    ).toEqual([
      appKeys.detail(APP),
      appKeys.discoveryRoot(APP),
      appKeys.serpMoversRoot(APP),
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
    ).toEqual([actionKeys.all]);
  });

  it("also invalidates the app action list for an app scoped action mutation", () => {
    expect(
      invalidatedKeys((client) => invalidateActionMutation(client, APP)),
    ).toEqual([actionKeys.all, actionKeys.appRoot(APP)]);
  });

  it("invalidates every account query when the session changes", () => {
    expect(invalidatedKeys(invalidateAuth)).toEqual([
      authStatusKey,
      authMeKey,
      accountPlanKey,
    ]);
  });

  it.each([
    ["api token", invalidateApiTokenMutation, apiTokenKeys.all],
    ["webhook", invalidateWebhookMutation, webhookKeys.all],
    ["email alert", invalidateEmailAlertMutation, emailAlertKeys.all],
  ] as const)("invalidates only the %s list", (_name, invalidate, key) => {
    expect(invalidatedKeys(invalidate)).toEqual([key]);
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
