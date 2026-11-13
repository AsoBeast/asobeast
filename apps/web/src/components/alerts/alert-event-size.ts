import type { AlertEventItem } from "@asobeast/shared";
import type { DeltaPolarity } from "@/components/ui/delta-chip";

export interface AlertEventSize {
  value: number;
  polarity: DeltaPolarity;
  period: string;
}

const TENTHS_PER_STAR = 10;

function positionsMoved(
  from: number | null,
  to: number | null,
): AlertEventSize | null {
  if (from === null || to === null || from === to) return null;
  const moved = to - from;
  return {
    value: moved,
    polarity: "lower-is-better",
    period: Math.abs(moved) === 1 ? "position" : "positions",
  };
}

export function alertEventSize(
  payload: AlertEventItem["payload"],
): AlertEventSize | null {
  switch (payload.event) {
    case "rank.dropped":
    case "rank.improved":
    case "rank.milestone":
    case "rank.overtaken":
    case "chart.milestone":
      return positionsMoved(payload.from, payload.to);
    case "rating.dropped":
      return payload.dropTenths > 0
        ? {
            value: -payload.dropTenths / TENTHS_PER_STAR,
            polarity: "higher-is-better",
            period: "stars",
          }
        : null;
    default:
      return null;
  }
}
