import { describe, expect, it } from "vitest";
import {
  GRADES,
  GRADE_SCALES,
  grade,
  gradeLabel,
  type Grade,
  type GradeMetric,
} from "./grade";

const CUTS: ReadonlyArray<readonly [GradeMetric, number, Grade]> = [
  ["popularity", 100, "strong"],
  ["popularity", 60, "strong"],
  ["popularity", 59, "fair"],
  ["popularity", 40, "fair"],
  ["popularity", 39, "weak"],
  ["popularity", 20, "weak"],
  ["popularity", 19, "poor"],
  ["popularity", 0, "poor"],
  ["difficulty", 0, "strong"],
  ["difficulty", 35, "strong"],
  ["difficulty", 36, "fair"],
  ["difficulty", 55, "fair"],
  ["difficulty", 56, "weak"],
  ["difficulty", 75, "weak"],
  ["difficulty", 76, "poor"],
  ["difficulty", 100, "poor"],
  ["opportunity", 60, "strong"],
  ["opportunity", 59, "fair"],
  ["opportunity", 35, "fair"],
  ["opportunity", 34, "weak"],
  ["opportunity", 15, "weak"],
  ["opportunity", 14, "poor"],
  ["position", 1, "strong"],
  ["position", 3, "strong"],
  ["position", 4, "fair"],
  ["position", 10, "fair"],
  ["position", 11, "weak"],
  ["position", 30, "weak"],
  ["position", 31, "poor"],
  ["position", 200, "poor"],
  ["coverage", 80, "strong"],
  ["coverage", 79, "fair"],
  ["coverage", 50, "fair"],
  ["coverage", 49, "weak"],
  ["coverage", 25, "weak"],
  ["coverage", 24, "poor"],
  ["rating", 5, "strong"],
  ["rating", 4.5, "strong"],
  ["rating", 4.4, "fair"],
  ["rating", 4, "fair"],
  ["rating", 3.9, "weak"],
  ["rating", 3.5, "weak"],
  ["rating", 3.4, "poor"],
];

const METRICS = Object.keys(GRADE_SCALES) as GradeMetric[];

describe("grade", () => {
  it.each(CUTS)("grades %s %s as %s", (metric, value, expected) => {
    expect(grade(metric, value)).toBe(expected);
  });

  it.each(METRICS)("leaves a missing %s ungraded", (metric) => {
    expect(grade(metric, null)).toBeNull();
  });
});

describe("GRADE_SCALES", () => {
  it.each(METRICS)("orders the %s cuts outward from strong", (metric) => {
    const { polarity, cuts } = GRADE_SCALES[metric];
    const [strong, fair, weak] = cuts;
    if (polarity === "higher-is-better") {
      expect(strong).toBeGreaterThan(fair);
      expect(fair).toBeGreaterThan(weak);
    } else {
      expect(strong).toBeLessThan(fair);
      expect(fair).toBeLessThan(weak);
    }
  });
});

describe("gradeLabel", () => {
  it.each(GRADES)("names the %s grade in lower case", (value) => {
    expect(gradeLabel(value)).toBe(value.toLowerCase());
  });
});
