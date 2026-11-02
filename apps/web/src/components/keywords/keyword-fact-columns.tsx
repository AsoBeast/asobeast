"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { nullsLast } from "@/lib/table/sorting";
import { AddedCell, CompetitorsInTop10Cell } from "./keyword-cells";
import {
  keywordColumnHelper as columnHelper,
  SORTABLE,
} from "./keyword-column-helper";

export function addedColumn() {
  return columnHelper.accessor((row) => nullsLast(row.trackedAt ?? null), {
    id: "added",
    meta: { label: "Added", hiddenByDefault: true },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => <SortableHeader column={column} label="Added" />,
    cell: ({ row }) => <AddedCell trackedAt={row.original.trackedAt ?? null} />,
  });
}

export function competitorsColumn() {
  return columnHelper.accessor(
    (row) => nullsLast(row.competitorsInTop10 ?? null),
    {
      id: "competitors",
      meta: { label: "Competitors in top 10", hiddenByDefault: true },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label="Competitors in top 10" />
          <InfoTip
            label="About competitors in the top 10"
            title="Competitors in the top 10"
            summary="How many of your competitors rank in the top 10 of this keyword's newest stored search results. A dash means you track no competitors, or the keyword has no snapshot from today or yesterday."
          />
        </span>
      ),
      cell: ({ row }) => (
        <CompetitorsInTop10Cell
          value={row.original.competitorsInTop10 ?? null}
        />
      ),
    },
  );
}
