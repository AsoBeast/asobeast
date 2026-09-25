"use client";

import type { Row, Table } from "@tanstack/react-table";
import type { inferParserType, SetValues } from "nuqs";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import {
  COMBINATION_STATUSES,
  type KeywordCombination,
} from "@/lib/keyword-combinations";
import {
  COMBINATION_WORD_FILTERS,
  type combinationParsers,
} from "@/lib/search-params";
import { countBy } from "@/lib/table/facets";
import {
  COMBINATION_STATUS_LABELS,
  wordCountLabel,
} from "./combination-columns";
import type { KeywordTableFeatures } from "./keyword-table-features";

export type CombinationParams = inferParserType<typeof combinationParsers>;
export type SetCombinationParams = SetValues<typeof combinationParsers>;
export type CombinationTable = Table<KeywordTableFeatures, KeywordCombination>;

const WORD_OPTIONS = COMBINATION_WORD_FILTERS.map((value) => ({
  value,
  label: wordCountLabel(Number(value)),
}));

const STATUS_OPTIONS = COMBINATION_STATUSES.map((value) => ({
  value,
  label: COMBINATION_STATUS_LABELS[value],
}));

function facetCounts<K>(
  table: CombinationTable,
  id: string,
  key: (row: Row<KeywordTableFeatures, KeywordCombination>) => K,
): Map<K, number> {
  return countBy(table.getColumn(id)?.getFacetedRowModel().rows ?? [], key);
}

export function CombinationFilters({
  table,
  params,
  setParams,
}: {
  table: CombinationTable;
  params: CombinationParams;
  setParams: SetCombinationParams;
}) {
  const statuses = params.status.map(
    (value) => COMBINATION_STATUS_LABELS[value],
  );
  const chips = [
    params.q
      ? {
          key: "q",
          label: `Search: ${params.q}`,
          onRemove: () => void setParams({ q: null }),
        }
      : null,
    params.words.length > 0
      ? {
          key: "words",
          label: `Words: ${params.words.join(", ")}`,
          onRemove: () => void setParams({ words: null }),
        }
      : null,
    statuses.length > 0
      ? {
          key: "status",
          label: `Status: ${statuses.join(", ")}`,
          onRemove: () => void setParams({ status: null }),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search combinations"
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <FacetFilter
          title="Words"
          options={WORD_OPTIONS}
          selected={params.words}
          counts={facetCounts(table, "words", (row) =>
            String(row.original.wordCount),
          )}
          onChange={(words) => void setParams({ words })}
        />
        <FacetFilter
          title="Status"
          options={STATUS_OPTIONS}
          selected={params.status}
          counts={facetCounts(table, "status", (row) => row.original.status)}
          onChange={(status) => void setParams({ status })}
        />
        <RowCount
          shown={table.getRowModel().rows.length}
          total={table.getPreFilteredRowModel().rows.length}
          noun="combination"
        />
      </div>
      <FilterChips
        chips={chips}
        onClearAll={() =>
          void setParams({ q: null, words: null, status: null })
        }
      />
    </div>
  );
}
