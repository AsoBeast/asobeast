import { z } from "zod";
import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  COUNTRY_PATTERN,
  QUERY_BOUNDS,
  STORES,
} from "@asobeast/shared";
import { defineReadTool, seg, type ReadTool } from "./define";

const UNAVAILABLE =
  "The Action Center is not available on this instance — it needs a newer asobeast API.";

const DOMAIN = [
  "Recommendations are computed deterministically from stored data: the typed evidence on each",
  "action is the reproducible part, and the 0-100 impact is an estimate of how much is at stake,",
  "never a prediction of downloads, revenue or rank.",
  "Statuses: OPEN (needs attention), SNOOZED (deferred until a date), DONE (the owner acted),",
  "DISMISSED (the owner rejected it — do not re-recommend it), RESOLVED (the underlying condition",
  "stopped on its own).",
  "Apple and Google Play scores are not comparable across stores, so never rank one against the other.",
  "This surface is read-only by design: propose changes to the human rather than attempting a write.",
].join(" ");

const status = z
  .array(z.enum(ACTION_STATUSES))
  .optional()
  .describe(
    "Restrict to these lifecycle states. Defaults to OPEN and SNOOZED.",
  );

const priority = z
  .array(z.enum(ACTION_PRIORITIES))
  .optional()
  .describe(
    "Restrict to these priority bands, derived from impact: critical >= 80, high >= 60, medium >= 35, low below.",
  );

const rule = z
  .array(z.enum(ACTION_RULES))
  .optional()
  .describe("Restrict to these detection rules.");

const category = z
  .enum(ACTION_CATEGORIES)
  .optional()
  .describe("Restrict to one category of work.");

const country = z
  .string()
  .regex(COUNTRY_PATTERN)
  .optional()
  .describe("Two-letter storefront code, for example us or de.");

const store = z.enum(STORES).optional().describe("Restrict to one store.");

const limit = z
  .number()
  .int()
  .min(QUERY_BOUNDS.actionsLimit.min)
  .max(QUERY_BOUNDS.actionsLimit.max)
  .optional()
  .describe(
    `Maximum actions to return (${QUERY_BOUNDS.actionsLimit.min}-${QUERY_BOUNDS.actionsLimit.max}). Defaults to ${QUERY_BOUNDS.actionsLimit.default}.`,
  );

function joinValues(values: readonly string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

export const ACTION_TOOLS: ReadTool[] = [
  defineReadTool({
    name: "list_actions",
    title: "List actions",
    description: `The prioritized ASO work queue across every tracked app: what to do next and why. ${DOMAIN} Sorted by impact descending, then by age.`,
    inputSchema: z.object({
      status,
      priority,
      rule,
      category,
      appId: z
        .string()
        .optional()
        .describe("Restrict to one app id from list_apps."),
      country,
      store,
      limit,
    }),
    request: ({
      status,
      priority,
      rule,
      category,
      appId,
      country,
      store,
      limit,
    }) => ({
      path: "/actions",
      params: {
        status: joinValues(status),
        priority: joinValues(priority),
        rule: joinValues(rule),
        category,
        appId,
        country,
        store,
        limit,
      },
    }),
    unavailableOn404: UNAVAILABLE,
  }),

  defineReadTool({
    name: "app_actions",
    title: "App actions",
    description: `The prioritized ASO work queue for one tracked app. Actions exist only for tracked primary apps, never for competitors — a competitor only ever appears inside evidence. ${DOMAIN}`,
    inputSchema: z.object({
      appId: z.string().describe("The app id from list_apps."),
      status,
      priority,
      rule,
      category,
      country,
      store,
      limit,
    }),
    request: ({
      appId,
      status,
      priority,
      rule,
      category,
      country,
      store,
      limit,
    }) => ({
      path: `/apps/${seg(appId)}/actions`,
      params: {
        status: joinValues(status),
        priority: joinValues(priority),
        rule: joinValues(rule),
        category,
        country,
        store,
        limit,
      },
    }),
    unavailableOn404: UNAVAILABLE,
  }),

  defineReadTool({
    name: "actions_summary",
    title: "Actions summary",
    description: `Counts for the whole action queue: open and snoozed totals, counts per priority band and per category, and the most common rules. generatedAt is the last successful generation run and is null when generation has never run. suppressedByCap reports how many lower-impact findings a run withheld to keep the queue a to-do list rather than a report. ${DOMAIN}`,
    inputSchema: z.object({}),
    request: () => ({ path: "/actions/summary" }),
    unavailableOn404: UNAVAILABLE,
  }),
];
