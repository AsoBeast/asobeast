import { describe, expect, it } from "vitest";
import { versionRatings } from "./version-ratings";

const review = (version: string | null, score: number) => ({ version, score });

describe("versionRatings", () => {
  it("averages the loaded reviews of each version in the order the store lists them", () => {
    expect(
      versionRatings(
        [
          review("3.4.0", 2),
          review("3.4.1", 5),
          review("3.4.0", 1),
          review("3.4.1", 4),
          review("3.4.1", 4),
        ],
        ["3.4.1", "3.4.0"],
      ),
    ).toEqual([
      { version: "3.4.1", reviews: 3, average: 13 / 3 },
      { version: "3.4.0", reviews: 2, average: 1.5 },
    ]);
  });

  it("leaves out reviews without a version and puts unlisted versions last", () => {
    expect(
      versionRatings(
        [review(null, 1), review("", 1), review("1.0", 3), review("2.0", 5)],
        ["2.0"],
      ),
    ).toEqual([
      { version: "2.0", reviews: 1, average: 5 },
      { version: "1.0", reviews: 1, average: 3 },
    ]);
  });

  it("answers nothing when no review names a version", () => {
    expect(versionRatings([review(null, 4)], [])).toEqual([]);
  });
});
