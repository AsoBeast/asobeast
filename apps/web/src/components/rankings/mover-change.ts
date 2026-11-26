import type { KeywordMover } from "@asobeast/shared";
import type { Locale } from "@/lib/locale";

const BAR_CAP = 20;

export type MoverChange =
  | { kind: "new"; share: number }
  | { kind: "lost"; share: number }
  | { kind: "up" | "down"; size: number; share: number };

export function moverChange(mover: KeywordMover): MoverChange {
  if (mover.from === null) return { kind: "new", share: 1 };
  if (mover.to === null) return { kind: "lost", share: 1 };
  const delta = mover.from - mover.to;
  const size = Math.abs(delta);
  return {
    kind: delta >= 0 ? "up" : "down",
    size,
    share: Math.min(size, BAR_CAP) / BAR_CAP,
  };
}

const weight = (mover: KeywordMover): number => {
  const change = moverChange(mover);
  return change.kind === "new" || change.kind === "lost"
    ? BAR_CAP * BAR_CAP
    : change.size;
};

export function byMagnitude<T extends KeywordMover>(movers: T[]): T[] {
  return [...movers].sort((a, b) => weight(b) - weight(a));
}

export interface MoverPeriod {
  within: string;
  span: string;
}

export const daysPeriod = (days: number, locale: Locale = "en"): MoverPeriod =>
  locale === "zh-CN"
    ? {
        within: `在 ${days} 天内`,
        span: `在过去 ${days} 天内`,
      }
    : {
        within: `in ${days} days`,
        span: `in the last ${days} days`,
      };

export const lastRunPeriod = (locale: Locale = "en"): MoverPeriod =>
  locale === "zh-CN"
    ? {
        within: "在上次运行中",
        span: "在上次运行中",
      }
    : {
        within: "in the last run",
        span: "in the last run",
      };
