import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PortfolioApp, PortfolioHistory } from "@asobeast/shared";
import { changedFieldsLabel } from "@/components/keywords/position-history";
import type { MessageTranslator } from "@/i18n/translator";
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
  t: MessageTranslator,
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
    value: (
      <TrendChip
        label={t("dayNotes.thatDay")}
        value={change}
        labelled={false}
      />
    ),
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
  const t = useTranslations("dashboard");
  const moves = movesOn(history, date, metric, t);
  const changes = (history.listingChanges ?? []).filter(
    (change) => change.date === date,
  );
  if (moves.length + changes.length === 0) return null;

  const nameOf = (appId: string): string => {
    const app = apps.find((each) => each.id === appId);
    return app ? appLabel(app, apps, t) : t("dayNotes.unknownApp");
  };
  const hidden = moves.length - MOVES_SHOWN;

  return (
    <div
      data-slot="day-notes"
      className="grid gap-1.5 border-t border-border-subtle pt-1.5"
    >
      {moves.length > 0 ? (
        <p className="text-faint-foreground">{t("dayNotes.largest")}</p>
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
        <p className="text-faint-foreground">
          {t("dayNotes.andMore", { count: hidden })}
        </p>
      ) : null}
      {changes.map((change) => (
        <p key={change.appId} className="text-muted-foreground">
          {t("dayNotes.fieldsChanged", {
            name: nameOf(change.appId),
            fields: changedFieldsLabel(change.fields),
          })}
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
