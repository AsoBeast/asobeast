import { describe, expect, it } from "vitest";
import {
  areaPath,
  monotonePath,
  sparklinePoints,
  type Point,
} from "./sparkline-path";

const BOX = { width: 120, height: 48, padding: 3 };

const numbers = (path: string): number[] =>
  (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

const curves = (path: string): Point[][] =>
  path
    .split("C")
    .slice(1)
    .map((segment) => {
      const [x1, y1, x2, y2, x, y] = numbers(segment);
      return [
        [x1, y1],
        [x2, y2],
        [x, y],
      ];
    });

describe("sparklinePoints", () => {
  it("maps the lowest value to the bottom and the highest to the top", () => {
    expect(sparklinePoints([0, 5, 10], BOX)).toEqual([
      [3, 45],
      [60, 24],
      [117, 3],
    ]);
  });

  it("draws a flat series through the middle", () => {
    expect(sparklinePoints([4, 4, 4], BOX).map(([, y]) => y)).toEqual([
      24, 24, 24,
    ]);
  });
});

describe("monotonePath", () => {
  it("draws two points as a straight cubic", () => {
    const path = monotonePath([
      [3, 45],
      [117, 3],
    ]);

    expect(path.startsWith("M3.0 45.0 C")).toBe(true);
    const [[[x1, y1], [x2, y2], [x, y]]] = curves(path);
    const slope = (3 - 45) / (117 - 3);
    expect(y1 - 45).toBeCloseTo(slope * (x1 - 3), 0);
    expect(y2 - 45).toBeCloseTo(slope * (x2 - 3), 0);
    expect([x, y]).toEqual([117, 3]);
  });

  it("never overshoots monotone data", () => {
    const points = sparklinePoints([1, 2, 2.5, 9, 9.5, 20], BOX);
    const path = monotonePath(points);

    curves(path).forEach(([first, second, end], index) => {
      const [, startY] = points[index];
      const low = Math.min(startY, end[1]);
      const high = Math.max(startY, end[1]);
      for (const [, y] of [first, second]) {
        expect(y).toBeGreaterThanOrEqual(low - 0.05);
        expect(y).toBeLessThanOrEqual(high + 0.05);
      }
    });
  });

  it("flattens the curve at a local extremum", () => {
    const path = monotonePath([
      [0, 30],
      [10, 5],
      [20, 30],
    ]);

    const [[, beforePeak], [afterPeak]] = curves(path);
    expect(beforePeak[1]).toBe(5);
    expect(afterPeak[1]).toBe(5);
  });
});

describe("areaPath", () => {
  it("closes the line along the bottom edge", () => {
    const points: Point[] = [
      [3, 45],
      [60, 24],
      [117, 3],
    ];

    expect(areaPath(points, 45)).toBe(
      `${monotonePath(points)} L117.0 45.0 L3.0 45.0 Z`,
    );
  });
});
