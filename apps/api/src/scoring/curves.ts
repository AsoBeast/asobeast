export const clamp = (v: number, lo = 0, hi = 10): number =>
  Math.min(hi, Math.max(lo, v));

export const linear = (v: number, min: number, max: number): number =>
  clamp(((v - min) / (max - min)) * 10);

export const logScale = (v: number, min: number, max: number): number =>
  v <= 0 ? 0 : linear(Math.log10(v), Math.log10(min), Math.log10(max));

export const finiteNumbers = (values: Array<number | undefined>): number[] =>
  values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );

export const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
