export type Point = readonly [number, number];

export interface CurveSegment {
  first: Point;
  second: Point;
  end: Point;
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

export function monotoneSegments(points: readonly Point[]): CurveSegment[] {
  const slopes = secantSlopes(points);
  const tangents = points.map((_, index) => tangentAt(slopes, index));
  return points.slice(1).map(([x, y], index) => {
    const [px, py] = points[index];
    const third = (x - px) / 3;
    return {
      first: [px + third, py + tangents[index] * third],
      second: [x - third, y - tangents[index + 1] * third],
      end: [x, y],
    };
  });
}
