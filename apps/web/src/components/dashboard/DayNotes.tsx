import type { ReactNode } from "react";
import type { PortfolioApp, PortfolioHistory } from "@asobeast/shared";
import { changedFieldsLabel } from "@/components/keywords/position-history";
import { TrendChip } from "@/components/ui/delta-chip";
import { appLabel } from "./breakdown";
import { dayChanges, dayMovements } from "./day-moves";
import { MovementValue } from "./MovementValue";

const MOVES_SHOWN = 3;

export type NotedMetric = "visibility" | "top10" | "moved";

interface AppMove {
  appId: string;
  value: ReactNode;
}

function movesOn(
  history: PortfolioHistory,
  date: string,
  metric: NotedMetric,
): AppMove[] {
  const apps = history.apps ?? [];
  if (apps.length < 2) return [];
  if (metric === "moved") {
    return dayMovements(apps, date).map((move) => ({
      appId: move.appId,
      value: <MovementValue movement={move} />,
    }));
  }
  return dayChanges(apps, date, metric).map(({ appId, change }) => ({
    appId,
    value: <TrendChip label="that day" value={change} labelled={false} />,
  }));
}

export function DayNotes({
  history,
  apps,
  metric,
  date,
}: {
  history: PortfolioHistory;
  apps: readonly PortfolioApp[];
  metric: NotedMetric;
  date: string;
}) {
  const moves = movesOn(history, date, metric);
  const changes = (history.listingChanges ?? []).filter(
    (change) => change.date === date,
  );
  if (moves.length + changes.length === 0) return null;

  const nameOf = (appId: string): string => {
    const app = apps.find((each) => each.id === appId);
    return app ? appLabel(app, apps) : "Unknown app";
  };
  const hidden = moves.length - MOVES_SHOWN;

  return (
    <div
      data-slot="day-notes"
      className="grid gap-1.5 border-t border-border-subtle pt-1.5"
    >
      {moves.length > 0 ? (
        <p className="text-faint-foreground">Largest moves that day</p>
      ) : null}
      {moves.slice(0, MOVES_SHOWN).map((move) => (
        <div
          key={move.appId}
          className="flex items-center justify-between gap-4"
        >
          <span className="truncate text-muted-foreground">
            {nameOf(move.appId)}
          </span>
          <span className="numeric font-medium whitespace-nowrap">
            {move.value}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <p className="text-faint-foreground">{`and ${hidden} more`}</p>
      ) : null}
      {changes.map((change) => (
        <p key={change.appId} className="text-muted-foreground">
          {`${nameOf(change.appId)} · ${changedFieldsLabel(change.fields)} changed`}
        </p>
      ))}
    </div>
  );
}

export function markedDays(
  history: PortfolioHistory,
  plotted: ReadonlyArray<{ date: string }>,
): string[] {
  const changed = new Set(
    (history.listingChanges ?? []).map((change) => change.date),
  );
  return plotted.map((row) => row.date).filter((date) => changed.has(date));
}
