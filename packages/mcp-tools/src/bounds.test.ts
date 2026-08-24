import { describe, expect, it } from "vitest";
import { z } from "zod";
import { COUNTRY_PATTERN, QUERY_BOUNDS } from "@asobeast/shared";
import { MCP_TOOLS, toolByName } from "./index";

function fieldOf(tool: string, field: string): z.ZodTypeAny {
  const schema = toolByName(tool)?.inputSchema;
  if (!schema) throw new Error(`no tool named ${tool}`);
  const shape = schema.shape[field];
  if (!shape) throw new Error(`${tool} has no ${field}`);
  return shape as z.ZodTypeAny;
}

const NUMERIC: Array<[string, string, keyof typeof QUERY_BOUNDS]> = [
  ["list_actions", "limit", "actionsLimit"],
  ["app_actions", "limit", "actionsLimit"],
  ["list_reviews", "limit", "reviewsLimit"],
  ["list_reviews", "score", "reviewScore"],
  ["keyword_suggestions", "limit", "suggestionsLimit"],
  ["serp_movers", "days", "serpMoverDays"],
  ["changes_timeline", "days", "changeTimelineDays"],
];

describe("mcp input bounds match the api", () => {
  it.each(NUMERIC)(
    "%s.%s accepts the whole api range",
    (tool, field, bound) => {
      const schema = fieldOf(tool, field);
      const { min, max } = QUERY_BOUNDS[bound];

      expect(schema.safeParse(min).success).toBe(true);
      expect(schema.safeParse(max).success).toBe(true);
    },
  );

  it.each(NUMERIC)(
    "%s.%s refuses what the api would reject",
    (tool, field, bound) => {
      const schema = fieldOf(tool, field);
      const { min, max } = QUERY_BOUNDS[bound];

      expect(schema.safeParse(min - 1).success).toBe(false);
      expect(schema.safeParse(max + 1).success).toBe(false);
      expect(schema.safeParse(1.5).success).toBe(false);
    },
  );

  const COUNTRY_FIELDS: Array<[string, string]> = [
    ["list_actions", "country"],
    ["app_actions", "country"],
    ["list_keywords", "country"],
    ["keyword_suggestions", "country"],
  ];

  it.each(COUNTRY_FIELDS)(
    "%s.%s takes only a storefront code",
    (tool, field) => {
      const schema = fieldOf(tool, field);

      expect(schema.safeParse("de").success).toBe(true);
      expect(schema.safeParse("DE").success).toBe(false);
      expect(schema.safeParse("deu").success).toBe(false);
      expect(schema.safeParse("").success).toBe(false);
    },
  );

  const DATE_FIELDS: Array<[string, string]> = [
    ["ranking_history", "from"],
    ["ranking_history", "to"],
    ["serp_snapshot", "date"],
    ["visibility_history", "from"],
    ["audit_history", "to"],
  ];

  it.each(DATE_FIELDS)("%s.%s takes only a utc date", (tool, field) => {
    const schema = fieldOf(tool, field);

    expect(schema.safeParse("2026-08-21").success).toBe(true);
    expect(schema.safeParse("yesterday").success).toBe(false);
    expect(schema.safeParse("2026-08-21T00:00:00Z").success).toBe(false);
  });

  it("leaves no unbounded number in any tool schema", () => {
    for (const tool of MCP_TOOLS) {
      for (const [field, schema] of Object.entries(tool.inputSchema.shape)) {
        const shape = schema as z.ZodTypeAny;
        if (shape.safeParse(1).success) {
          expect(`${tool.name}.${field}`).toBe(`${tool.name}.${field}`);
          expect(shape.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(false);
        }
      }
    }
  });

  it("uses the shared storefront pattern rather than a copy", () => {
    expect(COUNTRY_PATTERN.test("us")).toBe(true);
    expect(COUNTRY_PATTERN.test("us-CA")).toBe(false);
  });
});
