"use client";

import { useId, useMemo, type ComponentProps } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import type { KeywordCoverageRow } from "@asobeast/shared";
import { FilterChips } from "@/components/data-table/FilterChips";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import {
  PANEL_BLEED,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatNumber } from "@/lib/format";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import {
  coverageFilterParsers,
  coverageSortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import { coverageColumns, HIDDEN_COVERAGE_COLUMNS } from "./coverage-columns";
import {
  COVERAGE_SECTION_ID,
  presentFields,
  uncoveredRows,
} from "./coverage-summary";
import { screenshotTextMark } from "./screenshot-text-marks";

const COVERAGE_PARAMS = {
  ...coverageFilterParsers,
  sort: coverageSortParser,
  dir: sortDirectionParser,
};

function ScreenshotTextNote({ rows }: { rows: KeywordCoverageRow[] }) {
  const withUnreadListing = rows.some(
    (row) => screenshotTextMark(row) === "unread",
  );
  return (
    <span>
      {`Screenshot text is a weak signal that Apple has not confirmed. It never changes whether a keyword counts as covered.${
        withUnreadListing
          ? " A dashed circle means the screenshots of that keyword's listing have not been read yet."
          : ""
      }`}
    </span>
  );
}

function CoverageToolbar({
  q,
  uncovered,
  shown,
  total,
  onSearch,
  onUncovered,
  onClear,
}: {
  q: string;
  uncovered: boolean;
  shown: number;
  total: number;
  onSearch: ComponentProps<typeof SearchInput>["onSearch"];
  onUncovered: (next: boolean) => void;
  onClear: () => void;
}) {
  const chips = [
    q
      ? {
          key: "q",
          label: `Search: ${q}`,
          onRemove: () => onSearch("", {}),
        }
      : null,
    uncovered
      ? {
          key: "uncovered",
          label: "Uncovered only",
          onRemove: () => onUncovered(false),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput label="Search keywords" value={q} onSearch={onSearch} />
        <div className="flex items-center gap-2">
          <Switch
            id="uncovered-only"
            checked={uncovered}
            onCheckedChange={onUncovered}
          />
          <Label htmlFor="uncovered-only">Uncovered only</Label>
        </div>
        <RowCount shown={shown} total={total} noun="keyword" />
      </div>
      <FilterChips chips={chips} onClearAll={onClear} />
    </div>
  );
}

function columnClass(id: string, sortable: boolean): string | undefined {
  if (id === "bucket") return "max-sm:hidden";
  return sortable ? undefined : "text-center";
}

export function CoverageTable({
  rows,
  withScreenshotText,
}: {
  rows: KeywordCoverageRow[];
  withScreenshotText: boolean;
}) {
  const headingId = useId();
  const [params, setParams] = useQueryStates(COVERAGE_PARAMS);
  const fields = useMemo(() => presentFields(rows), [rows]);
  const columns = useMemo(
    () => coverageColumns(fields, withScreenshotText),
    [fields, withScreenshotText],
  );
  const { sorting, onSortingChange } = useUrlSorting(
    params,
    columns,
    (next) =>
      void setParams({
        sort: next.sort === null ? null : coverageSortParser.parse(next.sort),
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
  return (
    <section
      id={COVERAGE_SECTION_ID}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-20 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Keyword coverage</h2>
          </CardTitle>
          <CardAction className={PANEL_COUNT}>
            <span className="numeric">
              {`${formatNumber(rows.length - uncoveredRows(rows).length)} of ${formatNumber(rows.length)} covered`}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className={cn(PANEL_BLEED, "flex flex-col")}>
          <CoverageToolbar
            q={params.q}
            uncovered={params.uncovered}
            shown={shown.length}
            total={rows.length}
            onSearch={(q, options) => void setParams({ q }, options)}
            onUncovered={(next) =>
              void setParams({ uncovered: next ? true : null })
            }
            onClear={clearFilters}
          />
          <Table>
            <TableCaption className="sr-only">
              {`Keyword coverage across ${fields.map((field) => METADATA_FIELD_LABELS[field]).join(", ")}${withScreenshotText ? ", screenshot text" : ""}, with uncovered keywords marked.`}
            </TableCaption>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      aria-sort={ariaSort(header.column.getIsSorted())}
                      className={columnClass(
                        header.column.id,
                        header.column.getCanSort(),
                      )}
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={columnClass(
                        cell.column.id,
                        cell.column.getCanSort(),
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {withScreenshotText ? (
          <CardFooter>
            <ScreenshotTextNote rows={rows} />
          </CardFooter>
        ) : null}
      </Card>
    </section>
  );
}
