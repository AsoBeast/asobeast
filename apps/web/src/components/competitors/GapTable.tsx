"use client";

import { useMemo } from "react";
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
import { GAP_TAB_SUBJECTS, type GapTab } from "@/lib/gap-lists";
import {
  GAP_DEFAULT_SORT,
  gapSortParser,
  type gapTableParsers,
} from "@/lib/search-params";
import { ariaSort } from "@/lib/table/sorting";
import { exportGaps } from "./gap-csv";
import { gapColumns, type GapColumnScope } from "./gap-columns";

type GapTableParams = inferParserType<typeof gapTableParsers>;

const TAB_CAPTIONS: Record<GapTab, string> = {
  gaps: "Keywords where a competitor ranks and you do not",
  winnable: "Keyword gaps that look winnable",
  threats: "Keywords where a competitor is closing in or passed you",
  lead: "Keywords where you rank ahead of every competitor",
};

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
}: {
  appId: string;
  tab: GapTab;
  rows: CompetitorGapKeyword[];
  marketName: string | null;
  scope: GapColumnScope;
  params: GapTableParams;
  setParams: SetValues<typeof gapTableParsers>;
}) {
  const columns = useMemo(() => gapColumns(scope), [scope]);
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
  const caption = `${TAB_CAPTIONS[tab]}${marketName ? `, for ${marketName}` : ""}.`;
  const names = new Map(
    [...scope.competitors].map(([id, competitor]) => [id, competitor.name]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search gap keywords"
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <RowCount shown={visible.length} total={rows.length} noun="keyword" />
        <div className="ml-auto flex items-center gap-2">
          <ColumnMenu columns={table.getAllLeafColumns()} />
          <ExportCsvButton
            subject={GAP_TAB_SUBJECTS[tab]}
            aria-disabled={visible.length === 0 || undefined}
            onClick={() => {
              if (visible.length === 0) return;
              exportGaps(
                tab,
                appId,
                visible.map((row) => row.original),
                names,
              );
            }}
          />
        </div>
      </div>
      <Table
        containerClassName="rounded-xl border"
        scrollLabel={TAB_CAPTIONS[tab]}
        scrollFocus="overflow"
      >
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
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
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={table.getVisibleLeafColumns().length}>
                <FilteredEmpty
                  title="No keywords match this search"
                  onClear={() => void setParams({ q: null })}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {visible.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
