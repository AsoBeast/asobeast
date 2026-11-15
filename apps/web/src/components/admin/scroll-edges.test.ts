import { describe, expect, it } from "vitest";
import { scrollEdgesOf } from "./scroll-edges";

describe("scrollEdgesOf", () => {
  it.each([
    ["fits", { scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }, "none"],
    [
      "hides tabs at the end",
      { scrollLeft: 0, scrollWidth: 500, clientWidth: 300 },
      "end",
    ],
    [
      "hides tabs on both sides",
      { scrollLeft: 80, scrollWidth: 500, clientWidth: 300 },
      "both",
    ],
    [
      "is scrolled to the end",
      { scrollLeft: 200, scrollWidth: 500, clientWidth: 300 },
      "start",
    ],
    [
      "is a subpixel short of the end",
      { scrollLeft: 199.5, scrollWidth: 500, clientWidth: 300 },
      "start",
    ],
  ] as const)("reads a row that %s", (_, box, edges) => {
    expect(scrollEdgesOf(box)).toBe(edges);
  });
});
