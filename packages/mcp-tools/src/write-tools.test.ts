import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { MCP_TOOLS, MCP_WRITE_TOOLS, type WriteTool } from "./index";
import { TRACK_KEYWORDS_LIMIT } from "./write-tools";

function writeTool(name: string): WriteTool {
  const tool = MCP_WRITE_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no write tool named ${name}`);
  return tool;
}

const ITEM = {
  text: "habit tracker",
  country: "us",
  active: true,
  source: "MANUAL",
};

describe("the write tools", () => {
  it("are exactly the five the catalog promises, in order", () => {
    expect(MCP_WRITE_TOOLS.map((tool) => tool.name)).toEqual([
      "track_keywords",
      "untrack_keyword",
      "add_competitor",
      "remove_competitor",
      "set_action_status",
    ]);
  });

  it("never share a name with a read tool", () => {
    const names = [...MCP_TOOLS, ...MCP_WRITE_TOOLS].map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("are all marked as write tools and no read tool is", () => {
    expect(MCP_WRITE_TOOLS.every((tool) => tool.kind === "write")).toBe(true);
    expect(MCP_TOOLS.every((tool) => tool.kind === "read")).toBe(true);
  });

  it.each([
    [
      "track_keywords",
      { appId: "app-1", keywords: ["habit tracker"], country: "de" },
      {
        method: "POST",
        path: "/apps/app-1/keywords",
        body: { keywords: ["habit tracker"], country: "de" },
      },
    ],
    [
      "untrack_keyword",
      { appId: "app-1", keywordId: "kw-1" },
      { method: "DELETE", path: "/apps/app-1/keywords/kw-1" },
    ],
    [
      "add_competitor",
      { appId: "app-1", url: "https://apps.apple.com/us/app/rival/id1" },
      {
        method: "POST",
        path: "/apps/app-1/competitors",
        body: { url: "https://apps.apple.com/us/app/rival/id1" },
      },
    ],
    [
      "remove_competitor",
      { appId: "app-1", competitorId: "app-2" },
      { method: "DELETE", path: "/apps/app-1/competitors/app-2" },
    ],
    [
      "set_action_status",
      {
        actionId: "act-1",
        status: "SNOOZED",
        snoozedUntil: "2026-11-01",
        note: "revisit after the release",
      },
      {
        method: "PATCH",
        path: "/actions/act-1",
        body: {
          status: "SNOOZED",
          snoozedUntil: "2026-11-01",
          note: "revisit after the release",
        },
      },
    ],
  ])("request %s as the route the web app uses", (name, input, request) => {
    expect(JSON.parse(JSON.stringify(writeTool(name).request(input)))).toEqual(
      request,
    );
  });

  it("encodes every id so it cannot escape its path segment", () => {
    expect(
      writeTool("untrack_keyword").request({
        appId: "../jobs",
        keywordId: "kw/1?x=y",
      }).path,
    ).toBe("/apps/..%2Fjobs/keywords/kw%2F1%3Fx%3Dy");
  });

  const ID_FIELDS = ["appId", "keywordId", "competitorId", "actionId"];

  const idFields = MCP_WRITE_TOOLS.flatMap((tool) =>
    ID_FIELDS.filter((field) => field in tool.inputSchema.shape).map(
      (field) => [tool.name, field, tool.inputSchema.shape[field] as z.ZodType],
    ),
  ) as [string, string, z.ZodType][];

  it("take an id in every place an id leads to a record", () => {
    expect(idFields.map(([name, field]) => `${name}.${field}`)).toEqual([
      "track_keywords.appId",
      "untrack_keyword.appId",
      "untrack_keyword.keywordId",
      "add_competitor.appId",
      "remove_competitor.appId",
      "remove_competitor.competitorId",
      "set_action_status.actionId",
    ]);
  });

  it.each(idFields)(
    "%s refuses a dot segment as %s, which would climb to the route above",
    (_name, _field, schema) => {
      for (const value of [".", ".."]) {
        expect(schema.safeParse(value).success).toBe(false);
      }
    },
  );

  it.each(idFields)(
    "%s refuses %s when it is empty, carries a path or runs past any real id",
    (_name, _field, schema) => {
      for (const value of ["", "app/1", "kw?x=y", "a b", "x".repeat(65)]) {
        expect(schema.safeParse(value).success).toBe(false);
      }
    },
  );

  it.each(idFields)(
    "%s accepts every id the api hands out as %s",
    (_name, _field, schema) => {
      for (const value of [
        "cmg1q2w3e0000abcd1234efgh",
        "app_ios",
        "kw-1",
        "x".repeat(64),
      ]) {
        expect(schema.safeParse(value).success).toBe(true);
      }
    },
  );

  it.each([
    ["track_keywords", "no phrase", { appId: "a", keywords: [] }],
    [
      "track_keywords",
      "more phrases than one call may carry",
      {
        appId: "a",
        keywords: Array.from(
          { length: TRACK_KEYWORDS_LIMIT + 1 },
          (_, index) => `phrase ${index}`,
        ),
      },
    ],
    ["track_keywords", "an empty phrase", { appId: "a", keywords: [""] }],
    [
      "track_keywords",
      "a phrase longer than the api accepts",
      { appId: "a", keywords: ["x".repeat(101)] },
    ],
    [
      "track_keywords",
      "an uppercase storefront",
      { appId: "a", keywords: ["habit"], country: "DE" },
    ],
    [
      "add_competitor",
      "something that is not a url",
      { appId: "a", url: "not a url" },
    ],
    [
      "add_competitor",
      "an address longer than any store url",
      { appId: "a", url: `https://apps.apple.com/${"x".repeat(2100)}` },
    ],
    [
      "set_action_status",
      "a status the api does not take",
      { actionId: "act-1", status: "RESOLVED" },
    ],
    [
      "set_action_status",
      "a snooze date that is not on the calendar",
      { actionId: "act-1", status: "SNOOZED", snoozedUntil: "2026-02-30" },
    ],
    [
      "set_action_status",
      "a note past the shared limit",
      { actionId: "act-1", status: "DONE", note: "x".repeat(501) },
    ],
    [
      "set_action_status",
      "a sibling route name as an action id",
      { actionId: "summary", status: "DONE" },
    ],
    [
      "set_action_status",
      "an unknown dismiss reason",
      { actionId: "act-1", status: "DISMISSED", reason: "boring" },
    ],
  ])("%s refuses %s before a request leaves", (name, _case, input) => {
    expect(writeTool(name).inputSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    [
      "track_keywords",
      {
        appId: "a",
        keywords: Array.from({ length: TRACK_KEYWORDS_LIMIT }, () => "habit"),
        country: "us",
      },
    ],
    [
      "set_action_status",
      {
        actionId: "act-1",
        status: "DISMISSED",
        reason: "not_relevant",
        note: "x".repeat(500),
      },
    ],
    [
      "set_action_status",
      { actionId: "act-1", status: "SNOOZED", snoozedUntil: "2028-02-29" },
    ],
  ])("%s accepts the largest input it promises", (name, input) => {
    expect(writeTool(name).inputSchema.safeParse(input).success).toBe(true);
  });

  it("keeps the batch of phrases below what the api would accept", () => {
    expect(TRACK_KEYWORDS_LIMIT).toBe(50);
  });

  it("returns only the phrases it was asked to track, matched by normalized text", () => {
    const body = [
      { keywordId: "kw-1", ...ITEM },
      { keywordId: "kw-2", ...ITEM, text: "streak counter" },
      { keywordId: "kw-3", ...ITEM, text: "sleep timer" },
    ];

    expect(
      writeTool("track_keywords").outcome(body, {
        appId: "app-1",
        keywords: ["  Habit   Tracker "],
        country: "us",
      }),
    ).toEqual({
      market: "us",
      trackedInMarket: 3,
      tracked: [
        {
          keywordId: "kw-1",
          text: "habit tracker",
          active: true,
          source: "MANUAL",
        },
      ],
    });
  });

  it("names the market the api answered for when none was asked", () => {
    expect(
      writeTool("track_keywords").outcome(
        [{ keywordId: "kw-1", ...ITEM, country: "pl" }],
        { appId: "app-1", keywords: ["habit tracker"] },
      ),
    ).toMatchObject({ market: "pl" });
  });

  it("reports an empty list as nothing tracked in the market asked for", () => {
    expect(
      writeTool("track_keywords").outcome([], {
        appId: "app-1",
        keywords: ["habit"],
        country: "de",
      }),
    ).toEqual({ market: "de", trackedInMarket: 0, tracked: [] });
  });

  it.each([
    ["no body", null],
    ["a body that is not a list", { keywordId: "kw-1", ...ITEM }],
    [
      "a list holding something that is not a keyword",
      [{ keywordId: "kw-1", ...ITEM }, null],
    ],
    ["a list of keywords missing their fields", [{ keywordId: "kw-1" }]],
  ])("returns %s from track_keywords unchanged", (_case, body) => {
    expect(
      writeTool("track_keywords").outcome(body, {
        appId: "app-1",
        keywords: ["habit tracker"],
      }),
    ).toBe(body);
  });

  it.each([
    [
      "untrack_keyword",
      { appId: "app-1", keywordId: "kw-1" },
      { removed: true, appId: "app-1", keywordId: "kw-1" },
    ],
    [
      "remove_competitor",
      { appId: "app-1", competitorId: "app-2" },
      { removed: true, appId: "app-1", competitorId: "app-2" },
    ],
  ])("%s confirms a delete that answered no body", (name, input, confirmed) => {
    expect(writeTool(name).outcome(null, input)).toEqual(confirmed);
  });

  it("returns the new status of an action without its evidence", () => {
    const body = {
      id: "act-1",
      rule: "keyword.add_uncovered",
      category: "keywords",
      status: "DONE",
      priority: "high",
      impact: 71,
      evidence: { huge: true },
      snoozedUntil: null,
      closedAt: "2026-10-07T09:00:00.000Z",
      note: "shipped in 1.4",
      ai: { explanation: null },
    };

    expect(
      writeTool("set_action_status").outcome(body, {
        actionId: "act-1",
        status: "DONE",
      }),
    ).toEqual({
      id: "act-1",
      rule: "keyword.add_uncovered",
      status: "DONE",
      priority: "high",
      snoozedUntil: null,
      closedAt: "2026-10-07T09:00:00.000Z",
      note: "shipped in 1.4",
    });
  });

  it.each([
    ["no body", null],
    ["a body that is not an object", "accepted"],
    ["a list instead of one action", [{ id: "act-1", status: "DONE" }]],
    ["an action missing its fields", { id: "act-1", status: "DONE" }],
  ])("returns %s from set_action_status unchanged", (_case, body) => {
    expect(
      writeTool("set_action_status").outcome(body, {
        actionId: "act-1",
        status: "DONE",
      }),
    ).toBe(body);
  });

  it("returns a competitor as the api described it", () => {
    const body = { id: "app-2", name: "Rival", store: "APP_STORE" };

    expect(
      writeTool("add_competitor").outcome(body, {
        appId: "app-1",
        url: "https://apps.apple.com/us/app/rival/id1",
      }),
    ).toEqual(body);
  });

  it("never names a write tool in the description of a read tool", () => {
    const writes = MCP_WRITE_TOOLS.map((tool) => tool.name);

    for (const tool of MCP_TOOLS) {
      for (const name of writes) {
        expect(tool.description).not.toContain(name);
      }
    }
  });

  it("tells an agent which read tool supplies each id it asks for", () => {
    const suppliers: Record<string, string> = {
      appId: "list_apps",
      keywordId: "list_keywords",
      competitorId: "list_competitors",
      actionId: "list_actions",
    };

    for (const tool of MCP_WRITE_TOOLS) {
      for (const [field, supplier] of Object.entries(suppliers)) {
        const schema = tool.inputSchema.shape[field] as z.ZodType | undefined;
        if (schema) expect(schema.description).toContain(supplier);
      }
    }
  });

  it("tells an agent what tracking an already tracked phrase changes", () => {
    const { description } = writeTool("track_keywords");

    expect(description).not.toContain("left as it is");
    expect(description).toContain("is resumed if it was paused");
    expect(description).toContain(
      "tracked from the iOS keyword field becomes a manual keyword",
    );
  });

  it("tells an agent to change something only when asked to", () => {
    for (const name of [
      "untrack_keyword",
      "remove_competitor",
      "set_action_status",
    ]) {
      expect(writeTool(name).description).toMatch(/only when the human asked/);
    }
  });
});
