"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import { useAppLocale } from "@/lib/use-app-locale";
import { combinationStatusLabel, wordCountLabel } from "./combination-columns";
import type { KeywordTableFeatures } from "./keyword-table-features";

export type CombinationParams = inferParserType<typeof combinationParsers>;
export type SetCombinationParams = SetValues<typeof combinationParsers>;
export type CombinationTable = Table<KeywordTableFeatures, KeywordCombination>;

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
  actions,
}: {
  table: CombinationTable;
  params: CombinationParams;
  setParams: SetCombinationParams;
  actions: ReactNode;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const wordOptions = COMBINATION_WORD_FILTERS.map((value) => ({
    value,
    label: wordCountLabel(Number(value), t),
  }));
  const statusOptions = COMBINATION_STATUSES.map((value) => ({
    value,
    label: combinationStatusLabel(value, t),
  }));
  const statuses = params.status.map((value) =>
    combinationStatusLabel(value, t),
  );
  const chips = [
    params.q
      ? {
          key: "q",
          label: t("combinations.searchChip", { query: params.q }),
          onRemove: () => void setParams({ q: null }),
        }
      : null,
    params.words.length > 0
      ? {
          key: "words",
          label: t("combinations.wordsChip", {
            words: params.words.join(locale === "en" ? ", " : "、"),
          }),
          onRemove: () => void setParams({ words: null }),
        }
      : null,
    statuses.length > 0
      ? {
          key: "status",
          label: t("combinations.statusChip", {
            statuses: statuses.join(locale === "en" ? ", " : "、"),
          }),
          onRemove: () => void setParams({ status: null }),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label={t("combinations.search")}
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <FacetFilter
          title={t("combinations.words")}
          options={wordOptions}
          selected={params.words}
          counts={facetCounts(table, "words", (row) =>
            String(row.original.wordCount),
          )}
          onChange={(words) => void setParams({ words })}
        />
        <FacetFilter
          title={t("combinations.statusTitle")}
          options={statusOptions}
          selected={params.status}
          counts={facetCounts(table, "status", (row) => row.original.status)}
          onChange={(status) => void setParams({ status })}
        />
        <RowCount
          shown={table.getRowModel().rows.length}
          total={table.getPreFilteredRowModel().rows.length}
          noun="combination"
        />
        {actions}
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
