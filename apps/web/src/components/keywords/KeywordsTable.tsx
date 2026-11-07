"use client";

import { useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  utcDayOf,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { useQueryState, useQueryStates } from "nuqs";
import { keywordCountriesOptions, keywordsOptions } from "@/lib/queries";
import { keywordFilterParsers, keywordViewParser } from "@/lib/search-params";
import { HIDDEN_KEYWORD_COLUMNS, keywordColumns } from "./keyword-columns";
import { exactSearchEmptyBody, keywordSearchFilter } from "./keyword-filters";
import { keywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import { tagsIn } from "@/lib/keyword-tags";
import { KeywordsBulkActions } from "./KeywordsBulkActions";
import { useShowDynamics } from "./KeywordDynamicsPanel";
import { KeywordsEmptyState } from "./KeywordsEmptyState";
import { KeywordsDataTable } from "./KeywordsDataTable";
import { KeywordsFilterBar } from "./KeywordsFilterBar";
import { ChartedKeywordsContext, ListingMarksContext } from "./keyword-cells";
import { SerpSheet } from "./serp/SerpSheet";
import {
  useClearedSelectionFocus,
  useEmptiedListFocus,
} from "./use-keywords-table-focus";
import { useSerpParams } from "./serp/use-serp-params";
import { useKeywordColumnFilters } from "./use-zone-thresholds";
import { useKeywordsTableControls } from "./use-keywords-table-controls";
import { KeywordMap } from "./map/KeywordMap";
import { filtersNarrowMap } from "./map/map-points";
import { useKeywordsAcrossZones } from "./map/use-map-keywords";

export function KeywordsTable({
  id,
  store,
  country,
  homeCountry,
  chartedIds,
}: {
  id: string;
  store: Store;
  country: string;
  homeCountry: string;
  chartedIds: readonly string[];
}) {
  const [{ serp: serpId }, setSerpState] = useSerpParams();
  const showDynamics = useShowDynamics();
  const [filters, setFilters] = useQueryStates(keywordFilterParsers);
  const [view] = useQueryState("view", keywordViewParser);
  const { data: keywords, dataUpdatedAt } = useSuspenseQuery(
    keywordsOptions(id, country),
  );
  const today = utcDayOf(dataUpdatedAt);
  const serpKeyword = keywords.find((row) => row.keywordId === serpId);
  const { data: markets } = useQuery(keywordCountriesOptions(id));
  const multiMarket = (markets?.length ?? 0) > 1;
  const [selection, setSelection] = useState<RowSelectionState>({});

  const rowSelection = useMemo(
    () => selectedKeywordsStillOnScreen(selection, keywords),
    [keywords, selection],
  );

  const columns = useMemo(
    () =>
      keywordColumns({
        appId: id,
        store,
        homeCountry,
        multiMarket,
        today,
        onOpenSerp: (keywordId) =>
          void setSerpState({ serp: keywordId, serpDate: null }),
      }),
    [id, store, homeCountry, multiMarket, setSerpState, today],
  );

  const { sorting, onSortingChange, visibility, setVisibility, marks } =
    useKeywordsTableControls({ store, columns });
  const columnFilters = useKeywordColumnFilters(filters);

  const table = useTable({
    features: keywordTableFeatures,
    data: keywords,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      globalFilter: filters.q,
      columnVisibility: { ...visibility, ...HIDDEN_KEYWORD_COLUMNS },
    },
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    onSortingChange,
    getRowId: (row) => row.keywordId,
    enableRowSelection: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: keywordSearchFilter,
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });

  const selectedKeywords = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const selectedIds = selectedKeywords.map((keyword) => keyword.keywordId);
  const chartedKey = chartedIds.join(",");
  const chartedSet = useMemo(
    () => new Set(chartedKey ? chartedKey.split(",") : []),
    [chartedKey],
  );

  const { tableArea, clearSelection } = useClearedSelectionFocus(
    selectedIds.length,
    () => setSelection({}),
  );
  const mapKeywords = useKeywordsAcrossZones(table, view === "map");
  const isEmpty = keywords.length === 0;
  const addKeywords = useEmptiedListFocus(isEmpty);

  if (isEmpty) {
    return (
      <KeywordsEmptyState
        appId={id}
        store={store}
        country={country}
        addRef={addKeywords}
      />
    );
  }

  return (
    <>
      <div ref={tableArea} className="flex flex-col gap-3">
        <KeywordsFilterBar
          appId={id}
          table={table}
          filters={filters}
          setFilters={setFilters}
          today={today}
          viewOptions={[marks]}
        />
        {view === "map" ? (
          <KeywordMap
            keywords={mapKeywords}
            narrowed={filtersNarrowMap(mapKeywords, keywords)}
            history={{ appId: id, store, homeCountry, multiMarket }}
            market={country}
            today={today}
            onClearFilters={() => void setFilters(null)}
          />
        ) : null}
        <ListingMarksContext value={marks.checked}>
          <ChartedKeywordsContext value={chartedSet}>
            <KeywordsDataTable
              table={table}
              chartedSet={chartedSet}
              emptyBody={exactSearchEmptyBody(filters.q)}
              onClearFilters={() => void setFilters(null)}
            />
          </ChartedKeywordsContext>
        </ListingMarksContext>

        {selectedIds.length > 0 ? (
          <div className="sticky bottom-4 z-30 flex justify-center">
            <KeywordsBulkActions
              appId={id}
              selectedKeywords={selectedKeywords}
              marketTags={tagsIn(keywords)}
              onClear={clearSelection}
              onExport={() => exportKeywords(id, selectedKeywords, today)}
              onShowDynamics={() => showDynamics(selectedIds)}
            />
          </div>
        ) : null}
      </div>
      <SerpSheet appId={id} store={store} keyword={serpKeyword} />
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
