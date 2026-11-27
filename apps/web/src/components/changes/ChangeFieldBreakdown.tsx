"use client";

import { Suspense, useId } from "react";
import { useTranslations } from "next-intl";
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
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import { cn } from "@/lib/utils";
import { fieldCounts, fieldGroupLabel, type FieldCount } from "./change-fields";
import { FieldBreakdownSkeleton } from "./skeletons";
import { useChangeEvents, useChangeFilter } from "./use-change-view";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_3.5rem_6rem] gap-3 px-2";

const rowName = (row: FieldCount, t: MessageTranslator): string =>
  t("breakdown.rowAria", {
    field: fieldGroupLabel(row.group, t),
    yours: row.yours,
    competitors: row.competitors,
  });

function Count({ value }: { value: number }) {
  const locale = useAppLocale();
  return (
    <span
      className={cn(
        "numeric relative text-right",
        value === 0 ? "text-faint-foreground" : null,
      )}
    >
      {formatNumberInLocale(value, locale)}
    </span>
  );
}

function FieldBreakdown({ id }: { id: string }) {
  const t = useTranslations("changes");
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
            <h2 id={headingId}>{t("breakdown.title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
            <span>{t("breakdown.field")}</span>
            <span className="text-right">{t("owners.yours")}</span>
            <span className="text-right">{t("owners.competitors")}</span>
          </div>
          <ul className="flex list-none flex-col p-0">
            {rows.map((row) => {
              const selected = filter.field === row.group;
              return (
                <li key={row.group}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={rowName(row, t)}
                    onClick={() =>
                      setFilter({ field: selected ? null : row.group })
                    }
                    className={cn(COLUMNS, BREAKDOWN_BUTTON_ROW)}
                  >
                    <BreakdownBar
                      share={(row.yours + row.competitors) / largest}
                    />
                    <span className="relative truncate font-medium">
                      {fieldGroupLabel(row.group, t)}
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
          <span>{t("breakdown.footer", { count: events.length, days })}</span>
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
