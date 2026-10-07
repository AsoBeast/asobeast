import { describe, expect, it } from "vitest";
import {
  MCP_TOOLS,
  MCP_WRITE_TOOLS,
  annotationsOf,
  requestOf,
  toolByName,
  toolOutput,
  toolsFor,
  withOutcomeNote,
} from "./index";

const track = MCP_WRITE_TOOLS[0]!;
const list = toolByName("list_apps")!;

describe("annotationsOf", () => {
  it("advertises every read tool as read only and nothing else", () => {
    for (const tool of MCP_TOOLS) {
      expect(annotationsOf(tool)).toEqual({ readOnlyHint: true });
    }
  });

  it.each([
    [
      "track_keywords",
      { destructiveHint: false, idempotentHint: true, openWorldHint: true },
    ],
    [
      "untrack_keyword",
      { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    ],
    [
      "add_competitor",
      { destructiveHint: false, idempotentHint: true, openWorldHint: true },
    ],
    [
      "remove_competitor",
      { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    ],
    [
      "set_action_status",
      { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ],
  ])("advertises %s with its hints", (name, hints) => {
    const tool = MCP_WRITE_TOOLS.find((candidate) => candidate.name === name)!;

    expect(annotationsOf(tool)).toEqual({ readOnlyHint: false, ...hints });
  });
});

describe("toolsFor", () => {
  it("lists the read tools and nothing else for a read scope", () => {
    expect(toolsFor("read")).toEqual(MCP_TOOLS);
  });

  it("lists the read tools then the write tools for a write scope", () => {
    expect(toolsFor("write").map((tool) => tool.name)).toEqual([
      ...MCP_TOOLS.map((tool) => tool.name),
      ...MCP_WRITE_TOOLS.map((tool) => tool.name),
    ]);
  });

  it("hands out a fresh array so a caller cannot grow the catalog", () => {
    toolsFor("read").push(track);

    expect(toolsFor("read")).toHaveLength(MCP_TOOLS.length);
  });
});

describe("requestOf", () => {
  it("resolves a read tool as a GET with its query", () => {
    expect(
      requestOf(toolByName("list_keywords")!, {
        appId: "app-1",
        country: "de",
      }),
    ).toEqual({
      method: "GET",
      path: "/apps/app-1/keywords",
      params: { sort: undefined, country: "de" },
    });
  });

  it("resolves a write tool with its own method and body", () => {
    expect(
      requestOf(track, { appId: "app-1", keywords: ["habit"] }),
    ).toMatchObject({ method: "POST", path: "/apps/app-1/keywords" });
  });
});

describe("toolOutput", () => {
  it("writes a read tool's body unchanged", () => {
    expect(toolOutput(list, {}, [{ id: "app-1" }])).toBe('[{"id":"app-1"}]');
  });

  it("writes what a write tool says about its own outcome", () => {
    expect(
      toolOutput(
        MCP_WRITE_TOOLS[1]!,
        { appId: "app-1", keywordId: "kw-1" },
        undefined,
      ),
    ).toBe('{"removed":true,"appId":"app-1","keywordId":"kw-1"}');
  });
});

describe("withOutcomeNote", () => {
  const NOTE = "The change may or may not have been applied.";

  it.each([0, 500, 502, 504])(
    "says a write that failed with %s may have been applied",
    (status) => {
      expect(withOutcomeNote(track, status, "down")).toContain(NOTE);
    },
  );

  it.each([400, 402, 403, 404, 409, 429])(
    "leaves a refusal with %s as the api worded it",
    (status) => {
      expect(withOutcomeNote(track, status, "refused")).toBe("refused");
    },
  );

  it("never adds the note to a read, which is always safe to repeat", () => {
    expect(withOutcomeNote(list, 504, "slow")).toBe("slow");
  });
});
