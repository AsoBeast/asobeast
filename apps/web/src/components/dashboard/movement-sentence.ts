import type { PortfolioMovement } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

export function movementSentence(
  movement: PortfolioMovement,
  apps: number,
  weekOfHistory: boolean,
): string {
  const { up, down } = movement;
  if (up + down === 0) {
    return weekOfHistory
      ? "No keyword moved in the last 7 days."
      : "Movement appears after a week of daily runs.";
  }

  const moved = [
    up > 0 ? `${pluralize(up, "keyword")} climbed` : null,
    down > 0 ? `${up > 0 ? down : pluralize(down, "keyword")} fell` : null,
  ]
    .filter((part) => part !== null)
    .join(" and ");
  const across = apps > 1 ? ` across ${pluralize(apps, "app")}` : "";
  return `In the last 7 days ${moved}${across}.`;
}
