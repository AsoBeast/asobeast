"use client";

import { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryState, useQueryStates } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { appDetailOptions, discoveryOptions } from "@/lib/queries";
import { storeLabel } from "@/lib/format";
import { DISCOVERY_WINDOWS, rangeLabel } from "@/lib/ranges";
import {
  discoveryDaysParser,
  searchParser,
  discoverySortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { numericProps } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/use-app-locale";
import { COMPETITOR_SECTION } from "./competitor-sections";
import { discoveryColumns } from "./discovery-columns";
import {
  PHONE_HIDES_IDLE_SORT,
  SECTION_BODY,
  SECTION_EMPTY,
  SECTION_FOOTER,
  SECTION_SHEET,
  SECTION_TOOLBAR,
} from "./section-layout";
import { DiscoveryPanelSkeleton } from "./skeletons";

const DISCOVERY_PARAMS = {
  sort: discoverySortParser,
  dir: sortDirectionParser,
  q: searchParser,
};

const DISCOVERY_URL_KEYS = { sort: "appSort", dir: "appDir", q: "appQ" };

function DiscoveryTable({
  id,
  days,
  storeName,
}: {
  id: string;
  days: number;
  storeName: string;
}) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(discoveryOptions(id, days));
  const [params, setParams] = useQueryStates(DISCOVERY_PARAMS, {
    urlKeys: DISCOVERY_URL_KEYS,
  });
  const columns = useMemo(
    () => discoveryColumns(id, { t, locale }),
    [id, t, locale],
  );
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "discovery",
    columns,
  );
  const { sorting, onSortingChange } = useUrlSorting(
    params,
    columns,
    (next) =>
      void setParams({
        sort: next.sort === null ? null : discoverySortParser.parse(next.sort),
        dir: next.dir,
      }),
  );

  const table = useTable({
    features: dataTableFeatures,
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
        className={SECTION_EMPTY}
        title={t("discovery.emptyTitle", { days })}
        body={t("discovery.emptyBody")}
      />
    );
  }

  return (
    <div className={SECTION_BODY}>
      <div className={SECTION_TOOLBAR}>
        <SearchInput
          label={t("discovery.search")}
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <RowCount shown={rows.length} total={data.items.length} noun="app" />
        <div className="ml-auto">
          <ColumnMenu columns={table.getAllLeafColumns()} />
        </div>
      </div>
      <div className={cn(SECTION_SHEET, PHONE_HIDES_IDLE_SORT)}>
        <Table>
          <TableCaption className="sr-only">
            {t("discovery.caption", { store: storeName, days })}
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(header.column.getIsSorted())}
                    className={cn(header.column.id === "track" && "w-0")}
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                  <FilteredEmpty
                    title={t("discovery.noMatches")}
                    onClear={() => void setParams({ q: null })}
                  />
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
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
        <p className={SECTION_FOOTER}>
          <span>
            <span>{t("discovery.results", { store: storeName, days })}</span>
          </span>
        </p>
      </div>
    </div>
  );
}

export function DiscoveryPanel({ id }: { id: string }) {
  const t = useTranslations("competitors");
  const format = useTranslations("format");
  const [days, setDays] = useQueryState("days", discoveryDaysParser);
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const storeName = storeLabel(detail.store);

  return (
    <CollapsibleCard
      section={COMPETITOR_SECTION.discovery}
      title={t("discovery.title")}
      actions={
        <>
          <Tabs
            value={String(days)}
            onValueChange={(next) => void setDays(Number(next) as typeof days)}
          >
            <TabsList aria-label={t("discovery.window")}>
              {DISCOVERY_WINDOWS.map((window) => (
                <TabsOption key={window} value={String(window)}>
                  {rangeLabel(`${window}d`, format)}
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>
        </>
      }
    >
      <Suspense fallback={<DiscoveryPanelSkeleton />}>
        <DiscoveryTable id={id} days={days} storeName={storeName} />
      </Suspense>
    </CollapsibleCard>
  );
}
