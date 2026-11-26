import type {
  PortfolioApp,
  PortfolioHistory,
  PortfolioMovement,
  PortfolioRangeChange,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { appLabel } from "./breakdown";

export const quietSentence = (
  compared: boolean,
  days: number,
  t: MessageTranslator,
): string => t(compared ? "lede.noMovement" : "lede.movementPending", { days });

export interface LedePart {
  key: string;
  values?: Record<string, string | number>;
}

export type MovementLede = LedePart[];

const movementKind = ({
  up,
  down,
}: PortfolioMovement): "Up" | "Down" | "Both" =>
  up > 0 && down > 0 ? "Both" : up > 0 ? "Up" : "Down";

export function movementLede(
  change: PortfolioRangeChange,
  days: number,
): MovementLede {
  const { up, down } = change.movement;
  if (up + down === 0) {
    return [
      {
        key: change.compared ? "lede.rangeQuiet" : "lede.rangePending",
        values: { days },
      },
    ];
  }
  const many = change.appsMoved > 1;
  return [
    {
      key: `lede.range${movementKind(change.movement)}${many ? "Many" : "Single"}`,
      values: { days, up, down, count: change.appsMoved },
    },
  ];
}

function busiestApp(
  history: PortfolioHistory,
  apps: readonly PortfolioApp[],
  t: MessageTranslator,
): string | null {
  const moved = (history.apps ?? [])
    .map(({ appId, lastRun }) => ({ appId, size: lastRun.up + lastRun.down }))
    .filter(({ size }) => size > 0)
    .sort((a, b) => b.size - a.size);
  if (moved.length < 2 || moved[0].size === moved[1].size) return null;
  const app = apps.find((each) => each.id === moved[0].appId);
  return app ? appLabel(app, apps, t) : null;
}

function rangeTrend(change: PortfolioRangeChange, days: number): LedePart[] {
  if (!change.compared || change.visibilityDelta === null) return [];
  const delta = Math.round(change.visibilityDelta);
  return [
    {
      key:
        delta === 0
          ? "lede.rangeTrendUnchanged"
          : delta > 0
            ? "lede.rangeTrendUp"
            : "lede.rangeTrendDown",
      values: { days, count: Math.abs(delta) },
    },
  ];
}

export function dashboardLede(
  history: PortfolioHistory,
  apps: readonly PortfolioApp[],
  t: MessageTranslator,
): LedePart[] {
  const { lastRun, change, days } = history;
  if (!lastRun?.compared) return movementLede(change, days);
  const { up, down } = lastRun.movement;
  if (up + down === 0)
    return [{ key: "lede.lastRunQuiet" }, ...rangeTrend(change, days)];
  const busiest = busiestApp(history, apps, t);
  return [
    {
      key: `lede.lastRun${movementKind(lastRun.movement)}${busiest ? "Busiest" : ""}`,
      values: { up, down, ...(busiest ? { app: busiest } : {}) },
    },
    ...rangeTrend(change, days),
  ];
}
