"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { KeywordInspectionSummary } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, storeLabel } from "@/lib/format";
import { keywordInspectionsOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { DeleteInspectionButton } from "./DeleteInspectionButton";
import { INSPECTION_STATUS_LABELS, shownScore } from "./inspection-format";

const STATUS_VARIANTS = {
  PENDING: "info",
  DONE: "secondary",
  FAILED: "destructive",
} as const;

function HistoryRow({
  item,
  selected,
  onSelect,
  onDeleted,
}: {
  item: KeywordInspectionSummary;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2",
        selected && "border-primary",
      )}
    >
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => onSelect(item.id)}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex w-full items-center gap-2">
          <span className="truncate font-medium">{item.keyword}</span>
          <Badge variant={STATUS_VARIANTS[item.status]}>
            {INSPECTION_STATUS_LABELS[item.status]}
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">
          {storeLabel(item.store)} · {item.country.toUpperCase()} · Popularity{" "}
          {shownScore(item.volume)} · Difficulty{" "}
          {shownScore(item.difficulty100)}
        </span>
        <span className="text-xs text-muted-foreground">
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

export function InspectionHistory({
  selected,
  onSelect,
  onDeleted,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const { data } = useSuspenseQuery(keywordInspectionsOptions);
  return (
    <section
      aria-labelledby="inspection-history"
      className="flex flex-col gap-3"
    >
      <h2 id="inspection-history" className="text-title">
        Recent inspections
      </h2>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Inspections you run are kept here so you can compare them later.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              selected={item.id === selected}
              onSelect={onSelect}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
