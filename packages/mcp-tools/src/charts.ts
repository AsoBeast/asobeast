import { z } from "zod";
import {
  CATEGORY_COLLECTIONS,
  CHART_COMPARE_WINDOWS,
  CHART_DEVICES,
  COUNTRY_PATTERN,
  STORES,
} from "@asobeast/shared";
import { utcDate } from "./calendar-date";
import { defineReadTool, type ReadTool } from "./define";

const store = z
  .enum(STORES)
  .describe("The store the chart belongs to: APP_STORE or GOOGLE_PLAY.");

export const CHART_TOOLS: ReadTool[] = [
  defineReadTool({
    name: "top_chart",
    title: "Top chart",
    description:
      "One day of a free, paid or grossing chart of one store, country, category and device, as the daily run or a capture stored it: every row with its position, its position on the comparison day and the movement between them (up, down, same, new, or none when no earlier capture exists), the climbers, fallers, new entries and exits, the days a capture exists for, whether this workspace follows the chart, and which rows are its own apps or competitors. Positions are 1-based; the App Store feed answers 100 rows and Google Play 200. Genres are the ids chart_genres lists, or overall. Omit date for the newest capture. Never reaches the store; a chart nobody captured answers an empty day.",
    inputSchema: z.object({
      store,
      country: z
        .string()
        .regex(COUNTRY_PATTERN)
        .describe("Two-letter storefront code of the chart."),
      collection: z
        .enum(CATEGORY_COLLECTIONS)
        .describe("The chart kind: free, paid or grossing."),
      genre: z
        .string()
        .max(32)
        .describe("A genre id from chart_genres, or overall."),
      device: z
        .enum(CHART_DEVICES)
        .describe("iphone for the App Store, android for Google Play."),
      date: utcDate
        .optional()
        .describe("The UTC day to read. Omitted reads the newest capture."),
      compare: z
        .enum(CHART_COMPARE_WINDOWS)
        .optional()
        .describe(
          "How far back the movement compares: 1d, 7d or 30d. Defaults to 1d.",
        ),
    }),
    request: ({
      store,
      country,
      collection,
      genre,
      device,
      date,
      compare,
    }) => ({
      path: "/charts",
      params: { store, country, collection, genre, device, date, compare },
    }),
  }),

  defineReadTool({
    name: "chart_genres",
    title: "Chart genres",
    description:
      "The categories a top chart can be read for on one store: id, name and group (apps, games, family). Pass the id as genre to top_chart.",
    inputSchema: z.object({ store }),
    request: ({ store }) => ({ path: "/charts/genres", params: { store } }),
  }),
];
