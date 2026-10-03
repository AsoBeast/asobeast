import { describe, expect, it } from "vitest";
import { utilizationLevel, utilizationPercent } from "./utilization";

describe("utilizationLevel", () => {
  it("keeps the thresholds the budget card has always used", () => {
    expect(utilizationLevel(0)).toBe("ok");
    expect(utilizationLevel(0.6)).toBe("ok");
    expect(utilizationLevel(0.61)).toBe("warn");
    expect(utilizationLevel(0.85)).toBe("warn");
    expect(utilizationLevel(0.86)).toBe("danger");
    expect(utilizationLevel(1.4)).toBe("danger");
  });
});

describe("utilizationPercent", () => {
  it("rounds to a whole percent", () => {
    expect(utilizationPercent(0.007)).toBe(1);
    expect(utilizationPercent(0.92)).toBe(92);
    expect(utilizationPercent(1.234)).toBe(123);
  });
});
