"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { flexRender, useTable } from "@tanstack/react-table";
import type { inferParserType, SetValues } from "nuqs";
import type { CompetitorGapKeyword } from "@asobeast/shared";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
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
import { gapTabSubject, type GapTab } from "@/lib/gap-lists";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  GAP_DEFAULT_SORT,
  gapSortParser,
  type gapTableParsers,
} from "@/lib/search-params";
import { numericProps } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import { exportGaps } from "./gap-csv";
import { gapColumns, type GapColumnScope } from "./gap-columns";
import {
  PHONE_HIDES_IDLE_SORT,
  SECTION_FOOTER,
  SECTION_SHEET,
  SECTION_TOOLBAR,
} from "./section-layout";

type GapTableParams = inferParserType<typeof gapTableParsers>;

const TAB_COLUMNS: Record<GapTab, { reason: boolean; margin: boolean }> = {
  gaps: { reason: false, margin: false },
  winnable: { reason: false, margin: false },
  threats: { reason: true, margin: false },
  lead: { reason: false, margin: true },
};

export function GapTable({
  appId,
  tab,
  rows,
  marketName,
  scope,
  params,
  setParams,
  footer,
}: {
  appId: string;
  tab: GapTab;
  rows: CompetitorGapKeyword[];
  marketName: string | null;
  scope: GapColumnScope;
  params: GapTableParams;
  setParams: SetValues<typeof gapTableParsers>;
  footer: string | null;
}) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const columns = useMemo(
    () => gapColumns(scope, { t, locale }),
    [scope, t, locale],
  );
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "gaps",
    columns,
  );
  const shown = TAB_COLUMNS[tab];
  const knownSort =
    (params.sort !== "reason" || shown.reason) &&
    (params.sort !== "margin" || shown.margin);
  const { sorting, onSortingChange } = useUrlSorting(
    { sort: knownSort ? params.sort : GAP_DEFAULT_SORT, dir: params.dir },
    columns,
    (next) =>
      void setParams({
        sort: next.sort === null ? null : gapSortParser.parse(next.sort),
        dir: next.dir,
      }),
  );

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: {
      sorting,
      globalFilter: params.q,
      columnVisibility: { ...visibility, ...shown },
    },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });
  const visible = table.getRowModel().rows;
  const caption = `${t(`gaps.captions.${tab}`)}${
    marketName ? t("gaps.captionMarket", { market: marketName }) : ""
  }.`;
  const names = new Map(
    [...scope.competitors].map(([id, competitor]) => [id, competitor.name]),
  );

  return (
    <>
      <div className={SECTION_TOOLBAR}>
        <SearchInput
          label={t("gaps.search")}
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <RowCount shown={visible.length} total={rows.length} noun="keyword" />
        <div className="ml-auto flex items-center gap-2">
          <ColumnMenu columns={table.getAllLeafColumns()} />
          <ExportCsvButton
            subject={gapTabSubject(tab, t)}
            aria-disabled={visible.length === 0 || undefined}
            onClick={() => {
              if (visible.length === 0) return;
              exportGaps(
                tab,
                appId,
                {
                  rows: visible.map((row) => row.original),
                  names,
                },
                t,
              );
            }}
          />
        </div>
      </div>
      <div className={cn(SECTION_SHEET, PHONE_HIDES_IDLE_SORT)}>
        <Table scrollLabel={t(`gaps.captions.${tab}`)} scrollFocus="overflow">
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(header.column.getIsSorted())}
                    {...numericProps(header.column)}
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
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                  <FilteredEmpty
                    title={t("gaps.noMatches")}
                    onClear={() => void setParams({ q: null })}
                  />
                </TableCell>
              </TableRow>
            ) : null}
            {visible.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} {...numericProps(cell.column)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {footer === null ? null : <p className={SECTION_FOOTER}>{footer}</p>}
      </div>
    </>
  );
}
