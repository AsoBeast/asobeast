"use client";

import { Suspense, useId } from "react";
import { LIST_HEAD, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  BREAKDOWN_BUTTON_ROW,
  BreakdownBar,
} from "@/components/reviews/breakdown";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fieldCounts, fieldGroupLabel, type FieldCount } from "./change-fields";
import { FieldBreakdownSkeleton } from "./skeletons";
import { useChangeEvents, useChangeFilter } from "./use-change-view";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_3.5rem_6rem] gap-3 px-2";

const rowName = (row: FieldCount): string =>
  `${fieldGroupLabel(row.group)}: ${row.yours} yours, ${row.competitors} from competitors`;

function Count({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "numeric relative text-right",
        value === 0 ? "text-faint-foreground" : null,
      )}
    >
      {formatNumber(value)}
    </span>
  );
}

function FieldBreakdown({ id }: { id: string }) {
  const headingId = useId();
  const { events, days } = useChangeEvents(id);
  const { filter, setFilter } = useChangeFilter();
  const rows = fieldCounts(events);
  if (rows.length === 0) return null;
  const largest = Math.max(...rows.map((row) => row.yours + row.competitors));

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>What changed</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
            <span>Field</span>
            <span className="text-right">Yours</span>
            <span className="text-right">Competitors</span>
          </div>
          <ul className="flex list-none flex-col p-0">
            {rows.map((row) => {
              const selected = filter.field === row.group;
              return (
                <li key={row.group}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={rowName(row)}
                    onClick={() =>
                      setFilter({ field: selected ? null : row.group })
                    }
                    className={cn(COLUMNS, BREAKDOWN_BUTTON_ROW)}
                  >
                    <BreakdownBar
                      share={(row.yours + row.competitors) / largest}
                    />
                    <span className="relative truncate font-medium">
                      {fieldGroupLabel(row.group)}
                    </span>
                    <Count value={row.yours} />
                    <Count value={row.competitors} />
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
        <CardFooter>
          <span>{`${pluralize(events.length, "change")} in ${days} days. A row filters the list.`}</span>
        </CardFooter>
      </Card>
    </section>
  );
}

export function ChangeFieldBreakdown({ id }: { id: string }) {
  return (
    <Suspense fallback={<FieldBreakdownSkeleton />}>
      <FieldBreakdown id={id} />
    </Suspense>
  );
}
