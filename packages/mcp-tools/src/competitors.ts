import { z } from "zod";
import { defineReadTool, seg, type ReadTool } from "./define";

const appId = z.string().describe("The app id from list_apps.");

export const COMPETITOR_TOOLS: ReadTool[] = [
  defineReadTool({
    name: "list_competitors",
    title: "List competitors",
    description:
      "The competitor apps tracked against one app, oldest first, each with its id, store, name, icon and the summary of its latest snapshot. Competitors belong to one primary app and have no keywords or actions of their own; a competitor only ever appears inside the evidence of the primary app.",
    inputSchema: z.object({ appId }),
    request: ({ appId }) => ({ path: `/apps/${seg(appId)}/competitors` }),
  }),

  defineReadTool({
    name: "competitor_analysis",
    title: "Competitor analysis",
    description:
      "Positioning against the competitors of one app: a metadata comparison (title and subtitle with their character counts), three keyword gap lists (theyRankYouDont, youRankTheyDont and outranked, each row with volume, difficulty, opportunity and both positions), and a position map of visibility and rating per app. Position is 1-based; null means checked but not found within the row's depth. Apple and Google Play figures are not comparable, so an app is only ever compared with competitors on its own store.",
    inputSchema: z.object({ appId }),
    request: ({ appId }) => ({
      path: `/apps/${seg(appId)}/competitors/analysis`,
    }),
  }),
];
