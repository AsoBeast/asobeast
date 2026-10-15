"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { ChartEntryItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { movementSortValue } from "./movement";
import { MovementCell } from "./MovementCell";

const columnHelper = createColumnHelper<DataTableFeatures, ChartEntryItem>();

function PriceCell({ free }: { free: boolean | null }) {
  if (free === null) return <span className="text-muted-foreground">—</span>;
  return <Badge variant="outline">{free ? "Free" : "Paid"}</Badge>;
}

export function chartColumns(period: string) {
  return columnHelper.columns([
    columnHelper.accessor("position", {
      id: "position",
      sortFn: "basic",
      sortDescFirst: false,
      enableHiding: false,
      meta: { phone: true },
      header: ({ column }) => <SortableHeader column={column} label="#" />,
      cell: ({ row }) => (
        <span className="numeric font-mono">{row.original.position}</span>
      ),
    }),
    columnHelper.accessor(movementSortValue, {
      id: "movement",
      sortFn: "basic",
      sortDescFirst: false,
      enableHiding: false,
      meta: { label: "Change", phone: true },
      header: ({ column }) => <SortableHeader column={column} label="Change" />,
      cell: ({ row }) => <MovementCell entry={row.original} period={period} />,
    }),
    columnHelper.accessor("title", {
      id: "app",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      meta: { phone: true },
      header: ({ column }) => <SortableHeader column={column} label="App" />,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon
            src={row.original.iconUrl}
            name={row.original.title}
            size={32}
          />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium" translate="no">
              {row.original.title}
            </span>
            {row.original.developer ? (
              <span className="text-caption text-muted-foreground">
                {row.original.developer}
              </span>
            ) : null}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.genreName ?? "", {
      id: "genre",
      sortFn: "text",
      meta: { label: "Category" },
      header: ({ column }) => (
        <SortableHeader column={column} label="Category" />
      ),
      cell: ({ row }) =>
        row.original.genreName ?? (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    columnHelper.display({
      id: "price",
      meta: { label: "Price" },
      header: () => "Price",
      cell: ({ row }) => <PriceCell free={row.original.free} />,
    }),
  ]);
}
