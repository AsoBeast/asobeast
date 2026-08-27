"use client";

import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import { useQueryState } from "nuqs";
import { keywordsOptions } from "@/lib/queries";
import { serpParser, sortParser } from "@/lib/search-params";
import { keywordColumns } from "./keyword-columns";
import { keywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import { KeywordsBulkActions } from "./KeywordsBulkActions";
import { KeywordsEmptyState } from "./KeywordsEmptyState";
import { KeywordsDataTable } from "./KeywordsDataTable";
import { SerpSheet } from "./SerpSheet";

export function KeywordsTable({
  id,
  country,
}: {
  id: string;
  country: string;
}) {
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [, setSerp] = useQueryState("serp", serpParser);
  const { data: keywords } = useSuspenseQuery(
    keywordsOptions(id, sort, country),
  );
  const [selection, setSelection] = useState<RowSelectionState>({});

  const rowSelection = useMemo(
    () => selectedKeywordsStillOnScreen(selection, keywords),
    [keywords, selection],
  );

  const columns = useMemo(
    () =>
      keywordColumns({
        appId: id,
        sort,
        onSort: setSort,
        onOpenSerp: (keywordId) => void setSerp(keywordId),
      }),
    [id, sort, setSort, setSerp],
  );

  const table = useTable({
    features: keywordTableFeatures,
    data: keywords,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setSelection,
    getRowId: (row) => row.keywordId,
    enableRowSelection: true,
  });

  const selectedIds = Object.keys(rowSelection);
  const selectedKeywords = keywords.filter(
    (keyword) => rowSelection[keyword.keywordId],
  );

  if (keywords.length === 0) {
    return <KeywordsEmptyState appId={id} country={country} />;
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <KeywordsDataTable table={table} />

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
