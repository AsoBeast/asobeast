export const VOLATILITY_THRESHOLD = 45;
export const VOLATILITY_MIN_OBSERVED_DAYS = 5;
export const VOLATILITY_WINDOW_DAYS = 8;
export const VOLATILITY_DAMPED_CONFIDENCE = 0.3;

export function isVolatile(volatility: number | null): boolean {
  return volatility !== null && volatility >= VOLATILITY_THRESHOLD;
}
