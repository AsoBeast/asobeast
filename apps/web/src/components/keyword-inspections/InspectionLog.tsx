"use client";

import {
  KEYWORD_INSPECTION_LIST_LIMIT,
  type KeywordInspectionSummary,
} from "@asobeast/shared";
import { Loader2 } from "lucide-react";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { PANEL_BLEED, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatCountry,
  formatDateTime,
  formatDayMonth,
  formatNumber,
  pluralize,
  storeLabel,
} from "@/lib/format";
import { ZONE_LABELS, zoneOf, type ZoneThresholds } from "@/lib/keyword-zones";
import { cn } from "@/lib/utils";
import { DeleteInspectionButton } from "./DeleteInspectionButton";
import { shownScore, storefrontCode } from "./inspection-format";

const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 @[38rem]/log:grid-cols-[minmax(0,1fr)_7.25rem_repeat(3,4.75rem)_3.75rem_1.75rem]";

const SCORE = "numeric hidden text-right @[38rem]/log:block";

function zoneWord(
  item: KeywordInspectionSummary,
  thresholds: ZoneThresholds,
): string {
  if (item.volume === null || item.difficulty100 === null) return "No score";
  const zone = zoneOf(
    {
      popularity: Math.round(item.volume),
      difficulty: Math.round(item.difficulty100),
    },
    thresholds,
  );
  return zone === null ? "No score" : ZONE_LABELS[zone];
}

function RunState({ item }: { item: KeywordInspectionSummary }) {
  if (item.status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        <span>Running</span>
      </span>
    );
  }
  return <span className="font-medium text-signal-down">Failed</span>;
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
  const storefront = storefrontCode(item.store, item.country);
  const day = formatDayMonth(item.completedAt ?? item.requestedAt);
  return (
    <li
      className={cn(
        ROW,
        "relative min-h-10 rounded-md px-2 text-dense transition-colors duration-150 ease-out hover:bg-muted @[38rem]/log:min-h-9",
        selected &&
          "bg-muted before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground",
      )}
    >
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => onSelect(item.id)}
        className="grid min-w-0 items-center gap-x-2 gap-y-0.5 rounded-sm py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring @[38rem]/log:col-span-6 @[38rem]/log:grid-cols-subgrid @[38rem]/log:py-0"
      >
        <span className="min-w-0 truncate font-medium">
          <bdi>{item.keyword}</bdi>
        </span>
        <span className="truncate text-caption text-muted-foreground @[38rem]/log:hidden">
          {done ? (
            <span>{`${storefront} · ${zoneWord(item, thresholds)} · ${day}`}</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <RunState item={item} />
              <span>{`· ${storefront} · ${day}`}</span>
            </span>
          )}
        </span>
        <span className="hidden truncate text-muted-foreground @[38rem]/log:block">
          {storefront}
        </span>
        {done ? (
          <>
            <span className={SCORE}>{shownScore(item.volume)}</span>
            <span className={SCORE}>{shownScore(item.difficulty100)}</span>
            <span className={SCORE}>{shownScore(item.opportunity)}</span>
          </>
        ) : (
          <span className="hidden @[38rem]/log:col-span-3 @[38rem]/log:block">
            <RunState item={item} />
          </span>
        )}
        <span className="numeric hidden pl-2 text-muted-foreground @[38rem]/log:block">
          {day}
        </span>
      </button>
      <DeleteInspectionButton
        id={item.id}
        keyword={item.keyword}
        subject={`${item.keyword} in ${storeLabel(item.store)} ${formatCountry(item.country)} from ${formatDateTime(item.requestedAt)}`}
        onDeleted={onDeleted}
      />
    </li>
  );
}

const storefrontCount = (items: readonly KeywordInspectionSummary[]) =>
  new Set(items.map((item) => `${item.store}|${item.country}`)).size;

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
    <Card
      aria-labelledby="inspection-log"
      className="@container/log min-w-0"
      role="region"
    >
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2 id="inspection-log">All inspections</h2>
        </CardTitle>
        {items.length > 0 ? (
          <CardAction className="numeric self-center text-label text-faint-foreground">
            {`${formatNumber(items.length)} · latest ${formatNumber(KEYWORD_INSPECTION_LIST_LIMIT)}`}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={items.length === 0 ? undefined : PANEL_BLEED}>
        {items.length === 0 ? (
          <EmptyState
            title="No inspections yet"
            body="Every keyword you inspect is kept here, across every store and country, so you can compare it later."
            className="py-8"
          />
        ) : (
          <div className="p-2">
            <div
              aria-hidden
              className={cn(
                ROW,
                "hidden min-h-9 border-b px-2 text-label text-faint-foreground @[38rem]/log:grid",
              )}
            >
              <span>Keyword</span>
              <span>Storefront</span>
              <span className="text-right">Popularity</span>
              <span className="text-right">Difficulty</span>
              <span className="text-right">Opportunity</span>
              <span className="pl-2">Inspected</span>
              <span />
            </div>
            <ul className="flex flex-col pt-1">
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
      </CardContent>
      {items.length > 0 ? (
        <CardFooter>
          <span>
            {`${pluralize(items.length, "inspection")} across ${pluralize(storefrontCount(items), "storefront")} · the newest ${formatNumber(KEYWORD_INSPECTION_LIST_LIMIT)} are kept`}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
