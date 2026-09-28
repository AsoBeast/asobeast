export type Point = readonly [number, number];

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

const secantSlopes = (points: readonly Point[]): number[] =>
  points.slice(1).map(([x, y], index) => {
    const [px, py] = points[index];
    return (y - py) / (x - px);
  });

function tangentAt(slopes: number[], index: number): number {
  if (index === 0) return slopes[0];
  if (index === slopes.length) return slopes[index - 1];
  const before = slopes[index - 1];
  const after = slopes[index];
  if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) {
    return 0;
  }
  return 2 / (1 / before + 1 / after);
}

export function monotonePath(points: readonly Point[]): string {
  const slopes = secantSlopes(points);
  const tangents = points.map((_, index) => tangentAt(slopes, index));
  return points
    .map(([x, y], index) => {
      if (index === 0) return `M${fixed(x)} ${fixed(y)}`;
      const [px, py] = points[index - 1];
      const third = (x - px) / 3;
      return `C${fixed(px + third)} ${fixed(py + tangents[index - 1] * third)} ${fixed(
        x - third,
      )} ${fixed(y - tangents[index] * third)} ${fixed(x)} ${fixed(y)}`;
    })
    .join(" ");
}

export function areaPath(points: readonly Point[], bottom: number): string {
  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  return `${monotonePath(points)} L${fixed(lastX)} ${fixed(bottom)} L${fixed(
    firstX,
  )} ${fixed(bottom)} Z`;
}
