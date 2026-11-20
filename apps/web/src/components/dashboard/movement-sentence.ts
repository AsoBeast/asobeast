import type {
  PortfolioApp,
  PortfolioHistory,
  PortfolioMovement,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { pluralize } from "@/lib/format";
import { appLabel } from "./breakdown";

export const quietSentence = (compared: boolean, days: number): string =>
  compared
    ? `No keyword moved in the last ${days} days.`
    : `Movement appears after ${days} days of daily runs.`;

export interface MovementLede {
  lead: string;
  fact: string;
  tail: string;
}

const movedFact = ({ up, down }: PortfolioMovement): string =>
  [
    up > 0 ? `${pluralize(up, "keyword")} climbed` : null,
    down > 0 ? `${up > 0 ? down : pluralize(down, "keyword")} fell` : null,
  ]
    .filter((part) => part !== null)
    .join(" and ");

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

  return {
    lead: `In the last ${days} days `,
    fact: movedFact(change.movement),
    tail:
      change.appsMoved > 1
        ? ` across ${pluralize(change.appsMoved, "app")}.`
        : ".",
  };
}

export interface LedePart {
  text: string;
  strong: boolean;
}

const plain = (text: string): LedePart => ({ text, strong: false });

const strong = (text: string): LedePart => ({ text, strong: true });

function busiestApp(
  history: PortfolioHistory,
  apps: readonly PortfolioApp[],
): string | null {
  const moved = (history.apps ?? [])
    .map(({ appId, lastRun }) => ({ appId, size: lastRun.up + lastRun.down }))
    .filter(({ size }) => size > 0)
    .sort((a, b) => b.size - a.size);
  if (moved.length < 2 || moved[0].size === moved[1].size) return null;
  const app = apps.find((each) => each.id === moved[0].appId);
  return app ? appLabel(app, apps) : null;
}

function rangeTrend(change: PortfolioRangeChange, days: number): LedePart[] {
  if (!change.compared || change.visibilityDelta === null) return [];
  const delta = Math.round(change.visibilityDelta);
  const lead = plain(` Over the last ${days} days visibility is `);
  if (delta === 0) return [lead, strong("unchanged"), plain(".")];
  return [
    lead,
    strong(`${delta > 0 ? "up" : "down"} ${Math.abs(delta)}`),
    plain("."),
  ];
}

export function dashboardLede(
  history: PortfolioHistory,
  apps: readonly PortfolioApp[],
): LedePart[] {
  const { lastRun, change, days } = history;
  if (!lastRun?.compared) {
    const { lead, fact, tail } = movementLede(change, days);
    return [plain(lead), strong(fact), plain(tail)];
  }
  const { up, down } = lastRun.movement;
  if (up + down === 0) {
    return [
      plain("In the last run "),
      strong("no keyword moved"),
      plain("."),
      ...rangeTrend(change, days),
    ];
  }
  const busiest = busiestApp(history, apps);
  return [
    plain("In the last run "),
    strong(movedFact(lastRun.movement)),
    ...(busiest ? [plain(", most in "), strong(busiest)] : []),
    plain("."),
    ...rangeTrend(change, days),
  ];
}
