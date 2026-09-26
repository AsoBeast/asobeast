"use client";

import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import type { Store } from "@asobeast/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import {
  buildCombinations,
  COMBINATION_LIMIT,
} from "@/lib/keyword-combinations";
import {
  appDetailOptions,
  keywordFieldOptions,
  keywordsOptions,
} from "@/lib/queries";
import {
  COMBINATION_COLUMNS,
  HIDDEN_COMBINATION_COLUMNS,
} from "./combination-columns";
import {
  CombinationFilters,
  type CombinationParams,
  type SetCombinationParams,
} from "./CombinationFilters";
import { CombinationRows } from "./CombinationRows";
import { keywordTableFeatures } from "./keyword-table-features";
import { TrackCombinations } from "./TrackCombinations";

interface CombinationsProps {
  id: string;
  store: Store;
  homeCountry: string;
  params: CombinationParams;
  setParams: SetCombinationParams;
}

const NO_KEYWORD_FIELD: readonly string[] = [];

export function CombinationsTable(props: CombinationsProps) {
  return props.store === "APP_STORE" ? (
    <AppStoreCombinations {...props} />
  ) : (
    <ListingCombinations {...props} keywordField={NO_KEYWORD_FIELD} />
  );
}

function AppStoreCombinations(props: CombinationsProps) {
  const { data } = useSuspenseQuery(keywordFieldOptions(props.id));
  const keywordField = useMemo(
    () => data.tracked.map((keyword) => keyword.text),
    [data],
  );
  return <ListingCombinations {...props} keywordField={keywordField} />;
}

function ListingCombinations({
  id,
  store,
  homeCountry,
  params,
  setParams,
  keywordField,
}: CombinationsProps & { keywordField: readonly string[] }) {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id, homeCountry));
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const snapshot = app.latestSnapshot;
  const result = useMemo(
    () =>
      buildCombinations({
        listing: { store, snapshot, keywordField },
        tracked,
        market: homeCountry,
      }),
    [store, snapshot, keywordField, tracked, homeCountry],
  );
  const columnFilters = useMemo(
    () =>
      [
        { id: "words", value: params.words },
        { id: "status", value: params.status },
      ].filter((filter) => filter.value.length > 0),
    [params.words, params.status],
  );
  const table = useTable({
    features: keywordTableFeatures,
    data: result.combinations,
    columns: COMBINATION_COLUMNS,
    getRowId: (row) => row.key,
    state: {
      globalFilter: params.q,
      columnFilters,
      columnVisibility: HIDDEN_COMBINATION_COLUMNS,
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: (row) => row.original.status !== "tracked",
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "phrase",
  });
  const clearFilters = () =>
    void setParams({ q: null, words: null, status: null });

  if (result.words.length === 0) {
    return (
      <EmptyState
        title="No listing words to combine yet"
        body="Combinations appear once asobeast has captured a listing with words in the fields this store indexes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {result.truncated ? (
        <p role="note" className="text-caption text-muted-foreground">
          Your listing forms {formatNumber(result.total)} combinations. The
          first {formatNumber(COMBINATION_LIMIT)}, shortest first, are listed.
        </p>
      ) : null}
      <CombinationFilters
        table={table}
        params={params}
        setParams={setParams}
        actions={
          <TrackCombinations table={table} id={id} homeCountry={homeCountry} />
        }
      />
      <CombinationRows
        key={JSON.stringify([params.q, params.words, params.status])}
        table={table}
        onClearFilters={clearFilters}
      />
    </div>
  );
}
