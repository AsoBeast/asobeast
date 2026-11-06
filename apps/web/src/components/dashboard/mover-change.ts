import type { KeywordMover } from "@asobeast/shared";

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

export function byMagnitude<T extends KeywordMover>(movers: T[]): T[] {
  const weight = (mover: T) => {
    const change = moverChange(mover);
    return change.kind === "new" || change.kind === "lost"
      ? Number.POSITIVE_INFINITY
      : change.size;
  };
  return [...movers].sort((a, b) => weight(b) - weight(a));
}
