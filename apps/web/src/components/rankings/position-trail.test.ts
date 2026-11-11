import { describe, expect, it } from "vitest";
import { positionTrail } from "./position-trail";

describe("positionTrail", () => {
  it("turns positions into values that rise as the rank improves", () => {
    expect(
      positionTrail([
        { date: "2026-11-09", position: 12, depth: 200 },
        { date: "2026-11-10", position: 6, depth: 200 },
      ]),
    ).toEqual([-12, -6]);
  });

  it("places a checked and not found day just below the checked depth", () => {
    expect(
      positionTrail([
        { date: "2026-11-09", position: null, depth: 100 },
        { date: "2026-11-10", position: 100, depth: 100 },
      ]),
    ).toEqual([-101, -100]);
  });
});
