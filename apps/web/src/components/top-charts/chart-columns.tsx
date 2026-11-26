"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { ChartEntryItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import type { MessageTranslator } from "@/i18n/translator";
import { movementSortValue } from "./movement";
import { MovementCell } from "@/components/movement/MovementCell";
import type { ChartRowContext } from "./chart-actions";
import { RowActions } from "./RowActions";

const columnHelper = createColumnHelper<DataTableFeatures, ChartEntryItem>();

function PriceCell({ free }: { free: boolean | null }) {
  const t = useTranslations("topCharts");
  if (free === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={free ? "text-muted-foreground" : undefined}>
      {t(free ? "collections.free" : "collections.paid")}
    </span>
  );
}

function genreColumn(t: MessageTranslator) {
  return columnHelper.accessor((row) => row.genreName ?? "", {
    id: "genre",
    sortFn: "text",
    meta: { label: t("category") },
    header: ({ column }) => (
      <SortableHeader column={column} label={t("category")} />
    ),
    cell: ({ row }) =>
      row.original.genreName ?? (
        <span className="text-muted-foreground">—</span>
      ),
  });
}

function priceColumn(t: MessageTranslator) {
  return columnHelper.display({
    id: "price",
    meta: { label: t("price") },
    header: () => t("price"),
    cell: ({ row }) => <PriceCell free={row.original.free} />,
  });
}

export function chartColumns(
  period: string,
  context: ChartRowContext,
  { withGenre, withPrice }: { withGenre: boolean; withPrice: boolean },
  t: MessageTranslator,
) {
  return columnHelper.columns([
    columnHelper.accessor("position", {
      id: "position",
      sortFn: "basic",
      sortDescFirst: false,
      enableHiding: false,
      meta: { phone: true, numeric: true },
      header: ({ column }) => <SortableHeader column={column} label="#" />,
      cell: ({ row }) => (
        <span className="numeric">{row.original.position}</span>
      ),
    }),
    columnHelper.accessor(movementSortValue, {
      id: "movement",
      sortFn: "basic",
      sortDescFirst: false,
      enableHiding: false,
      meta: { label: t("change"), phone: true, numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("change")} />
      ),
      cell: ({ row }) => <MovementCell entry={row.original} period={period} />,
    }),
    columnHelper.accessor("title", {
      id: "app",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      meta: { phone: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("app")} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon src={row.original.iconUrl} size={24} />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium" translate="no">
              <bdi>{row.original.title}</bdi>
            </span>
            {row.original.developer ? (
              <span className="text-tick text-faint-foreground">
                {row.original.developer}
              </span>
            ) : null}
          </div>
        </div>
      ),
    }),
    ...(withGenre ? [genreColumn(t)] : []),
    ...(withPrice ? [priceColumn(t)] : []),
    columnHelper.display({
      id: "actions",
      enableHiding: false,
      header: () => <span className="sr-only">{t("actions")}</span>,
      cell: ({ row }) => <RowActions entry={row.original} context={context} />,
    }),
  ]);
}
