import { dayBefore } from "@/lib/utc-day";

const WEEK_DAYS = 7;
const MAX_DAY_TICKS = 6;
const MAX_VALUE_TICKS = 5;
const STEPS = [1, 2, 5, 10, 20, 25, 50];
const STEP_SCALE = 100;

export interface ValueAxis {
  domain: [number, number];
  valueTicks: number[];
}

function stepFor(least: number, most: number): number {
  for (let scale = 1; ; scale *= STEP_SCALE) {
    const step = STEPS.map((base) => base * scale).find((candidate) => {
      const low = Math.floor(least / candidate) * candidate;
      const high = Math.max(Math.ceil(most / candidate) * candidate, low + 1);
      return (high - low) / candidate <= MAX_VALUE_TICKS - 1;
    });
    if (step !== undefined) return step;
  }
}

export function valueAxis(values: number[]): ValueAxis {
  const finite = values.filter(Number.isFinite);
  const least = finite.length === 0 ? 0 : Math.min(...finite);
  const most = finite.length === 0 ? 0 : Math.max(...finite);
  const step = stepFor(least, most);
  const low = Math.max(0, Math.floor(least / step) * step);
  const ceiling = Math.ceil(most / step) * step;
  const high = ceiling > low ? ceiling : low + step;
  const valueTicks: number[] = [];
  for (let tick = low; tick <= high; tick += step) valueTicks.push(tick);
  return { domain: [low, high], valueTicks };
}

export function windowDays(newest: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    dayBefore(newest, days - 1 - index),
  );
}

export function dayTicks(dates: string[]): string[] {
  const weeks = Math.ceil(dates.length / WEEK_DAYS / MAX_DAY_TICKS);
  const every = dates.length <= WEEK_DAYS ? 1 : weeks * WEEK_DAYS;
  return dates.filter((_, index) => (dates.length - 1 - index) % every === 0);
}
