import { describe, expect, it } from "vitest";
import { INLINED_PROPERTIES, inlineStyleText } from "./inline-style";

describe("inlineStyleText", () => {
  it("writes each readable property once, in a fixed order", () => {
    const values: Record<string, string> = {
      stroke: "oklch(0.52 0.15 240)",
      fill: "none",
      "stroke-width": "2px",
    };
    expect(inlineStyleText((property) => values[property] ?? "")).toBe(
      "fill:none;stroke:oklch(0.52 0.15 240);stroke-width:2px",
    );
  });

  it("skips blank values and trims the rest", () => {
    expect(
      inlineStyleText((property) => (property === "fill" ? "  red " : "  ")),
    ).toBe("fill:red");
  });

  it("returns an empty string when nothing is readable", () => {
    expect(inlineStyleText(() => "")).toBe("");
  });

  it("names the paint, stroke, stop and text properties a chart needs", () => {
    expect(INLINED_PROPERTIES).toEqual(
      expect.arrayContaining([
        "fill",
        "stroke",
        "stroke-dasharray",
        "stop-color",
        "font-family",
        "font-size",
        "text-anchor",
      ]),
    );
  });
});
