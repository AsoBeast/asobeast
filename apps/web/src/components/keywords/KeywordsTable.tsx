"use client";

import { useCallback, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Store, TrackedKeywordItem } from "@asobeast/shared";
import {
  functionalUpdate,
  useTable,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { useQueryState, useQueryStates } from "nuqs";
import { keywordsOptions } from "@/lib/queries";
import {
  keywordFilterParsers,
  keywordSortParser,
  serpParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { sortingFromUrl, urlFromSorting } from "@/lib/table/sorting";
import {
  HIDDEN_KEYWORD_COLUMNS,
  KEYWORD_SORT_DEFAULTS,
  keywordColumns,
} from "./keyword-columns";
import { keywordColumnFilters } from "./keyword-filters";
import { keywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import { KeywordsBulkActions } from "./KeywordsBulkActions";
import { KeywordsEmptyState } from "./KeywordsEmptyState";
import { KeywordsDataTable } from "./KeywordsDataTable";
import { KeywordsFilterBar } from "./KeywordsFilterBar";
import { SerpSheet } from "./SerpSheet";

export function KeywordsTable({
  id,
  store,
  country,
}: {
  id: string;
  store: Store;
  country: string;
}) {
  const [{ sort, dir }, setSortParams] = useQueryStates({
    sort: keywordSortParser,
    dir: sortDirectionParser,
  });
  const [, setSerp] = useQueryState("serp", serpParser);
  const [filters, setFilters] = useQueryStates(keywordFilterParsers);
  const { data: keywords } = useSuspenseQuery(
    keywordsOptions(id, undefined, country),
  );
  const [selection, setSelection] = useState<RowSelectionState>({});

  const rowSelection = useMemo(
    () => selectedKeywordsStillOnScreen(selection, keywords),
    [keywords, selection],
  );

  const sorting = useMemo(
    () => sortingFromUrl(sort, dir, KEYWORD_SORT_DEFAULTS),
    [sort, dir],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = urlFromSorting(
        functionalUpdate(updater, sorting),
        KEYWORD_SORT_DEFAULTS,
      );
      void setSortParams({
        sort: next.sort === null ? null : keywordSortParser.parse(next.sort),
        dir: next.dir,
      });
    },
    [setSortParams, sorting],
  );

  const columnFilters = useMemo(() => keywordColumnFilters(filters), [filters]);

  const columns = useMemo(
    () =>
      keywordColumns({
        appId: id,
        onOpenSerp: (keywordId) => void setSerp(keywordId),
      }),
    [id, setSerp],
  );

  const table = useTable({
    features: keywordTableFeatures,
    data: keywords,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      globalFilter: filters.q,
      columnVisibility: HIDDEN_KEYWORD_COLUMNS,
    },
    onRowSelectionChange: setSelection,
    onSortingChange,
    getRowId: (row) => row.keywordId,
    enableRowSelection: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });

  const selectedIds = Object.keys(rowSelection);
  const selectedKeywords = keywords.filter(
    (keyword) => rowSelection[keyword.keywordId],
  );

  if (keywords.length === 0) {
    return <KeywordsEmptyState appId={id} store={store} country={country} />;
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <KeywordsFilterBar
          appId={id}
          table={table}
          filters={filters}
          setFilters={setFilters}
        />
        <KeywordsDataTable
          table={table}
          onClearFilters={() => void setFilters(null)}
        />

        {selectedIds.length > 0 ? (
          <div className="sticky bottom-4 z-30 flex justify-center">
            <KeywordsBulkActions
              appId={id}
              selectedIds={selectedIds}
              onClear={() => setSelection({})}
              onExport={() => exportKeywords(id, selectedKeywords)}
            />
          </div>
        ) : null}
      </div>
      <SerpSheet appId={id} />
    </>
  );
}

function selectedKeywordsStillOnScreen(
  selection: RowSelectionState,
  keywords: readonly TrackedKeywordItem[],
): RowSelectionState {
  const onScreen = new Set(keywords.map((keyword) => keyword.keywordId));
  const kept = Object.entries(selection).filter(
    ([keywordId, selected]) => selected && onScreen.has(keywordId),
  );
  return kept.length === Object.keys(selection).length
    ? selection
    : Object.fromEntries(kept);
}
