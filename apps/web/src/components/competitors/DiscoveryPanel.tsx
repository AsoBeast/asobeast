"use client";

import { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryState, useQueryStates } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { appDetailOptions, discoveryOptions } from "@/lib/queries";
import { storeLabel } from "@/lib/format";
import { DISCOVERY_WINDOWS } from "@/lib/ranges";
import {
  discoveryDaysParser,
  discoverySearchParser,
  discoverySortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { phoneColumnVisibility } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { useIsMobile } from "@/lib/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  DISCOVERY_SORT_DEFAULTS,
  discoveryColumns,
  discoveryTableFeatures,
} from "./discovery-columns";
import { DiscoveryPanelSkeleton } from "./skeletons";

const DISCOVERY_PARAMS = {
  sort: discoverySortParser,
  dir: sortDirectionParser,
  q: discoverySearchParser,
};

const DISCOVERY_URL_KEYS = { sort: "appSort", dir: "appDir", q: "appQ" };

const NO_HIDDEN_COLUMNS = {};

function DiscoveryTable({
  id,
  days,
  storeName,
}: {
  id: string;
  days: number;
  storeName: string;
}) {
  const { data } = useSuspenseQuery(discoveryOptions(id, days));
  const [params, setParams] = useQueryStates(DISCOVERY_PARAMS, {
    urlKeys: DISCOVERY_URL_KEYS,
  });
  const columns = useMemo(() => discoveryColumns(id), [id]);
  const isMobile = useIsMobile();
  const defaultVisibility = useMemo(
    () => (isMobile ? phoneColumnVisibility(columns) : NO_HIDDEN_COLUMNS),
    [isMobile, columns],
  );
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "discovery",
    defaultVisibility,
  );
  const { sorting, onSortingChange } = useUrlSorting(
    params,
    DISCOVERY_SORT_DEFAULTS,
    (next) =>
      void setParams({
        sort: next.sort === null ? null : discoverySortParser.parse(next.sort),
        dir: next.dir,
      }),
  );

  const table = useTable({
    features: discoveryTableFeatures,
    data: data.items,
    columns,
    getRowId: (row) => row.storeAppId,
    state: {
      sorting,
      globalFilter: params.q,
      columnVisibility: visibility,
    },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "app",
  });
  const rows = table.getRowModel().rows;

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={`Nothing discovered in the last ${days} days`}
        body="As daily checks accumulate, apps that keep appearing in your keyword results but you do not track surface here. Widen the window to look further back."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search apps"
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <RowCount shown={rows.length} total={data.items.length} noun="app" />
        <div className="ml-auto">
          <ColumnMenu columns={table.getAllLeafColumns()} />
        </div>
      </div>
      <Table containerClassName="rounded-xl border">
        <TableCaption className="sr-only">
          Untracked {storeName} apps appearing in your keyword search results
          over the last {days} days.
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(header.column.getIsSorted())}
                  className={cn(header.column.id === "track" && "w-0")}
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
                  title="No apps match this search"
                  onClear={() => void setParams({ q: null })}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
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

export function DiscoveryPanel({ id }: { id: string }) {
  const [days, setDays] = useQueryState("days", discoveryDaysParser);
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const storeName = storeLabel(detail.store);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Discovery</CardDescription>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Apps you don’t track yet</CardTitle>
            <Badge variant="secondary">{storeName}</Badge>
          </div>
        </div>
        <Tabs
          value={String(days)}
          onValueChange={(next) => void setDays(Number(next) as typeof days)}
        >
          <TabsList>
            {DISCOVERY_WINDOWS.map((window) => (
              <TabsTrigger key={window} value={String(window)}>
                {window}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<DiscoveryPanelSkeleton />}>
          <DiscoveryTable id={id} days={days} storeName={storeName} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
