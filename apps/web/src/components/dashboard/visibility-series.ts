import type { PortfolioApp } from "@asobeast/shared";

export const CHARTED_APPS = 5;

export interface VisibilitySeries {
  key: string;
  appId: string;
  label: string;
}

export interface PortfolioVisibility {
  rows: Array<Record<string, string | number | null>>;
  series: VisibilitySeries[];
  days: number;
  omitted: number;
}

const charted = (app: PortfolioApp): boolean =>
  app.lastCapturedAt !== null && app.sparkline.length > 0;

function labelsOf(apps: PortfolioApp[]): Map<string, string> {
  const names = new Map<string, number>();
  for (const app of apps) {
    const name = app.name ?? "Untitled app";
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  return new Map(
    apps.map((app) => {
      const name = app.name ?? "Untitled app";
      const shared = (names.get(name) ?? 0) > 1;
      return [app.id, shared ? `${name} · ${app.country.toUpperCase()}` : name];
    }),
  );
}

export function portfolioVisibility(
  apps: PortfolioApp[],
  limit = CHARTED_APPS,
): PortfolioVisibility {
  const withHistory = apps.filter(charted);
  const shown = [...withHistory]
    .sort((a, b) => b.visibility.current - a.visibility.current)
    .slice(0, limit);
  const labels = labelsOf(shown);
  const series = shown.map((app, index) => ({
    key: `app${index}`,
    appId: app.id,
    label: labels.get(app.id) ?? "Untitled app",
  }));

  const byDate = new Map<string, Record<string, string | number | null>>();
  shown.forEach((app, index) => {
    for (const point of app.sparkline) {
      const row = byDate.get(point.date) ?? { date: point.date };
      row[`app${index}`] = point.visibility;
      byDate.set(point.date, row);
    }
  });
  const rows = [...byDate.values()]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((row) => {
      const filled = { ...row };
      for (const { key } of series) filled[key] ??= null;
      return filled;
    });

  return {
    rows,
    series,
    days: rows.length,
    omitted: withHistory.length - shown.length,
  };
}
