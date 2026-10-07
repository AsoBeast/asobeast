import { z } from "zod";
import { COUNTRY_PATTERN } from "@asobeast/shared";
import { defineReadTool, seg, type ReadTool } from "./define";

export const APP_TOOLS: ReadTool[] = [
  defineReadTool({
    name: "list_apps",
    title: "List apps",
    description:
      "List every tracked app with its store, home country, latest visibility score and keyword count. Start here to discover app ids for the other tools.",
    inputSchema: z.object({}),
    request: () => ({ path: "/apps" }),
  }),

  defineReadTool({
    name: "get_app",
    title: "Get app",
    description:
      "Full detail for one app: store metadata, home storefront, latest snapshot and category. Pass country for the latest listing captured from another storefront. A market is captured daily while the app tracks keywords there, and its last listing stays readable after those keywords are removed; a market is not found until its first listing was captured. Dates are UTC date strings (YYYY-MM-DD).",
    inputSchema: z.object({
      appId: z.string().describe("The app id from list_apps."),
      country: z
        .string()
        .regex(COUNTRY_PATTERN)
        .optional()
        .describe(
          "Two-letter storefront code. Returns the listing captured from that market instead of the home storefront.",
        ),
    }),
    request: ({ appId, country }) => ({
      path: `/apps/${seg(appId)}`,
      params: { country },
    }),
  }),

  defineReadTool({
    name: "app_summary",
    title: "App summary",
    description:
      "Headline metrics for one app: tracked keyword count, visibility, average position and recent movement. Position is 1-based; null means checked but not found within depth 200 (render as >200).",
    inputSchema: z.object({
      appId: z.string().describe("The app id from list_apps."),
    }),
    request: ({ appId }) => ({ path: `/apps/${seg(appId)}/summary` }),
  }),

  defineReadTool({
    name: "portfolio",
    title: "Portfolio summary",
    description:
      "Cross-app portfolio roll-up: totals and per-app visibility, keyword and movement figures across every tracked app.",
    inputSchema: z.object({}),
    request: () => ({ path: "/portfolio" }),
  }),
];
