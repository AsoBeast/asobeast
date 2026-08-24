import { describe, expect, it } from "vitest";
import { POSITION_BANDS, positionBand } from "./position-band";

describe("positionBand", () => {
  it("has no band for a keyword that was checked and not found", () => {
    expect(positionBand(null)).toBeNull();
  });

  it.each([
    [1, "top 3"],
    [3, "top 3"],
    [4, "top 10"],
    [10, "top 10"],
    [11, "top 25"],
    [25, "top 25"],
    [26, "top 50"],
    [50, "top 50"],
    [51, "beyond 50"],
    [200, "beyond 50"],
  ])("puts position %i in the %s band", (position, label) => {
    expect(positionBand(position)?.label).toBe(label);
  });

  it("gives every band its own token", () => {
    const tokens = new Set(POSITION_BANDS.map((band) => band.token));
    expect(tokens.size).toBe(POSITION_BANDS.length);
  });
});
