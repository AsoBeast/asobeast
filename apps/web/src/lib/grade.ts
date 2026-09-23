export const GRADES = ["strong", "fair", "weak", "poor"] as const;
export type Grade = (typeof GRADES)[number];

export type GradePolarity = "higher-is-better" | "lower-is-better";

export interface GradeScale {
  polarity: GradePolarity;
  cuts: readonly [number, number, number];
}

export const GRADE_SCALES = {
  popularity: { polarity: "higher-is-better", cuts: [60, 40, 20] },
  difficulty: { polarity: "lower-is-better", cuts: [35, 55, 75] },
  opportunity: { polarity: "higher-is-better", cuts: [60, 35, 15] },
  position: { polarity: "lower-is-better", cuts: [3, 10, 30] },
  coverage: { polarity: "higher-is-better", cuts: [80, 50, 25] },
  rating: { polarity: "higher-is-better", cuts: [4.5, 4, 3.5] },
} as const satisfies Record<string, GradeScale>;

export type GradeMetric = keyof typeof GRADE_SCALES;

export function grade(metric: GradeMetric, value: number | null): Grade | null {
  if (value === null) return null;
  const { polarity, cuts } = GRADE_SCALES[metric];
  const index =
    polarity === "higher-is-better"
      ? cuts.findIndex((cut) => value >= cut)
      : cuts.findIndex((cut) => value <= cut);
  return index === -1 ? "poor" : GRADES[index];
}

export function gradeLabel(value: Grade): string {
  return value;
}
