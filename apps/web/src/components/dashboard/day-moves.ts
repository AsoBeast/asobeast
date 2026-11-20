import type { PortfolioAppHistory } from "@asobeast/shared";
import type { TrendMetric } from "./history-trend";

export interface DayChange {
  appId: string;
  change: number;
}

export interface DayMovement {
  appId: string;
  up: number;
  down: number;
}

export function dayChanges(
  apps: readonly PortfolioAppHistory[],
  date: string,
  metric: TrendMetric,
): DayChange[] {
  return apps
    .flatMap(({ appId, points }) => {
      const index = points.findIndex((point) => point.date === date);
      if (index < 1) return [];
      const change =
        Math.round(points[index][metric]) -
        Math.round(points[index - 1][metric]);
      return change === 0 ? [] : [{ appId, change }];
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function dayMovements(
  apps: readonly PortfolioAppHistory[],
  date: string,
): DayMovement[] {
  return apps
    .flatMap(({ appId, points }) => {
      const point = points.find((each) => each.date === date);
      if (!point || point.climbed + point.fell === 0) return [];
      return [{ appId, up: point.climbed, down: point.fell }];
    })
    .sort((a, b) => b.up + b.down - (a.up + a.down));
}
