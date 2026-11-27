import { monotoneSegments, type Point } from "@/lib/monotone-curve";

export type { Point } from "@/lib/monotone-curve";

export interface SparklineBox {
  width: number;
  height: number;
  padding: number;
}

const fixed = (value: number): string => value.toFixed(1);

export function sparklinePoints(
  values: number[],
  { width, height, padding }: SparklineBox,
): Point[] {
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const step = (width - padding * 2) / (values.length - 1);
  return values.map((value, index) => [
    padding + index * step,
    span === 0
      ? height / 2
      : height - padding - ((value - min) / span) * (height - padding * 2),
  ]);
}

export function monotonePath(points: readonly Point[]): string {
  const [x, y] = points[0];
  return [
    `M${fixed(x)} ${fixed(y)}`,
    ...monotoneSegments(points).map(
      ({ first, second, end }) =>
        `C${[...first, ...second, ...end].map(fixed).join(" ")}`,
    ),
  ].join(" ");
}

export function areaPath(points: readonly Point[], bottom: number): string {
  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  return `${monotonePath(points)} L${fixed(lastX)} ${fixed(bottom)} L${fixed(
    firstX,
  )} ${fixed(bottom)} Z`;
}
