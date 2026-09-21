export const clamp = (v: number, lo = 0, hi = 10): number =>
  Math.min(hi, Math.max(lo, v));

export const linear = (v: number, min: number, max: number): number =>
  clamp(((v - min) / (max - min)) * 10);

export const logScale = (v: number, min: number, max: number): number =>
  v <= 0 ? 0 : linear(Math.log10(v), Math.log10(min), Math.log10(max));
