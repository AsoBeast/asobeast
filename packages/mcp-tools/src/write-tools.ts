import { z } from "zod";
import {
  ACTION_DISMISS_REASONS,
  ACTION_NOTE_MAX_LENGTH,
  ACTION_UPDATE_STATUSES,
  COUNTRY_PATTERN,
  KEYWORD_SOURCES,
  TRACKED_KEYWORD_CHAR_LIMIT,
  isActionPriority,
  isActionRule,
  isActionStatus,
  normalizeText,
  type ActionItem,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { actionIdFrom } from "./actions";
import { utcDate } from "./calendar-date";
import { defineWriteTool, seg, type WriteTool } from "./define";

export const TRACK_KEYWORDS_LIMIT = 50;

const STORE_URL_MAX_LENGTH = 2048;

const RECORD_ID_MAX_LENGTH = 64;

const recordId = z
  .string()
  .min(1)
  .max(RECORD_ID_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/, "Not an id.");

const appId = recordId.describe("The app id from list_apps.");

type TrackedFields = Pick<
  TrackedKeywordItem,
  "keywordId" | "text" | "country" | "active" | "source"
>;

type ActionFields = Pick<
  ActionItem,
  "id" | "rule" | "status" | "priority" | "snoozedUntil" | "closedAt" | "note"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string";

const isTextOrNull = (value: unknown): value is string | null =>
  value === null || isText(value);

function isTrackedItem(value: unknown): value is TrackedFields {
  return (
    isRecord(value) &&
    isText(value.keywordId) &&
    isText(value.text) &&
    isText(value.country) &&
    typeof value.active === "boolean" &&
    KEYWORD_SOURCES.some((source) => source === value.source)
  );
}

function isActionAnswer(value: unknown): value is ActionFields {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isActionRule(value.rule) &&
    isActionStatus(value.status) &&
    isActionPriority(value.priority) &&
    isTextOrNull(value.snoozedUntil) &&
    isTextOrNull(value.closedAt) &&
    isTextOrNull(value.note)
  );
}

function trackedOutcome(
  body: unknown,
  keywords: readonly string[],
  country: string | undefined,
) {
  if (!Array.isArray(body)) return body;
  const items: unknown[] = body;
  if (!items.every(isTrackedItem)) return body;
  const requested = new Set(keywords.map(normalizeText));
  return {
    market: items[0]?.country ?? country ?? null,
    trackedInMarket: items.length,
    tracked: items
      .filter((item) => requested.has(item.text))
      .map(({ keywordId, text, active, source }) => ({
        keywordId,
        text,
        active,
        source,
      })),
  };
}

function actionOutcome(body: unknown) {
  if (!isActionAnswer(body)) return body;
  const { id, rule, status, priority, snoozedUntil, closedAt, note } = body;
  return { id, rule, status, priority, snoozedUntil, closedAt, note };
}

