import { describe, expect, it } from "vitest";
import {
  POSITION_SHARES,
  UNSCORED_POPULARITY,
  VISIBILITY_GUIDE,
} from "./visibility-help";

describe("visibility help", () => {
  it("shows the share of popularity each example position counts", () => {
    expect(POSITION_SHARES).toEqual([
      { position: "1", share: "100%" },
      { position: "3", share: "50%" },
      { position: "10", share: "29%" },
      { position: "50", share: "18%" },
      { position: "100", share: "15%" },
      { position: "Not found", share: "0%" },
    ]);
  });

  it("names the popularity an unscored keyword counts as on the shown scale", () => {
    expect(UNSCORED_POPULARITY).toBe(10);
  });

  it("links the concept page that owns the formula", () => {
    expect(VISIBILITY_GUIDE).toBe(
      "https://docs.asobeast.com/concepts/visibility",
    );
  });
});
