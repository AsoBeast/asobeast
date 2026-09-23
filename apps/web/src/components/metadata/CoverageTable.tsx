"use client";

import { useMemo } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import type { KeywordCoverageRow } from "@asobeast/shared";
import { FilterChips } from "@/components/data-table/FilterChips";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import {
  coverageFilterParsers,
  coverageSortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { ariaSort } from "@/lib/table/sorting";
import {
  COVERAGE_SORT_DEFAULTS,
  coverageColumns,
  coverageTableFeatures,
  FIELD_ORDER,
  HIDDEN_COVERAGE_COLUMNS,
} from "./coverage-columns";

const COVERAGE_PARAMS = {
  ...coverageFilterParsers,
  sort: coverageSortParser,
  dir: sortDirectionParser,
};

export function CoverageTable({ rows }: { rows: KeywordCoverageRow[] }) {
  const [params, setParams] = useQueryStates(COVERAGE_PARAMS);
  const fields = useMemo(() => {
    const present = new Set(
      rows.flatMap((row) => row.fields.map((field) => field.field)),
    );
    return FIELD_ORDER.filter((field) => present.has(field));
  }, [rows]);
  const columns = useMemo(() => coverageColumns(fields), [fields]);
  const { sorting, onSortingChange } = useUrlSorting(
    params,
    COVERAGE_SORT_DEFAULTS,
    (next) =>
      void setParams({
        sort: next.sort === null ? null : coverageSortParser.parse(next.sort),
        dir: next.dir,
      }),
  );

  const table = useTable({
    features: coverageTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: {
      sorting,
      globalFilter: params.q,
      columnFilters: params.uncovered ? [{ id: "uncovered", value: true }] : [],
      columnVisibility: HIDDEN_COVERAGE_COLUMNS,
    },
    onSortingChange,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });
  const shown = table.getRowModel().rows;
  const clearFilters = () => void setParams({ q: null, uncovered: null });
  const chips = [
    params.q
      ? {
          key: "q",
          label: `Search: ${params.q}`,
          onRemove: () => void setParams({ q: null }),
        }
      : null,
    params.uncovered
      ? {
          key: "uncovered",
          label: "Uncovered only",
          onRemove: () => void setParams({ uncovered: null }),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search keywords"
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <div className="flex items-center gap-2">
          <Switch
            id="uncovered-only"
            checked={params.uncovered}
            onCheckedChange={(next) =>
              void setParams({ uncovered: next ? true : null })
            }
          />
          <Label htmlFor="uncovered-only" className="text-sm">
            Uncovered only
          </Label>
        </div>
        <RowCount shown={shown.length} total={rows.length} noun="keyword" />
      </div>
      <FilterChips chips={chips} onClearAll={clearFilters} />
      <Table containerClassName="rounded-xl border bg-card">
        <TableCaption className="sr-only">
          Keyword coverage across{" "}
          {fields.map((field) => METADATA_FIELD_LABELS[field]).join(", ")}, with
          uncovered keywords highlighted.
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(header.column.getIsSorted())}
                  className={
                    header.column.getCanSort() ? undefined : "text-center"
                  }
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
          {shown.length === 0 ? (
            <TableRow>
              <TableCell colSpan={table.getVisibleLeafColumns().length}>
                <FilteredEmpty
                  title="No keywords match these filters"
                  onClear={clearFilters}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {shown.map((row) => (
            <TableRow
              key={row.id}
              className={
                row.original.uncovered ? "bg-warning-subtle" : undefined
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={
                    cell.column.getCanSort() ? undefined : "text-center"
                  }
                >
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
