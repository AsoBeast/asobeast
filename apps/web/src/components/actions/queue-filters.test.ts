import { describe, expect, it } from "vitest";
import { isFilteredView } from "./queue-filters";

const view = (
  overrides: Partial<Parameters<typeof isFilteredView>[0]> = {},
) => ({
  status: ["OPEN", "SNOOZED"] as const,
  priority: [],
  rule: [],
  ...overrides,
});

describe("isFilteredView", () => {
  it("treats the default statuses in either order as unfiltered", () => {
    expect(isFilteredView(view())).toBe(false);
    expect(isFilteredView(view({ status: ["SNOOZED", "OPEN"] }))).toBe(false);
  });

  it("treats any other status set as filtered", () => {
    expect(isFilteredView(view({ status: ["DONE", "RESOLVED"] }))).toBe(true);
    expect(isFilteredView(view({ status: ["OPEN"] }))).toBe(true);
    expect(isFilteredView(view({ status: ["OPEN", "SNOOZED", "DONE"] }))).toBe(
      true,
    );
  });

  it("treats any priority or rule as filtered", () => {
    expect(isFilteredView(view({ priority: ["high"] }))).toBe(true);
    expect(isFilteredView(view({ rule: ["keyword.defend"] }))).toBe(true);
  });
});
