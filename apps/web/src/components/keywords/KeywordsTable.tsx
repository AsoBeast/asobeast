"use client";

import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";
import { keywordsOptions } from "@/lib/queries";
import { serpParser, sortParser } from "@/lib/search-params";
import { keywordColumns } from "./keyword-columns";
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

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

  const table = useReactTable({
    data: keywords,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.keywordId,
    manualSorting: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    const ids = new Set(keywords.map((keyword) => keyword.keywordId));
    setRowSelection((prev) => {
      let changed = false;
      const next: RowSelectionState = {};
      for (const key of Object.keys(prev)) {
        if (ids.has(key)) {
          next[key] = prev[key];
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [keywords]);

  const selectedIds = Object.keys(rowSelection).filter(
    (key) => rowSelection[key],
  );
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
              onClear={() => setRowSelection({})}
              onExport={() => exportKeywords(id, selectedKeywords)}
            />
          </div>
        ) : null}
      </div>
      <SerpSheet appId={id} />
    </>
  );
}
