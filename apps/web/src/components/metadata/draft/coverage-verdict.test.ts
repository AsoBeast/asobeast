import { describe, expect, it } from "vitest";
import { coverageShare, coverageVerdict } from "./coverage-verdict";

const counts = (lost: number, gained: number, missing: number, kept: number) =>
  ({ counts: { lost, gained, missing, kept } }) as const;

describe("coverageVerdict", () => {
  it("counts what the draft and the live listing cover", () => {
    expect(coverageVerdict(counts(1, 0, 1, 1))).toEqual({
      total: 3,
      draft: 1,
      live: 2,
    });
  });

  it("counts a gained keyword for the draft only", () => {
    expect(coverageVerdict(counts(0, 2, 0, 1))).toEqual({
      total: 3,
      draft: 3,
      live: 1,
    });
  });

  it("answers nothing when no keyword is judged", () => {
    expect(coverageVerdict(counts(0, 0, 0, 0))).toBeNull();
  });
});

describe("coverageShare", () => {
  it("is the share of judged keywords the draft covers", () => {
    expect(coverageShare({ total: 4, draft: 3, live: 1 })).toBe(75);
  });
});
