import { describe, expect, it } from "vitest";
import { cardChartShape } from "./card-chart";

const BOX = { x: 0, y: 0, width: 100, height: 100 };

const day = (index: number) =>
  new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);

const line = (values: readonly (number | null)[], days?: readonly number[]) =>
  values.map((value, index) => ({ date: day(days?.[index] ?? index), value }));

describe("cardChartShape", () => {
  it("maps rank positions on a reversed square root scale", () => {
    const { runs } = cardChartShape(line([1, 25, 100]), "rank", BOX, 100);

    expect(runs).toEqual([
      [
        { x: 0, y: 0 },
        { x: 50, y: 49 },
        { x: 100, y: 100 },
      ],
    ]);
  });

  it("draws a missing rank at the depth", () => {
    const { runs } = cardChartShape(line([4, null]), "rank", BOX, 200);

    expect(runs[0]?.[1]?.y).toBe(100);
  });

  it("maps visibility linearly from zero", () => {
    const { runs } = cardChartShape(line([0, 50, 100]), "visibility", BOX, 200);

    expect(runs[0]?.map(({ y }) => y)).toEqual([100, 50, 0]);
  });

  it("breaks the line at a missing day", () => {
    const { runs, dots } = cardChartShape(
      line([3, 4, 5, 6], [0, 1, 3, 4]),
      "rank",
      BOX,
      200,
    );

    expect(runs).toHaveLength(2);
    expect(dots).toEqual([]);
  });

  it("draws a lone day as a dot", () => {
    const { runs, dots } = cardChartShape(
      line([3, 4, 5, 6, 7], [0, 1, 3, 5, 6]),
      "rank",
      BOX,
      200,
    );

    expect(runs).toHaveLength(2);
    expect(dots).toEqual([{ x: 50, y: expect.any(Number) }]);
  });

  it("labels the rank ticks down to the depth", () => {
    const { ticks } = cardChartShape(line([3, null]), "rank", BOX, 30);

    expect(ticks.map(({ label }) => label)).toEqual(["1", "10", "25", "30"]);
    expect(ticks.at(-1)?.y).toBe(100);
  });

  it("fits the rank scale to the worst rank drawn", () => {
    const { runs, ticks } = cardChartShape(line([3, 8, 20]), "rank", BOX, 200);

    expect(ticks.map(({ label }) => label)).toEqual(["1", "10", "25"]);
    expect(ticks.at(-1)?.y).toBe(100);
    expect(runs[0]?.[2]?.y).toBe(89);
  });

  it("ends on the last day drawn", () => {
    expect(
      cardChartShape(line([3, 4, 5], [0, 1, 3]), "rank", BOX, 200).end,
    ).toEqual({ x: 100, y: expect.any(Number) });
  });

  it("rounds the visibility top to a readable figure", () => {
    const { ticks } = cardChartShape(line([12, 64]), "visibility", BOX, 200);

    expect(ticks).toEqual([
      { label: "0", y: 100 },
      { label: "50", y: 50 },
      { label: "100", y: 0 },
    ]);
  });
});
