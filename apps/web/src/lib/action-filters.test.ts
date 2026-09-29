import { describe, expect, it } from "vitest";
import {
  ACTION_QUEUE_LIMIT,
  actionActivityScope,
  actionFiltersFrom,
  queueFilters,
} from "./action-filters";

describe("actionFiltersFrom", () => {
  it("fetches the default statuses at the queue limit", () => {
    expect(actionFiltersFrom({})).toEqual({
      status: ["OPEN", "SNOOZED"],
      limit: ACTION_QUEUE_LIMIT,
    });
  });

  it("builds the same filters the client builds for a status", () => {
    expect(actionFiltersFrom({ status: "DONE,DISMISSED" })).toEqual(
      queueFilters(["DONE", "DISMISSED"]),
    );
  });
});

describe("actionActivityScope", () => {
  it("leaves the app out of the workspace scope", () => {
    expect(actionActivityScope()).toEqual({ days: 30 });
    expect(actionActivityScope("app-1")).toEqual({ appId: "app-1", days: 30 });
  });
});
