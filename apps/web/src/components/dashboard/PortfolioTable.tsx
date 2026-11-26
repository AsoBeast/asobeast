"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { appListParsers, appSortParser } from "@/lib/search-params";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  isNumericColumn,
  isWideOnlyColumn,
} from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import {
  createPortfolioColumns,
  type PortfolioTableRow,
} from "./portfolio-columns";

export const WIDE_COLUMNS_FROM_REM = 56;

const widthClass = (meta: unknown): string | undefined =>
  isWideOnlyColumn(meta) ? "md:@max-4xl/dashboard:hidden" : undefined;

export function usePortfolioTable(rows: PortfolioTableRow[]) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const columns = useMemo(() => createPortfolioColumns(t, locale), [t, locale]);
  const [{ sort, dir }, setList] = useQueryStates(appListParsers);
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "portfolio",
    columns,
  );
  const { sorting, onSortingChange } = useUrlSorting(
    { sort, dir },
    columns,
    (next) =>
      void setList({
        sort: next.sort === null ? null : appSortParser.parse(next.sort),
        dir: next.dir,
      }),
  );

  return useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.app.id,
    state: { sorting, columnVisibility: visibility },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
  });
}

export function PortfolioTable({
  table,
}: {
  table: ReturnType<typeof usePortfolioTable>;
}) {
  const t = useTranslations("dashboard");
  return (
    <Table>
      <TableCaption className="sr-only">{t("apps.caption")}</TableCaption>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={widthClass(header.column.columnDef.meta)}
                numeric={isNumericColumn(header.column.columnDef.meta)}
                aria-sort={ariaSort(header.column.getIsSorted())}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={widthClass(cell.column.columnDef.meta)}
                numeric={isNumericColumn(cell.column.columnDef.meta)}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
