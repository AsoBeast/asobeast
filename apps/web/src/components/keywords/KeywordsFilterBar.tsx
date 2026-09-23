"use client";

import { Download } from "lucide-react";
import type { Options } from "nuqs";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { Button } from "@/components/ui/button";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";

export function KeywordsFilterBar({
  appId,
  table,
  search,
  onSearch,
}: {
  appId: string;
  table: Table<KeywordTableFeatures, TrackedKeywordItem>;
  search: string;
  onSearch: (value: string, options: Options) => void;
}) {
  const shown = table.getRowModel().rows;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput label="Search keywords" value={search} onSearch={onSearch} />
      <RowCount
        shown={shown.length}
        total={table.getPreFilteredRowModel().rows.length}
        noun="keyword"
      />
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={shown.length === 0}
        onClick={() =>
          exportKeywords(
            appId,
            shown.map((row) => row.original),
          )
        }
        aria-label="Export keywords to CSV"
      >
        <Download />
        Export CSV
      </Button>
    </div>
  );
}
