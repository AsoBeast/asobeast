import type { KeywordBulkResult } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { bulkInChunks, bulkReport, type BulkOutcome } from "./keyword-bulk";

const ids = (count: number) =>
  Array.from({ length: count }, (_, index) => `kw-${index}`);

const answer = (
  overrides: Partial<KeywordBulkResult> = {},
): KeywordBulkResult => ({
  action: "pause",
  requested: 0,
  changed: 0,
  unchanged: 0,
  missing: [],
  ...overrides,
});

const outcome = (overrides: Partial<BulkOutcome> = {}): BulkOutcome => ({
  changed: 0,
  unchanged: 0,
  missing: 0,
  notSent: 0,
  ...overrides,
});

describe("bulkInChunks", () => {
  it("sends the chunks in order, one at a time", async () => {
    const chunks: string[][] = [];
    let inFlight = 0;

    await bulkInChunks(
      ids(7),
      async (chunk) => {
        inFlight += 1;
        expect(inFlight).toBe(1);
        chunks.push(chunk);
        await Promise.resolve();
        inFlight -= 1;
        return answer();
      },
      3,
    );

    expect(chunks.map((chunk) => chunk.length)).toEqual([3, 3, 1]);
    expect(chunks.flat()).toEqual(ids(7));
  });

  it("adds the counts of every chunk", async () => {
    const result = await bulkInChunks(
      ids(9),
      () =>
        Promise.resolve(answer({ changed: 2, unchanged: 1, missing: ["x"] })),
      3,
    );

    expect(result).toEqual(outcome({ changed: 6, unchanged: 3, missing: 3 }));
  });

  it("stops at the first failure and counts what was not sent", async () => {
    const failure = new Error("down");
    let calls = 0;

    const result = await bulkInChunks(
      ids(7),
      () => {
        calls += 1;
        return calls === 2
          ? Promise.reject(failure)
          : Promise.resolve(answer({ changed: 3 }));
      },
      3,
    );

    expect(result).toEqual(outcome({ changed: 3, notSent: 4, error: failure }));
    expect(calls).toBe(2);
  });

  it("sends nothing for an empty selection", async () => {
    let calls = 0;

    const result = await bulkInChunks([], () => {
      calls += 1;
      return Promise.resolve(answer());
    });

    expect(result).toEqual(outcome());
    expect(calls).toBe(0);
  });

  it("sends the limit per request by default", async () => {
    const sizes: number[] = [];

    await bulkInChunks(ids(1200), (chunk) => {
      sizes.push(chunk.length);
      return Promise.resolve(answer());
    });

    expect(sizes).toEqual([500, 500, 200]);
  });
});

describe("bulkReport", () => {
  const refusal = new ApiError({
    statusCode: 403,
    error: "Forbidden",
    message: "Keyword markets limit reached",
    path: "/apps/app-1/keywords/bulk",
    timestamp: "2026-10-28T00:00:00.000Z",
  });

  it.each([
    {
      action: "pause",
      result: outcome({ changed: 3 }),
      selected: 3,
      level: "success",
      message: "Paused 3 keywords",
    },
    {
      action: "pause",
      result: outcome({ changed: 1 }),
      selected: 1,
      level: "success",
      message: "Paused 1 keyword",
    },
    {
      action: "pause",
      result: outcome({ changed: 2, unchanged: 1 }),
      selected: 3,
      level: "success",
      message: "Paused 2 keywords, 1 already paused",
    },
    {
      action: "resume",
      result: outcome({ changed: 1, unchanged: 2 }),
      selected: 3,
      level: "success",
      message: "Activated 1 keyword, 2 already active",
    },
    {
      action: "resume",
      result: outcome({ unchanged: 3 }),
      selected: 3,
      level: "info",
      message: "Activated 0 keywords, 3 already active",
    },
    {
      action: "untrack",
      result: outcome({ changed: 2, missing: 1 }),
      selected: 3,
      level: "success",
      message: "Stopped tracking 2 keywords, 1 no longer tracked",
    },
    {
      action: "untrack",
      result: outcome({ changed: 3 }),
      selected: 3,
      level: "success",
      message: "Stopped tracking 3 keywords",
    },
  ] as const)(
    "reports $action as $message",
    ({ action, result, selected, level, message }) => {
      expect(bulkReport(action, result, selected)).toEqual({ level, message });
    },
  );

  it("names a refused request with the reason the API gave", () => {
    expect(
      bulkReport("resume", outcome({ notSent: 3, error: refusal }), 3),
    ).toEqual({
      level: "error",
      message: "Could not activate 3 keywords",
      description: "Keyword markets limit reached",
    });
  });

  it("warns when a later chunk failed after an earlier one changed rows", () => {
    expect(
      bulkReport(
        "pause",
        outcome({ changed: 500, notSent: 700, error: refusal }),
        1200,
      ),
    ).toMatchObject({
      level: "warning",
      message: "Paused 500, 700 not changed",
    });
  });

  it("gives no reason for a failure that is not an API answer", () => {
    expect(
      bulkReport(
        "pause",
        outcome({ notSent: 2, error: new Error("offline") }),
        2,
      ),
    ).toEqual({
      level: "error",
      message: "Could not pause 2 keywords",
      description: undefined,
    });
  });
});
