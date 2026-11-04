import { describe, expect, it } from "vitest";
import {
  directionOfKey,
  edgeDot,
  entryDot,
  neighbour,
  opportunityOrder,
  type DotDirection,
  type NavDot,
} from "./dot-navigation";

const dot = (
  keywordId: string,
  difficulty: number,
  popularity: number,
  extra: Partial<NavDot> = {},
): NavDot => ({
  keywordId,
  text: keywordId,
  difficulty,
  popularity,
  opportunity: 50,
  ...extra,
});

describe("neighbour", () => {
  const from = dot("from", 20, 50);

  it("prefers the dot nearer in line to the right", () => {
    const dots = [
      from,
      dot("near", 30, 50),
      dot("off", 25, 80),
      dot("far", 60, 50),
    ];
    expect(neighbour(dots, "from", "right")).toBe("near");
  });

  it.each<[DotDirection, string]>([
    ["left", "west"],
    ["right", "east"],
    ["up", "north"],
    ["down", "south"],
  ])("goes %s to %s", (direction, expected) => {
    const dots = [
      from,
      dot("west", 10, 52),
      dot("east", 35, 49),
      dot("north", 21, 70),
      dot("south", 18, 30),
    ];
    expect(neighbour(dots, "from", direction)).toBe(expected);
  });

  it("answers null when no dot lies that way", () => {
    expect(neighbour([from, dot("east", 40, 50)], "from", "left")).toBeNull();
  });

  it("never answers the dot itself", () => {
    expect(neighbour([from], "from", "right")).toBeNull();
  });

  it("answers null for an unknown dot", () => {
    expect(neighbour([from], "missing", "right")).toBeNull();
  });

  it("breaks equal scores by text then id", () => {
    const dots = [
      from,
      dot("b", 30, 55, { text: "same" }),
      dot("a", 30, 45, { text: "same" }),
      dot("c", 30, 55, { text: "zeta" }),
    ];
    expect(neighbour(dots, "from", "right")).toBe("a");
  });

  it("walks a stack of two dots and leaves it normally", () => {
    const dots = [
      dot("first", 20, 50, { opportunity: 80 }),
      dot("second", 20, 50, { opportunity: 40 }),
      dot("west", 10, 50),
      dot("east", 30, 50),
    ];

    expect(neighbour(dots, "first", "right")).toBe("second");
    expect(neighbour(dots, "first", "down")).toBe("second");
    expect(neighbour(dots, "second", "left")).toBe("first");
    expect(neighbour(dots, "second", "up")).toBe("first");
    expect(neighbour(dots, "first", "left")).toBe("west");
    expect(neighbour(dots, "second", "right")).toBe("east");
  });

  it("walks a stack of three in order", () => {
    const dots = [
      dot("middle", 20, 50, { opportunity: 60 }),
      dot("top", 20, 50, { opportunity: 90 }),
      dot("bottom", 20, 50, { opportunity: 10 }),
    ];

    expect(neighbour(dots, "top", "right")).toBe("middle");
    expect(neighbour(dots, "middle", "right")).toBe("bottom");
    expect(neighbour(dots, "bottom", "left")).toBe("middle");
    expect(neighbour(dots, "middle", "left")).toBe("top");
  });
});

describe("opportunityOrder", () => {
  const dots = [
    dot("none", 1, 1, { opportunity: null }),
    dot("low", 1, 1, { opportunity: 10 }),
    dot("b", 1, 1, { opportunity: 70, text: "same" }),
    dot("a", 1, 1, { opportunity: 70, text: "same" }),
    dot("high", 1, 1, { opportunity: 90 }),
  ];

  it("orders by opportunity, null last, ties by text then id", () => {
    expect(opportunityOrder(dots).map((entry) => entry.keywordId)).toEqual([
      "high",
      "a",
      "b",
      "low",
      "none",
    ]);
  });

  it("enters at the highest opportunity and reaches both edges", () => {
    expect(entryDot(dots)).toBe("high");
    expect(edgeDot(dots, "first")).toBe("high");
    expect(edgeDot(dots, "last")).toBe("none");
  });

  it("answers null without dots", () => {
    expect(entryDot([])).toBeNull();
    expect(edgeDot([], "last")).toBeNull();
  });
});

describe("directionOfKey", () => {
  it.each<[string, DotDirection]>([
    ["ArrowLeft", "left"],
    ["ArrowRight", "right"],
    ["ArrowUp", "up"],
    ["ArrowDown", "down"],
  ])("maps %s to %s", (key, direction) => {
    expect(directionOfKey(key)).toBe(direction);
  });

  it.each(["a", "Home", "Tab", "toString"])("ignores %s", (key) => {
    expect(directionOfKey(key)).toBeNull();
  });
});
