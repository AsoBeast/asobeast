"use client";

import type { KeywordInspectionSummary } from "@asobeast/shared";
import { Loader2 } from "lucide-react";
import { ZONE_FILLS } from "@/components/keywords/map/zone-layers";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber, storeLabel } from "@/lib/format";
import { ZONE_LABELS, zoneOf, type ZoneThresholds } from "@/lib/keyword-zones";
import { cn } from "@/lib/utils";
import { DeleteInspectionButton } from "./DeleteInspectionButton";
import { shownScore } from "./inspection-format";

const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[minmax(0,1.6fr)_repeat(3,5.5rem)_9rem_11rem_2rem]";

function ZoneMark({
  item,
  thresholds,
}: {
  item: KeywordInspectionSummary;
  thresholds: ZoneThresholds;
}) {
  const zone =
    item.volume === null || item.difficulty100 === null
      ? null
      : zoneOf(
          {
            popularity: Math.round(item.volume),
            difficulty: Math.round(item.difficulty100),
          },
          thresholds,
        );
  if (zone === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ background: ZONE_FILLS[zone] }}
      />
      {ZONE_LABELS[zone]}
    </span>
  );
}

function StatusOrScores({ item }: { item: KeywordInspectionSummary }) {
  if (item.status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Running
      </span>
    );
  }
  if (item.status === "FAILED")
    return <Badge variant="destructive">Failed</Badge>;
  return null;
}

function LogRow({
  item,
  selected,
  thresholds,
  onSelect,
  onDeleted,
}: {
  item: KeywordInspectionSummary;
  selected: boolean;
  thresholds: ZoneThresholds;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const done = item.status === "DONE";
  const storefront = `${storeLabel(item.store)} · ${item.country.toUpperCase()}`;
  return (
    <li
      className={cn(
        ROW,
        "rounded-md px-3 py-1 transition-colors hover:bg-muted/60",
        selected && "bg-muted",
      )}
    >
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => onSelect(item.id)}
        className="col-span-1 grid min-w-0 items-center gap-x-4 rounded-sm py-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:col-span-6 md:grid-cols-subgrid"
      >
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "truncate font-medium",
                selected && "text-foreground",
              )}
            >
              {item.keyword}
            </span>
            <span className="md:hidden">
              <StatusOrScores item={item} />
            </span>
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {storefront}
            <span className="md:hidden">
              {done
                ? ` · pop ${shownScore(item.volume)} · diff ${shownScore(item.difficulty100)} · opp ${shownScore(item.opportunity)}`
                : null}
            </span>
          </span>
        </span>
        {done ? (
          <>
            <span className="numeric hidden text-right font-mono md:block">
              {shownScore(item.volume)}
            </span>
            <span className="numeric hidden text-right font-mono md:block">
              {shownScore(item.difficulty100)}
            </span>
            <span className="numeric hidden text-right font-mono md:block">
              {shownScore(item.opportunity)}
            </span>
            <span className="hidden md:block">
              <ZoneMark item={item} thresholds={thresholds} />
            </span>
          </>
        ) : (
          <span className="hidden md:col-span-4 md:block">
            <StatusOrScores item={item} />
          </span>
        )}
        <span className="hidden text-sm text-muted-foreground md:block">
          {formatDateTime(item.completedAt ?? item.requestedAt)}
        </span>
      </button>
      <DeleteInspectionButton
        id={item.id}
        keyword={item.keyword}
        onDeleted={onDeleted}
      />
    </li>
  );
}

export function InspectionLog({
  items,
  selected,
  onSelect,
  onDeleted,
}: {
  items: readonly KeywordInspectionSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const { thresholds } = useZoneThresholds();
  return (
    <section aria-labelledby="inspection-log" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 id="inspection-log" className="text-title">
          All inspections
        </h2>
        <span className="text-sm text-muted-foreground">
          {formatNumber(items.length)} across every storefront
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Inspections you run are kept here so you can compare them later.
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            aria-hidden
            className={cn(
              ROW,
              "hidden border-b px-3 pb-2 text-xs text-muted-foreground md:grid",
            )}
          >
            <span>Keyword</span>
            <span className="text-right">Popularity</span>
            <span className="text-right">Difficulty</span>
            <span className="text-right">Opportunity</span>
            <span>Zone</span>
            <span>Inspected</span>
            <span />
          </div>
          <ul className="flex flex-col gap-0.5 pt-1">
            {items.map((item) => (
              <LogRow
                key={item.id}
                item={item}
                selected={item.id === selected}
                thresholds={thresholds}
                onSelect={onSelect}
                onDeleted={onDeleted}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
