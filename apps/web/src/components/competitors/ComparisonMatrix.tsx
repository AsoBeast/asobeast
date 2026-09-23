"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryState, useQueryStates } from "nuqs";
import {
  Card,
  CardContent,
  CardDescription,
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
import { comparisonOptions, competitorsOptions } from "@/lib/queries";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import {
  matrixFilterParsers,
  matrixSortParser,
  onlyGapsParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import {
  COMPARISON_SORT_DEFAULTS,
  comparisonColumns,
  HIDDEN_COMPARISON_COLUMNS,
} from "./comparison-columns";
import { ComparisonFilterBar } from "./ComparisonFilterBar";
import { comparisonTableFeatures } from "./comparison-table-features";

const HEAD_CLASS: Record<string, string> = {
  keyword: "sticky left-0 z-20 bg-inherit",
  you: "border-x bg-secondary text-center",
};

const CELL_CLASS: Record<string, string> = {
  keyword: "sticky left-0 z-10 bg-inherit",
  you: "border-x bg-secondary/40 text-center",
};

export function ComparisonMatrix({ id }: { id: string }) {
  const [onlyGaps, setOnlyGaps] = useQueryState("onlyGaps", onlyGapsParser);
  const { data } = useSuspenseQuery(comparisonOptions(id, onlyGaps));
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  const [sortParams, setSortParams] = useQueryStates({
    sort: matrixSortParser,
    dir: sortDirectionParser,
  });
  const [filters, setFilters] = useQueryStates(matrixFilterParsers);

  const columns = useMemo(() => {
    const icons = new Map(competitors.map((item) => [item.id, item.iconUrl]));
    return comparisonColumns(
      data.competitors.map((competitor) => ({
        ...competitor,
        iconUrl: icons.get(competitor.id) ?? null,
      })),
    );
  }, [competitors, data.competitors]);

  const knownSort = columns.some((column) => column.id === sortParams.sort);
  const { sorting, onSortingChange } = useUrlSorting(
    { sort: knownSort ? sortParams.sort : null, dir: sortParams.dir },
    COMPARISON_SORT_DEFAULTS,
    (next) => void setSortParams(next),
  );

  const table = useTable({
    features: comparisonTableFeatures,
    data: data.rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: {
      sorting,
      globalFilter: filters.q,
      columnFilters:
        filters.vs === "all" ? [] : [{ id: "versus", value: filters.vs }],
      columnVisibility: HIDDEN_COMPARISON_COLUMNS,
    },
    onSortingChange,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });
  const rows = table.getRowModel().rows;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Comparison matrix</CardDescription>
        <CardTitle>Your position against every competitor</CardTitle>
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id="only-gaps"
            checked={onlyGaps}
            onCheckedChange={(next) => setOnlyGaps(next ? true : null)}
          />
          <Label htmlFor="only-gaps" className="text-sm text-muted-foreground">
            only gaps
          </Label>
        </div>
      </CardHeader>
      <CardContent>
        {data.competitors.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add a competitor above to discover keyword gaps — phrases they rank
            for and you do not. One search serves every app, so this costs no
            extra scraping.
          </div>
        ) : data.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {onlyGaps
              ? "No gaps — you rank everywhere your competitors do."
              : "No comparison data yet. Track keywords and run a daily check to populate positions."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ComparisonFilterBar
              filters={filters}
              setFilters={setFilters}
              shown={rows.length}
              total={data.rows.length}
            />
            <Table containerClassName="rounded-xl border">
              <TableCaption className="sr-only">
                Your keyword positions compared with each tracked competitor.
                Gap rows are keywords a competitor ranks for and you do not.
              </TableCaption>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-card">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        aria-sort={ariaSort(header.column.getIsSorted())}
                        className={
                          HEAD_CLASS[header.column.id] ?? "text-center"
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
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={table.getVisibleLeafColumns().length}>
                      <FilteredEmpty
                        title="No keywords match these filters"
                        onClear={() => void setFilters(null)}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.original.gap ? "bg-warning-subtle" : "bg-card",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={CELL_CLASS[cell.column.id] ?? "text-center"}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
