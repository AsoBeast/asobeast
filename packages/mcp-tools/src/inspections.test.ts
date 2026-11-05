import { describe, expect, it } from "vitest";
import {
  INSPECTION_TOOLS,
  INSPECTION_WRITE_TOOLS,
  annotationsOf,
  requestOf,
  toolByName,
} from "./index";

const inspect = INSPECTION_WRITE_TOOLS[0];

const PENDING = {
  id: "insp_1",
  keywordId: "kw_1",
  keyword: "habit tracker",
  store: "APP_STORE",
  country: "us",
  status: "PENDING",
  requestedAt: "2026-11-05T12:00:00.000Z",
  completedAt: null,
  volume: null,
  difficulty100: null,
  opportunity: null,
  resultCount: null,
  results: [],
  suggestions: [],
};

describe("the keyword inspection tools", () => {
  it("lists the inspections with the filters the api accepts", () => {
    const tool = toolByName("list_keyword_inspections");
    if (!tool) throw new Error("missing list_keyword_inspections");

    const input = tool.inputSchema.parse({
      keyword: "  habit tracker ",
      store: "GOOGLE_PLAY",
      country: "de",
      limit: 10,
    });

    expect(requestOf(tool, input)).toEqual({
      method: "GET",
      path: "/keyword-inspections",
      params: {
        keyword: "habit tracker",
        store: "GOOGLE_PLAY",
        country: "de",
        limit: 10,
      },
    });
  });

  it.each([0, 51, 2.5])("refuses a list limit of %s", (limit) => {
    const tool = toolByName("list_keyword_inspections");

    expect(tool?.inputSchema.safeParse({ limit }).success).toBe(false);
  });

  it("reads one inspection by an id that cannot leave its path segment", () => {
    const tool = toolByName("get_keyword_inspection");
    if (!tool) throw new Error("missing get_keyword_inspection");

    expect(requestOf(tool, { inspectionId: "insp_1" }).path).toBe(
      "/keyword-inspections/insp_1",
    );
    for (const value of ["", ".", "..", "a/b", "x".repeat(65)]) {
      expect(tool.inputSchema.safeParse({ inspectionId: value }).success).toBe(
        false,
      );
    }
  });

  it("queues an inspection with the phrase, store and storefront", () => {
    const input = inspect.inputSchema.parse({
      keyword: "habit tracker",
      store: "APP_STORE",
      country: "us",
    });

    expect(requestOf(inspect, input)).toEqual({
      method: "POST",
      path: "/keyword-inspections",
      body: { keyword: "habit tracker", store: "APP_STORE", country: "us" },
    });
  });

  it.each([
    { keyword: "", store: "APP_STORE", country: "us" },
    { keyword: "x".repeat(81), store: "APP_STORE", country: "us" },
    { keyword: "habit", store: "WEB", country: "us" },
    { keyword: "habit", store: "APP_STORE", country: "USA" },
  ])("refuses an inspection request the api would refuse", (input) => {
    expect(inspect.inputSchema.safeParse(input).success).toBe(false);
  });

  it("announces a store request that is not idempotent and deletes nothing", () => {
    expect(annotationsOf(inspect)).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it("answers the queued inspection without the empty result lists", () => {
    expect(
      inspect.outcome(PENDING, {
        keyword: "habit tracker",
        store: "APP_STORE",
        country: "us",
      }),
    ).toEqual({
      queued: true,
      id: "insp_1",
      keyword: "habit tracker",
      store: "APP_STORE",
      country: "us",
      status: "PENDING",
      requestedAt: "2026-11-05T12:00:00.000Z",
    });
  });

  it("passes an answer it cannot read through unchanged", () => {
    const odd = { id: 1 };

    expect(
      inspect.outcome(odd, {
        keyword: "habit tracker",
        store: "APP_STORE",
        country: "us",
      }),
    ).toBe(odd);
  });

  it("points an agent from the queued inspection to the tool that reads it", () => {
    expect(inspect.description).toContain("get_keyword_inspection");
    for (const tool of INSPECTION_TOOLS) {
      expect(tool.unavailableOn404).toContain("newer asobeast API");
    }
  });
});
