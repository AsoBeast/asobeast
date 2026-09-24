import { describe, expect, it } from "vitest";
import { GRADES } from "@/lib/grade";
import {
  countBy,
  gradeIn,
  oneOf,
  positionBandIn,
  positionBandOf,
  statusFilter,
  versusOf,
} from "./facets";

describe("oneOf", () => {
  it("keeps a value that is selected", () => {
    expect(oneOf("TITLE", ["TITLE", "MANUAL"])).toBe(true);
  });

  it("drops a value that is not selected", () => {
    expect(oneOf("SUBTITLE", ["TITLE", "MANUAL"])).toBe(false);
  });

  it("never keeps a missing value", () => {
    expect(oneOf(undefined, ["TITLE"])).toBe(false);
  });
});

describe("statusFilter", () => {
  const active = { active: true };
  const paused = { active: false };

  it("keeps only active rows for active", () => {
    expect(statusFilter(active, "active")).toBe(true);
    expect(statusFilter(paused, "active")).toBe(false);
  });

  it("keeps only paused rows for paused", () => {
    expect(statusFilter(active, "paused")).toBe(false);
    expect(statusFilter(paused, "paused")).toBe(true);
  });

  it("keeps every row for all", () => {
    expect(statusFilter(active, "all")).toBe(true);
    expect(statusFilter(paused, "all")).toBe(true);
  });
});

describe("gradeIn", () => {
  it("keeps a value whose grade is selected", () => {
    expect(gradeIn("popularity", 62, ["strong"])).toBe(true);
  });

  it("drops a value whose grade is not selected", () => {
    expect(gradeIn("popularity", 62, ["fair", "weak"])).toBe(false);
  });

  it("never keeps an unscored value", () => {
    expect(gradeIn("popularity", null, GRADES)).toBe(false);
  });
});

describe("positionBandOf", () => {
  it.each([
    [1, "top3"],
    [3, "top3"],
    [4, "top10"],
    [10, "top10"],
    [11, "top30"],
    [30, "top30"],
    [31, "beyond"],
    [200, "beyond"],
  ] as const)("puts position %s in %s", (position, band) => {
    expect(positionBandOf(position, 200)).toBe(band);
  });

  it("calls a checked keyword without a position unranked", () => {
    expect(positionBandOf(null, 200)).toBe("unranked");
  });

  it("gives a keyword that was never checked no band", () => {
    expect(positionBandOf(null, null)).toBeNull();
  });
});

describe("positionBandIn", () => {
  it("keeps a position in a selected band", () => {
    expect(positionBandIn(7, 200, ["top10", "unranked"])).toBe(true);
    expect(positionBandIn(null, 200, ["unranked"])).toBe(true);
  });

  it("drops a position outside the selected bands", () => {
    expect(positionBandIn(45, 200, ["top3", "top10"])).toBe(false);
  });

  it("never keeps a keyword that was never checked", () => {
    expect(positionBandIn(null, null, ["unranked"])).toBe(false);
  });
});

describe("countBy", () => {
  it("counts items by key and skips a missing key", () => {
    expect(
      countBy([1, 2, 3, 4, null], (value) =>
        value === null ? null : value % 2 === 0 ? "even" : "odd",
      ),
    ).toEqual(
      new Map([
        ["odd", 2],
        ["even", 2],
      ]),
    );
  });
});

describe("versusOf", () => {
  it.each([
    [1, [4, 9], "winning"],
    [3, [null], "winning"],
    [3, [], "winning"],
    [5, [5, 8], "tied"],
    [12, [4], "losing"],
    [12, [null, 11], "losing"],
    [null, [8], "losing"],
  ] as const)("calls you at %s against %j %s", (you, competitors, expected) => {
    expect(versusOf(you, competitors)).toBe(expected);
  });

  it("has no verdict when nobody ranks", () => {
    expect(versusOf(null, [null, null])).toBeNull();
  });
});
