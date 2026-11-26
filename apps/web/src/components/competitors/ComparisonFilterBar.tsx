"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import type { inferParserType, SetValues } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { VERSUS_FILTERS, type matrixFilterParsers } from "@/lib/search-params";
import { ALL_MARKETS, marketOptions } from "./comparison-markets";

type MatrixFilters = inferParserType<typeof matrixFilterParsers>;

export function ComparisonFilterBar({
  filters,
  setFilters,
  markets,
  shown,
  total,
  columns,
  onExport,
}: {
  filters: MatrixFilters;
  setFilters: SetValues<typeof matrixFilterParsers>;
  markets: readonly string[];
  shown: number;
  total: number;
  columns: ComponentProps<typeof ColumnMenu>["columns"];
  onExport: () => void;
}) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const resultLabels: Record<MatrixFilters["vs"], string> = {
    all: t("comparison.results.all"),
    winning: t("comparison.results.winning"),
    losing: t("comparison.results.losing"),
    tied: t("comparison.results.tied"),
  };
  const resultOptions = VERSUS_FILTERS.map((value) => ({
    value,
    label: resultLabels[value],
  }));
  const multiMarket = markets.length > 1;
  const chips = [
    filters.q
      ? {
          key: "q",
          label: t("comparison.searchChip", { value: filters.q }),
          onRemove: () => void setFilters({ q: null }),
        }
      : null,
    filters.vs !== "all"
      ? {
          key: "vs",
          label: t("comparison.resultChip", {
            value: resultLabels[filters.vs],
          }),
          onRemove: () => void setFilters({ vs: null }),
        }
      : null,
    multiMarket && filters.country
      ? {
          key: "country",
          label: t("comparison.marketChip", {
            value: formatCountryInLocale(filters.country, locale),
          }),
          onRemove: () => void setFilters({ country: null }),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label={t("comparison.search")}
          value={filters.q}
          onSearch={(q, options) => void setFilters({ q }, options)}
        />
        <SelectFilter
          title={t("comparison.result")}
          value={filters.vs}
          options={resultOptions}
          onChange={(vs) => void setFilters({ vs })}
        />
        {multiMarket ? (
          <SelectFilter
            title={t("comparison.market")}
            value={filters.country || ALL_MARKETS}
            options={marketOptions(markets, t, locale)}
            onChange={(country) =>
              void setFilters({
                country: country === ALL_MARKETS ? null : country,
              })
            }
          />
        ) : null}
        <RowCount shown={shown} total={total} noun="keyword" />
        <div className="ml-auto flex items-center gap-2">
          <ColumnMenu columns={columns} />
          <ExportCsvButton
            subject={t("comparison.exportSubject")}
            disabled={shown === 0}
            onClick={onExport}
          />
        </div>
      </div>
      <FilterChips chips={chips} onClearAll={() => void setFilters(null)} />
    </div>
  );
}
