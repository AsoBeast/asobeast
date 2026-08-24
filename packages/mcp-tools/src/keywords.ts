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
      "Tracked keywords for one app with traffic, difficulty and opportunity scores (0-100) and the latest checked position. Position is 1-based; null means checked but not found within the row's latestDepth (render as >latestDepth), and a null latestDepth means the keyword has never been checked. Keywords are per-market: pass country to scope to one storefront.",
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