export const MCP_WRITE_TOOLS: WriteTool[] = [
  defineWriteTool({
    name: "track_keywords",
    title: "Track keywords",
    description: `Start tracking keywords for one app in one market. A market is a storefront given as a two-letter country code and defaults to the app's home storefront; the same phrase in two markets is two tracked keywords. Phrases are normalized to lower case, at most 100 characters and five words each, 1 to ${TRACK_KEYWORDS_LIMIT} per call. Every phrase new to the instance is queued for a store scoring job and is checked in the daily ranking run, so each added phrase spends store request capacity: add the few that matter, not every suggestion. A market other than the home storefront also starts a daily capture of that market's listing for the app and each competitor. A phrase that is already tracked keeps its tags, note and relevance, is resumed if it was paused, and a phrase tracked from the iOS keyword field becomes a manual keyword. Tracking counts against the plan's keyword market limit. Returns the phrases this call asked for with their ids; use list_keywords for scores and positions, which stay empty until the first check.`,
    inputSchema: z.object({
      appId,
      keywords: z
        .array(z.string().min(1).max(TRACKED_KEYWORD_CHAR_LIMIT))
        .min(1)
        .max(TRACK_KEYWORDS_LIMIT)
        .describe(
          `Phrases to track, 1 to ${TRACK_KEYWORDS_LIMIT} per call, each at most ${TRACKED_KEYWORD_CHAR_LIMIT} characters.`,
        ),
      country: z
        .string()
        .regex(COUNTRY_PATTERN)
        .optional()
        .describe(
          "Two-letter storefront code of the market to track in. Defaults to the app's home storefront.",
        ),
    }),
    hints: { destructive: false, idempotent: true, openWorld: true },
    request: ({ appId, keywords, country }) => ({
      method: "POST",
      path: `/apps/${seg(appId)}/keywords`,
      body: { keywords, country },
    }),
    outcome: (body, { keywords, country }) =>
      trackedOutcome(body, keywords, country),
  }),

  defineWriteTool({
    name: "untrack_keyword",
    title: "Untrack keyword",
    description:
      "Stop tracking one keyword for one app, in the market the keyword belongs to. The tracking entry is deleted with its tags, note and relevance, and the daily run stops collecting positions for it; positions already recorded stay until retention prunes them. Track it again with track_keywords. Do this only when the human asked for it.",
    inputSchema: z.object({
      appId,
      keywordId: recordId.describe(
        "The tracked keyword id from list_keywords.",
      ),
    }),
    hints: { destructive: true, idempotent: true, openWorld: false },
    request: ({ appId, keywordId }) => ({
      method: "DELETE",
      path: `/apps/${seg(appId)}/keywords/${seg(keywordId)}`,
    }),
    outcome: (_body, { appId, keywordId }) => ({
      removed: true,
      appId,
      keywordId,
    }),
  }),

  defineWriteTool({
    name: "add_competitor",
    title: "Add competitor",
    description:
      "Add a competitor to one app from its store listing URL, for example https://apps.apple.com/us/app/rival/id1234567890. The competitor must be on the same store as the app. The listing is fetched from the live store while the request waits, so it can take several seconds; a competitor that was already added is returned unchanged. Competitors count against the plan's per app limit and are checked in the daily run, so add only the rivals that matter. Returns the competitor with its id.",
    inputSchema: z.object({
      appId,
      url: z
        .url()
        .max(STORE_URL_MAX_LENGTH)
        .describe(
          "The App Store or Google Play listing URL of the competitor.",
        ),
    }),
    hints: { destructive: false, idempotent: true, openWorld: true },
    request: ({ appId, url }) => ({
      method: "POST",
      path: `/apps/${seg(appId)}/competitors`,
      body: { url },
    }),
    outcome: (body) => body,
  }),

  defineWriteTool({
    name: "remove_competitor",
    title: "Remove competitor",
    description:
      "Remove one competitor from an app. The competitor and its stored snapshots and positions are deleted, and it disappears from competitor_analysis and keyword_comparison. Add it again with add_competitor. Do this only when the human asked for it.",
    inputSchema: z.object({
      appId,
      competitorId: recordId.describe(
        "The competitor id from list_competitors.",
      ),
    }),
    hints: { destructive: true, idempotent: true, openWorld: false },
    request: ({ appId, competitorId }) => ({
      method: "DELETE",
      path: `/apps/${seg(appId)}/competitors/${seg(competitorId)}`,
    }),
    outcome: (_body, { appId, competitorId }) => ({
      removed: true,
      appId,
      competitorId,
    }),
  }),

  defineWriteTool({
    name: "set_action_status",
    title: "Set action status",
    description:
      "Change the status of one action in the Action Center. OPEN reopens it. SNOOZED defers it until snoozedUntil, a UTC date (YYYY-MM-DD) in the future and within the instance's snooze limit (90 days by default), and it wakes at 00:00 UTC that day. DONE records that the owner acted; it is confirmed fixed once its rule stops firing and reopens if the rule fires again. DISMISSED rejects it, optionally with a reason, and a dismissed action is not recommended again. An action the system resolved on its own can only be reopened. Change an action only when the human asked for it, and use note to say why: it is saved on the action and shown to the team under the token owner's name. Returns the new status.",
    inputSchema: z.object({
      actionId: actionIdFrom(recordId),
      status: z.enum(ACTION_UPDATE_STATUSES).describe("The status to set."),
      snoozedUntil: utcDate
        .optional()
        .describe(
          "Required when status is SNOOZED and refused otherwise. A UTC date (YYYY-MM-DD).",
        ),
      reason: z
        .enum(ACTION_DISMISS_REASONS)
        .optional()
        .describe("Why the action is dismissed. Only with status DISMISSED."),
      note: z
        .string()
        .max(ACTION_NOTE_MAX_LENGTH)
        .optional()
        .describe(
          `A short note saved on the action, at most ${ACTION_NOTE_MAX_LENGTH} characters.`,
        ),
    }),
    hints: { destructive: false, idempotent: true, openWorld: false },
    request: ({ actionId, status, snoozedUntil, reason, note }) => ({
      method: "PATCH",
      path: `/actions/${seg(actionId)}`,
      body: { status, snoozedUntil, reason, note },
    }),
    outcome: (body) => actionOutcome(body),
  }),
];
