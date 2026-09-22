import { z } from "zod";
import {
  COUNTRY_PATTERN,
  KEYWORD_SORTS,
  KEYWORD_SUGGESTION_STRATEGIES,
  QUERY_BOUNDS,
} from "@asobeast/shared";
import { defineReadTool, seg, type ReadTool } from "./define";

export const KEYWORD_TOOLS: ReadTool[] = [
  defineReadTool({
    name: "list_keywords",
    title: "List tracked keywords",
    description:
      "Tracked keywords for one app with popularity (the traffic field) and difficulty on the stored 0 to 10 scale, volume and opportunity on a 0 to 100 scale, and the latest checked position. Position is 1-based; null means checked but not found within the row's latestDepth (render as >latestDepth), and a null latestDepth means the keyword has never been checked. Keywords are per-market: pass country to scope to one storefront. Each scored row may carry scoreSignals: how early the store suggests the phrase (suggestReach with the prefix length and position), how much of the first page targets it (serpRelevance), page flags (brand, weak_leader, small_serp, padded), Apple's officialPopularity when the operator connected Apple Ads, and the estimate it replaced. scoreOutdated true means the row predates the current formula and is being rescored. Popularity is an estimate unless scoreProvenance.source is APPLE_ADS_POPULARITY. On Google Play a suggestReach of absent means the store never suggests the phrase, so do not recommend targeting it; the App Store estimate ignores suggest reach, because Apple does not suggest many common searches.",
    inputSchema: z.object({
      appId: z.string().describe("The app id from list_apps."),
      sort: z
        .enum(KEYWORD_SORTS)
        .optional()
        .describe("Sort order for the returned keywords."),
      country: z
        .string()
        .regex(COUNTRY_PATTERN)
        .optional()
        .describe("Two-letter storefront code to filter keywords by market."),
    }),
    request: ({ appId, sort, country }) => ({
      path: `/apps/${seg(appId)}/keywords`,
      params: { sort, country },
    }),
  }),

  defineReadTool({
    name: "keyword_suggestions",
    title: "Keyword suggestions",
    description:
      "Suggested keywords for one app from a chosen strategy (metadata, search, similar, developer, competitors, seasonal or reviews). Read-only lookup; nothing is tracked.",
    inputSchema: z.object({
      appId: z.string().describe("The app id from list_apps."),
      strategy: z
        .enum(KEYWORD_SUGGESTION_STRATEGIES)
        .describe("Which suggestion source to draw candidates from."),
      limit: z
        .number()
        .int()
        .min(QUERY_BOUNDS.suggestionsLimit.min)
        .max(QUERY_BOUNDS.suggestionsLimit.max)
        .optional()
        .describe(
          `Maximum number of suggestions to return (${QUERY_BOUNDS.suggestionsLimit.min}-${QUERY_BOUNDS.suggestionsLimit.max}). Defaults to ${QUERY_BOUNDS.suggestionsLimit.default}.`,
        ),
      country: z
        .string()
        .regex(COUNTRY_PATTERN)
        .optional()
        .describe("Two-letter storefront code to scope the lookup."),
    }),
    request: ({ appId, strategy, limit, country }) => ({
      path: `/apps/${seg(appId)}/keywords/suggestions`,
      params: { strategy, limit, country },
    }),
  }),
];
