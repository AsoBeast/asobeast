import { z } from "zod";
import { QUERY_BOUNDS, UTC_DATE_PATTERN } from "@asobeast/shared";
import { defineReadTool, seg, type ReadTool } from "./define";

const appId = z.string().describe("The app id from list_apps.");
const from = z
  .string()
  .regex(UTC_DATE_PATTERN)
  .optional()
  .describe("Inclusive start date as a UTC date string (YYYY-MM-DD).");
const to = z
  .string()
  .regex(UTC_DATE_PATTERN)
  .optional()
  .describe("Inclusive end date as a UTC date string (YYYY-MM-DD).");

function joinIds(ids: string[] | undefined): string | undefined {
  return ids && ids.length > 0 ? ids.join(",") : undefined;
}

export const INSIGHT_TOOLS: ReadTool[] = [
  defineReadTool({
    name: "ranking_history",
    title: "Ranking history",
    description:
      "Daily position history for one app's tracked keywords over a date window. Positions are 1-based; null means checked but not found within the depth carried by each point (render as >100 or >200). Charts read best with a reversed Y axis (position 1 on top). Omit keywordIds for every tracked keyword.",
    inputSchema: z.object({
      appId,
      keywordIds: z
        .array(z.string())
        .optional()
        .describe("Restrict the series to these tracked keyword ids."),
      from,
      to,
    }),
    request: ({ appId, keywordIds, from, to }) => ({
      path: `/apps/${seg(appId)}/rankings`,
      params: { from, to, keywordIds: joinIds(keywordIds) },
    }),
  }),

  defineReadTool({
    name: "serp_snapshot",
    title: "SERP snapshot",
    description:
      "The stored search-results snapshot for one tracked keyword: the ranked apps captured on a given day. Omit date for the most recent snapshot. Dates are UTC date strings (YYYY-MM-DD).",
    inputSchema: z.object({
      keywordId: z.string().describe("The tracked keyword id."),
      date: z
        .string()
        .regex(UTC_DATE_PATTERN)
        .optional()
        .describe("UTC date string (YYYY-MM-DD) of the snapshot to fetch."),
    }),
    request: ({ keywordId, date }) => ({
      path: `/keywords/${seg(keywordId)}/serp`,
      params: { date },
    }),
  }),

  defineReadTool({
    name: "serp_movers",
    title: "SERP movers",
    description:
      "Keywords whose search-results order shifted most for one app over the last N days — useful for spotting where competition changed.",
    inputSchema: z.object({
      appId,
      days: z
        .number()
        .int()
        .min(QUERY_BOUNDS.serpMoverDays.min)
        .max(QUERY_BOUNDS.serpMoverDays.max)
        .optional()
        .describe(
          `Look-back window in days (${QUERY_BOUNDS.serpMoverDays.min}-${QUERY_BOUNDS.serpMoverDays.max}). Defaults to ${QUERY_BOUNDS.serpMoverDays.default}.`,
        ),
    }),
    request: ({ appId, days }) => ({
      path: `/apps/${seg(appId)}/serp-movers`,
      params: { days },
    }),
  }),

  defineReadTool({
    name: "visibility_history",
    title: "Visibility history",
    description:
      "Daily visibility score (0-100) history for one app over a date window. Higher is more visible across tracked keywords.",
    inputSchema: z.object({ appId, from, to }),
    request: ({ appId, from, to }) => ({
      path: `/apps/${seg(appId)}/visibility-history`,
      params: { from, to },
    }),
  }),

  defineReadTool({
    name: "rank_distribution_history",
    title: "Rank distribution history",
    description:
      "Daily counts of tracked keywords by rank band (top 1-3, 4-10, 11-50, etc.) for one app over a date window.",
    inputSchema: z.object({ appId, from, to }),
    request: ({ appId, from, to }) => ({
      path: `/apps/${seg(appId)}/rank-distribution-history`,
      params: { from, to },
    }),
  }),

  defineReadTool({
    name: "ratings_history",
    title: "Ratings history",
    description:
      "Daily average rating and rating-count history for one app over a date window (App Store home market).",
    inputSchema: z.object({ appId, from, to }),
    request: ({ appId, from, to }) => ({
      path: `/apps/${seg(appId)}/ratings-history`,
      params: { from, to },
    }),
  }),

  defineReadTool({
    name: "app_audit",
    title: "ASO audit",
    description:
      "The latest ASO audit for one app: an overall score plus per-check findings and recommendations across the rubric.",
    inputSchema: z.object({ appId }),
    request: ({ appId }) => ({ path: `/apps/${seg(appId)}/audit` }),
  }),

  defineReadTool({
    name: "audit_history",
    title: "Audit history",
    description:
      "Historical ASO audit scores for one app over a date window. Requires an instance new enough to persist audit history; older instances report it as unavailable.",
    inputSchema: z.object({ appId, from, to }),
    request: ({ appId, from, to }) => ({
      path: `/apps/${seg(appId)}/audit/history`,
      params: { from, to },
    }),
    unavailableOn404:
      "Audit history is not available on this instance — it needs a newer asobeast API.",
  }),

  defineReadTool({
    name: "metadata_audit",
    title: "Metadata audit",
    description:
      "Metadata lint and keyword-coverage audit for one app: title, subtitle (Apple), short description (Play) and keyword-field checks with character-limit warnings.",
    inputSchema: z.object({ appId }),
    request: ({ appId }) => ({ path: `/apps/${seg(appId)}/metadata/audit` }),
  }),

  defineReadTool({
    name: "list_reviews",
    title: "List reviews",
    description:
      "Recent store reviews for one app, optionally filtered by star score or app version.",
    inputSchema: z.object({
      appId,
      score: z
        .number()
        .int()
        .min(QUERY_BOUNDS.reviewScore.min)
        .max(QUERY_BOUNDS.reviewScore.max)
        .optional()
        .describe("Only reviews with this star score (1-5)."),
      version: z
        .string()
        .optional()
        .describe("Only reviews left on this app version."),
      limit: z
        .number()
        .int()
        .min(QUERY_BOUNDS.reviewsLimit.min)
        .max(QUERY_BOUNDS.reviewsLimit.max)
        .optional()
        .describe(
          `Maximum number of reviews to return (${QUERY_BOUNDS.reviewsLimit.min}-${QUERY_BOUNDS.reviewsLimit.max}). Defaults to ${QUERY_BOUNDS.reviewsLimit.default}.`,
        ),
    }),
    request: ({ appId, score, version, limit }) => ({
      path: `/apps/${seg(appId)}/reviews`,
      params: { score, version, limit },
    }),
  }),

  defineReadTool({
    name: "changes_timeline",
    title: "Changes timeline",
    description:
      "Detected change events for one app over the last N days — metadata edits, ranking swings and rating shifts, newest first.",
    inputSchema: z.object({
      appId,
      days: z
        .number()
        .int()
        .min(QUERY_BOUNDS.changeTimelineDays.min)
        .max(QUERY_BOUNDS.changeTimelineDays.max)
        .optional()
        .describe(
          `Look-back window in days (${QUERY_BOUNDS.changeTimelineDays.min}-${QUERY_BOUNDS.changeTimelineDays.max}). Defaults to ${QUERY_BOUNDS.changeTimelineDays.default}.`,
        ),
    }),
    request: ({ appId, days }) => ({
      path: `/apps/${seg(appId)}/changes`,
      params: { days },
    }),
  }),

  defineReadTool({
    name: "daily_budget",
    title: "Daily request budget",
    description:
      "The estimated daily store-request fan-out for the whole instance against the configured rate limits — how close the tracked keyword set is to the budget ceiling.",
    inputSchema: z.object({}),
    request: () => ({ path: "/jobs/budget" }),
  }),
];
