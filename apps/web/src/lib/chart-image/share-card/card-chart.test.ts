import { describe, expect, it } from "vitest";
import {
  axisLabels,
  cardChartShape,
  fittedDomain,
  roundTicks,
} from "./card-chart";

const PLOT = { x: 0, y: 0, width: 100, height: 100 };
const CLEARANCE = 10;

const day = (index: number) =>
  new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);

const line = (values: readonly (number | null)[], days?: readonly number[]) =>
  values.map((value, index) => ({ date: day(days?.[index] ?? index), value }));

const shape = (
  values: readonly (number | null)[],
  kind: "rank" | "visibility" = "rank",
  days?: readonly number[],
) => cardChartShape(line(values, days), kind, PLOT, CLEARANCE);

describe("fittedDomain", () => {
  it("pads the drawn ranks by a share of their span", () => {
    const [low, high] = fittedDomain([10, 30], "rank");

    expect(low).toBeCloseTo(7);
    expect(high).toBeCloseTo(33);
  });

  it("keeps a small move from filling the chart", () => {
    const [low, high] = fittedDomain([20, 20.5], "rank");

    expect(high - low).toBeCloseTo(3.9);
    expect((low + high) / 2).toBeCloseTo(20.25);
  });

  it("stops just above the first rank", () => {
    const [low, high] = fittedDomain([1, 2], "rank");

    expect(low).toBe(0.4);
    expect(high).toBeCloseTo(4.3);
  });

  it("keeps visibility between 0 and 100", () => {
    const [low, high] = fittedDomain([97, 100], "visibility");

    expect(low).toBeCloseTo(89.6);
    expect(high).toBe(100);
    expect(fittedDomain([0, 1], "visibility")[0]).toBe(0);
    expect(fittedDomain([0, 100], "visibility")).toEqual([0, 100]);
  });
});

describe("roundTicks", () => {
  it.each([
    [
      [16.9, 22.1],
      [18, 20, 22],
    ],
    [
      [47.3, 57.7],
      [50, 55],
    ],
    [
      [0.4, 5.6],
      [2, 4],
    ],
    [
      [0, 100],
      [0, 50, 100],
    ],
    [
      [60, 210],
      [100, 150, 200],
    ],
  ] as const)("marks %j at %j", (domain, ticks) => {
    expect(roundTicks(domain)).toEqual(ticks);
  });
});

describe("axisLabels", () => {
  it("names the year once", () => {
    expect(axisLabels("2026-11-19", "2026-11-26")).toEqual([
      "Nov 19",
      "Nov 26, 2026",
    ]);
  });

  it("names both years across a new year", () => {
    expect(axisLabels("2025-12-20", "2026-01-03")).toEqual([
      "Dec 20, 2025",
      "Jan 3, 2026",
    ]);
  });
});

describe("cardChartShape", () => {
  it("draws the best rank at the top", () => {
    const [[[best, worst]]] = shape([3, 10]).traces;

    expect(best[1]).toBeLessThan(worst[1]);
  });

  it("draws the highest visibility at the top", () => {
    const [[[low, high]]] = shape([40, 60], "visibility").traces;

    expect(high[1]).toBeLessThan(low[1]);
  });

  it("spreads the days across the plot", () => {
    const { traces } = shape([3, 4, 5], "rank", [0, 1, 4]);

    expect(traces.flat(2).map(([x]) => x)).toEqual([0, 25, 100]);
  });

  it("joins the runs on each side of a day without a check", () => {
    const { traces } = shape([3, 4, 5, 6], "rank", [0, 1, 3, 4]);

    expect(traces).toHaveLength(1);
    expect(traces[0].map((run) => run.length)).toEqual([2, 2]);
  });

  it("breaks the line where the app was not ranked", () => {
    expect(shape([3, 4, null, 5, 6]).traces).toHaveLength(2);
  });

  it("labels the ticks as ranks", () => {
    expect(shape([18, 20]).ticks.map(({ label }) => label)).toEqual([
      "#18",
      "#19",
      "#20",
    ]);
  });

  it("marks the first and last values", () => {
    const { start, end } = shape([18.7, 19.2, 20]);

    expect(start).toMatchObject({ x: 0, label: "#18.7" });
    expect(end).toMatchObject({ x: 100, label: "#20" });
  });

  it("rounds a visibility mark to a whole figure", () => {
    expect(shape([40, 54.6], "visibility").end?.label).toBe("55");
  });

  it("leaves the end unmarked when the app was not ranked on the last day", () => {
    expect(shape([3, 4, null]).end).toBeNull();
  });

  it("drops the start label when a tick already names that height", () => {
    expect(shape([20, 18]).startLabelled).toBe(false);
    expect(shape([18.7, 20]).startLabelled).toBe(true);
  });

  it("draws nothing when the app was never ranked", () => {
    expect(shape([null, null, null, null])).toEqual({
      traces: [],
      ticks: [],
      start: null,
      startLabelled: false,
      end: null,
    });
  });
});
