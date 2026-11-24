"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  utcDayOf,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { useQueryState, useQueryStates } from "nuqs";
import {
  funnelOptions,
  keywordCountriesOptions,
  keywordsOptions,
} from "@/lib/queries";
import {
  countryParser,
  ideasSeedParser,
  keywordFilterParsers,
  keywordViewParser,
  trendWindowParser,
} from "@/lib/search-params";
import {
  TREND_WINDOWS,
  trendLabel,
  type TrendSeries,
  type TrendState,
} from "@/lib/trend-window";
import { FUNNEL_SERIES_DAYS, noSearchTermsFact } from "@/lib/funnel";
import { HIDDEN_KEYWORD_COLUMNS, keywordColumns } from "./keyword-columns";
import { exactSearchEmptyBody, keywordSearchFilter } from "./keyword-filters";
import { keywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import { tagsIn } from "@/lib/keyword-tags";
import { keywordFieldAction } from "./AddToKeywordField";
import { KeywordsBulkActions } from "./KeywordsBulkActions";
import { useShowDynamics } from "./KeywordDynamicsPanel";
import { KeywordsEmptyState } from "./KeywordsEmptyState";
import { KeywordsDataTable } from "./KeywordsDataTable";
import { KeywordsFilterBar } from "./KeywordsFilterBar";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import {
  ChartedKeywordsContext,
  KeywordSheetContext,
  ListingMarksContext,
} from "./keyword-cells";
import { KeywordSheet } from "./sheet/KeywordSheet";
import { keywordSteps, NO_STEPS } from "./sheet/keyword-steps";
import {
  useCloseWhenShownKeywordLeaves,
  useKeywordSheet,
} from "./sheet/use-keyword-sheet";
import { NoSearchTermsContext } from "./PlayInstallsTip";
import { SerpSheet } from "./serp/SerpSheet";
import { useClearedSelectionFocus } from "./use-keywords-table-focus";
import { useSerpParams } from "./serp/use-serp-params";
import { useKeywordColumnFilters } from "./use-zone-thresholds";
import { useKeywordsTableControls } from "./use-keywords-table-controls";
import { useTrendSeries } from "./use-trend-series";
import { KeywordMap } from "./map/KeywordMap";
import { filtersNarrowMap } from "./map/map-points";
import { useKeywordsAcrossZones } from "./map/use-map-keywords";

export function KeywordsTable({
  id,
  store,
  country,
  homeCountry,
  keywordFields,
  chartedIds,
  onFindKeywords,
}: {
  id: string;
  store: Store;
  country: string;
  homeCountry: string;
  keywordFields: boolean;
  chartedIds: readonly string[];
  onFindKeywords?: (leaving: HTMLElement) => void;
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
  const sheet = useKeywordSheet();
  const sheetKeyword = keywords.find(
    (row) => row.keywordId === sheet.keywordId,
  );
  useCloseWhenShownKeywordLeaves(
    sheet.keywordId,
    sheetKeyword !== undefined,
    sheet.close,
  );
  const { data: markets } = useQuery(keywordCountriesOptions(id));
  const multiMarket = (markets?.length ?? 0) > 1;
  const [selection, setSelection] = useState<RowSelectionState>({});
  const { data: funnel } = useQuery({
    ...funnelOptions(id, FUNNEL_SERIES_DAYS, undefined),
    enabled: store === "GOOGLE_PLAY",
  });
  const noSearchTerms = noSearchTermsFact(funnel?.noSearchTermsMonth);

  const rowSelection = useMemo(
    () => selectedKeywordsStillOnScreen(selection, keywords),
    [keywords, selection],
  );

  const [trendWindow, setTrendWindow] = useQueryState(
    "trend",
    trendWindowParser,
  );
  const openSerp = useCallback(
    (keywordId: string) =>
      void setSerpState({ serp: keywordId, serpDate: null }),
    [setSerpState],
  );
  const [, setIdeas] = useQueryStates({
    ideas: ideasSeedParser,
    country: countryParser,
  });
  const openIdeas = useCallback(
    (keyword: TrackedKeywordItem) =>
      void setIdeas(
        {
          ideas: keyword.text,
          ...(keyword.country === country ? {} : { country: keyword.country }),
        },
        { history: "push" },
      ),
    [setIdeas, country],
  );
  const buildColumns = useCallback(
    (series: TrendSeries | undefined, state: TrendState = "ready") =>
      keywordColumns({
        appId: id,
        store,
        homeCountry,
        multiMarket,
        today,
        trend: { window: trendWindow, series, state },
        onOpenSerp: openSerp,
        onOpenIdeas: openIdeas,
      }),
    [
      id,
      store,
      homeCountry,
      multiMarket,
      today,
      trendWindow,
      openSerp,
      openIdeas,
    ],
  );
  const shellColumns = useMemo(() => buildColumns(undefined), [buildColumns]);

  const { sorting, onSortingChange, visibility, setVisibility, marks } =
    useKeywordsTableControls({ store, columns: shellColumns });
  const {
    series,
    state,
    read: trendRead,
  } = useTrendSeries({
    appId: id,
    country,
    today,
    trendWindow,
    columnShown: keywords.length > 0 && visibility.delta7d !== false,
  });
  const columns = useMemo(
    () => buildColumns(series, state),
    [buildColumns, series, state],
  );
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

  if (isEmpty) {
    return (
      <KeywordsEmptyState country={country} onFindKeywords={onFindKeywords} />
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
          viewChoices={[
            {
              id: "trend",
              label: "Trend window",
              value: trendWindow,
              onValueChange: (value) =>
                void setTrendWindow(trendWindowParser.parse(value)),
              options: TREND_WINDOWS.map((value) => ({
                value,
                label: trendLabel(value),
              })),
            },
          ]}
        />
        {state === "failed" ? (
          <InlineQueryError
            message="Could not load the 30 day trend."
            read={trendRead}
          />
        ) : null}
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
        <NoSearchTermsContext value={noSearchTerms}>
          <ListingMarksContext value={marks.checked}>
            <ChartedKeywordsContext value={chartedSet}>
              <KeywordSheetContext value={sheet.open}>
                <KeywordsDataTable
                  table={table}
                  chartedSet={chartedSet}
                  emptyBody={exactSearchEmptyBody(filters.q)}
                  onClearFilters={() => void setFilters(null)}
                />
              </KeywordSheetContext>
            </ChartedKeywordsContext>
          </ListingMarksContext>
        </NoSearchTermsContext>

        {selectedIds.length > 0 ? (
          <div className="sticky bottom-4 z-30 flex justify-center">
            <KeywordsBulkActions
              appId={id}
              selectedKeywords={selectedKeywords}
              marketTags={tagsIn(keywords)}
              onClear={clearSelection}
              onExport={() => exportKeywords(id, selectedKeywords, today)}
              onShowDynamics={() => showDynamics(selectedIds)}
              fieldAction={keywordFieldAction({
                appId: id,
                market: country,
                homeCountry,
                keywordFields,
                table,
              })}
            />
          </div>
        ) : null}
      </div>
      <SerpSheet appId={id} store={store} keyword={serpKeyword} />
      <KeywordSheet
        appId={id}
        store={store}
        homeCountry={homeCountry}
        keyword={serpKeyword ? undefined : sheetKeyword}
        today={today}
        marketTags={() => tagsIn(keywords)}
        steps={
          sheetKeyword
            ? keywordSteps(
                table.getRowModel().rows.map((row) => row.id),
                sheetKeyword.keywordId,
              )
            : NO_STEPS
        }
        onStep={sheet.step}
        onClose={sheet.close}
        onOpenSerp={(keywordId) =>
          void setSerpState({ serp: keywordId, serpDate: null })
        }
      />
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
