import { describe, expect, it } from "vitest";
import {
  coverageShare,
  coverageVerdict,
  verdictSentence,
} from "./coverage-verdict";

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

describe("verdictSentence", () => {
  it("says how the draft compares with the live listing", () => {
    expect(verdictSentence({ total: 3, draft: 1, live: 2 })).toBe(
      "The draft covers 1 of 3 tracked keywords, 1 fewer than the live listing.",
    );
    expect(verdictSentence({ total: 3, draft: 3, live: 1 })).toBe(
      "The draft covers 3 of 3 tracked keywords, 2 more than the live listing.",
    );
  });

  it("leaves the comparison out when nothing moved", () => {
    expect(verdictSentence({ total: 3, draft: 2, live: 2 })).toBe(
      "The draft covers 2 of 3 tracked keywords.",
    );
  });
});
