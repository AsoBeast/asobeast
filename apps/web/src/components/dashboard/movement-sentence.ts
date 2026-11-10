import type { PortfolioRangeChange } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

export const quietSentence = (compared: boolean, days: number): string =>
  compared
    ? `No keyword moved in the last ${days} days.`
    : `Movement appears after ${days} days of daily runs.`;

export interface MovementLede {
  lead: string;
  fact: string;
  tail: string;
}

export function movementLede(
  change: PortfolioRangeChange,
  days: number,
): MovementLede {
  const { up, down } = change.movement;
  if (up + down === 0) {
    return {
      lead: "",
      fact: quietSentence(change.compared, days),
      tail: "",
    };
  }

  const fact = [
    up > 0 ? `${pluralize(up, "keyword")} climbed` : null,
    down > 0 ? `${up > 0 ? down : pluralize(down, "keyword")} fell` : null,
  ]
    .filter((part) => part !== null)
    .join(" and ");
  return {
    lead: `In the last ${days} days `,
    fact,
    tail:
      change.appsMoved > 1
        ? ` across ${pluralize(change.appsMoved, "app")}.`
        : ".",
  };
}
