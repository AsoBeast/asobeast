import { describe, expect, it } from "vitest";
import type { CaptionSeries, ChartCaption } from "./caption";
import {
  clipText,
  dashPattern,
  layoutImage,
  legendRows,
  LEGEND_SAMPLE_WIDTH,
  wrapWords,
  type Measure,
} from "./layout";

const tenPerCharacter: Measure = (text) => Array.from(text).length * 10;

const series = (label: string): CaptionSeries => ({
  label,
  color: "var(--color-a)",
  dash: undefined,
});

describe("clipText", () => {
  it("keeps a text that fits", () => {
    expect(clipText("focus", 50, tenPerCharacter)).toBe("focus");
  });

  it("cuts to the room and ends with an ellipsis", () => {
    expect(clipText("focus timer", 60, tenPerCharacter)).toBe("focus…");
  });

  it("never splits a surrogate pair", () => {
    expect(clipText("𠮷𠮷𠮷𠮷", 30, tenPerCharacter)).toBe("𠮷𠮷…");
  });

  it("returns only the ellipsis when nothing fits", () => {
    expect(clipText("focus", 5, tenPerCharacter)).toBe("…");
  });
});

describe("wrapWords", () => {
  it("wraps at the last word that fits", () => {
    expect(wrapWords("aa bb cc dd", 50, tenPerCharacter)).toEqual([
      "aa bb",
      "cc dd",
    ]);
  });

  it("keeps a single long word on its own line", () => {
    expect(wrapWords("abcdefghij kl", 50, tenPerCharacter)).toEqual([
      "abcdefghij",
      "kl",
    ]);
  });

  it("returns no lines for an empty text", () => {
    expect(wrapWords("", 50, tenPerCharacter)).toEqual([]);
  });
});

describe("legendRows", () => {
  const sample = LEGEND_SAMPLE_WIDTH + 6;

  it("puts every item on one row while they fit", () => {
    const rows = legendRows([series("aa"), series("bb")], 500, tenPerCharacter);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.map((entry) => entry.x)).toEqual([0, sample + 20 + 16]);
  });

  it("starts a new row when the next item would overflow", () => {
    const rows = legendRows(
      [series("aa"), series("bb"), series("cc")],
      sample + 20 + 16 + sample + 20,
      tenPerCharacter,
    );
    expect(rows.map((row) => row.map((entry) => entry.label))).toEqual([
      ["aa", "bb"],
      ["cc"],
    ]);
    expect(rows[1]?.[0]?.x).toBe(0);
  });

  it("clips a label wider than the whole row", () => {
    const rows = legendRows([series("x".repeat(40))], 100, tenPerCharacter);
    expect(rows[0]?.[0]?.label.endsWith("…")).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("returns no rows without series", () => {
    expect(legendRows([], 100, tenPerCharacter)).toEqual([]);
  });
});

describe("layoutImage", () => {
  const caption: ChartCaption = {
    title: "Keyword rank positions",
    subtitle: "Focus Timer · App Store",
    brand: "AsoBeast",
    series: [series("a"), series("b")],
  };
  const measures = {
    title: tenPerCharacter,
    meta: tenPerCharacter,
    legend: tenPerCharacter,
  };

  it("pads the chart and stacks title, meta, chart and legend", () => {
    const layout = layoutImage({ width: 600, height: 300 }, caption, measures);

    expect(layout.width).toBe(640);
    expect(layout.contentX).toBe(20);
    expect(layout.title.baseline).toBe(36);
    expect(layout.meta).toHaveLength(1);
    expect(layout.chartY).toBe(20 + 24 + 18 + 10);
    expect(layout.legend).toHaveLength(1);
    expect(layout.height).toBe(layout.chartY + 300 + 8 + 22 + 20);
  });

  it("clips a title that would run into the brand", () => {
    const layout = layoutImage({ width: 300, height: 100 }, caption, measures);
    expect(layout.title.text.endsWith("…")).toBe(true);
    expect(tenPerCharacter(layout.title.text)).toBeLessThanOrEqual(
      300 - 80 - 16,
    );
  });

  it("grows by a line for each wrapped meta line and legend row", () => {
    const narrow = layoutImage({ width: 120, height: 100 }, caption, measures);
    const wide = layoutImage({ width: 600, height: 100 }, caption, measures);
    expect(narrow.meta.length).toBeGreaterThan(wide.meta.length);
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  it("draws no legend rows for a chart without series", () => {
    const layout = layoutImage(
      { width: 600, height: 300 },
      { ...caption, series: [] },
      measures,
    );
    expect(layout.legend).toEqual([]);
    expect(layout.height).toBe(layout.chartY + 300 + 8 + 20);
  });
});

describe("dashPattern", () => {
  it.each([
    [undefined, []],
    ["6 3", [6, 3]],
    ["10 4 2 4", [10, 4, 2, 4]],
    ["1 3", [1, 3]],
  ])("reads %j as %j", (dash, expected) => {
    expect(dashPattern(dash)).toEqual(expected);
  });
});
