import { describe, expect, it } from "vitest";
import {
  meterValue,
  utilizationLevel,
  utilizationPercent,
  utilizationStatus,
} from "./utilization";

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

describe("utilizationStatus", () => {
  it("names each level, keeping over capacity for demand past capacity", () => {
    expect(utilizationStatus(0.4)).toBe("Healthy");
    expect(utilizationStatus(0.7)).toBe("High");
    expect(utilizationStatus(0.86)).toBe("Near capacity");
    expect(utilizationStatus(1)).toBe("Near capacity");
    expect(utilizationStatus(1.01)).toBe("Over capacity");
  });
});

describe("meterValue", () => {
  it("keeps the meter value inside its range and states the real percent", () => {
    expect(meterValue(0.42)).toEqual({ now: 42, text: "42%" });
    expect(meterValue(1.234)).toEqual({ now: 100, text: "123%" });
  });
});
