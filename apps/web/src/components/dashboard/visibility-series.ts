import type { PortfolioApp } from "@asobeast/shared";
import { storeLabel } from "@/lib/format";

const CHARTED_APPS = 5;

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

const nameOf = (app: PortfolioApp): string => app.name ?? "Untitled app";

function labelsOf(apps: PortfolioApp[]): Map<string, string> {
  const namesakes = (app: PortfolioApp) =>
    apps.filter((other) => nameOf(other) === nameOf(app));
  return new Map(
    apps.map((app) => {
      const same = namesakes(app);
      if (same.length < 2) return [app.id, nameOf(app)];
      const parts = [nameOf(app)];
      if (same.some((other) => other.store !== app.store)) {
        parts.push(storeLabel(app.store));
      }
      if (same.some((other) => other.country !== app.country)) {
        parts.push(app.country.toUpperCase());
      }
      return [app.id, parts.join(" · ")];
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
    days: Math.max(0, ...shown.map((app) => app.sparkline.length)),
    omitted: withHistory.length - shown.length,
  };
}
