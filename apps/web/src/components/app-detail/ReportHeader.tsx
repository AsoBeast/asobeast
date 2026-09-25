"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { formatCountry, formatDate } from "@/lib/format";
import { appDetailOptions } from "@/lib/queries";
import { rangeLabel, type DayPreset } from "@/lib/ranges";

export interface ReportRange {
  label: string;
  preset: DayPreset;
}

export function ReportHeader({
  id,
  page,
  ranges,
}: {
  id: string;
  page: string;
  ranges: readonly ReportRange[];
}) {
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const facts = [
    `Home storefront: ${formatCountry(detail.country)}`,
    ...ranges.map((range) => `${range.label}: ${rangeLabel(range.preset)}`),
  ];

  return (
    <div className="hidden flex-col gap-1 print:flex">
      <p className="text-title">{page} report</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body text-muted-foreground">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p
        className="text-caption text-muted-foreground"
        suppressHydrationWarning
      >
        {`Printed ${formatDate(new Date().toISOString())} (UTC) from asobeast`}
      </p>
    </div>
  );
}
