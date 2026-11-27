"use client";

import { useTranslations } from "next-intl";
import type { SetValues } from "nuqs";
import type { Row, Table } from "@tanstack/react-table";
import {
  KEYWORD_BUCKETS,
  KEYWORD_SOURCES,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { gradeFill } from "@/components/ui/graded";
import {
  GRADES,
  grade,
  gradeLabelInLocale,
  type GradeMetric,
} from "@/lib/grade";
import {
  KEYWORD_STATUSES,
  type keywordFilterParsers,
} from "@/lib/search-params";
import { countBy, POSITION_BANDS, positionBandOf } from "@/lib/table/facets";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  bucketLabel,
  positionBandLabel,
  statusLabel,
  tagOptions,
  type KeywordFilters,
} from "./keyword-filters";
import { keywordClassOptions } from "./keyword-class";
import { KeywordTypeTip } from "./KeywordTypeTip";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { shownScore } from "@/lib/keyword-scores";
import { sourceLabel } from "./SourceLabel";

type KeywordTable = Table<KeywordTableFeatures, TrackedKeywordItem>;
type KeywordRow = Row<KeywordTableFeatures, TrackedKeywordItem>;

function facetCounts<K>(
  table: KeywordTable,
  id: string,
  key: (row: KeywordRow) => K | null,
): Map<K, number> {
  return countBy(table.getColumn(id)?.getFacetedRowModel().rows ?? [], key);
}

function gradeCounts(table: KeywordTable, id: string, metric: GradeMetric) {
  return facetCounts(table, id, (row) =>
    grade(metric, shownScore(row.getValue<number | undefined>(id) ?? null)),
  );
}

function TagFacet({
  table,
  selected,
  setFilters,
  title,
}: {
  table: KeywordTable;
  selected: readonly string[];
  setFilters: SetValues<typeof keywordFilterParsers>;
  title: string;
}) {
  const counts = table.getColumn("tags")?.getFacetedUniqueValues() ?? new Map();
  const options = tagOptions(
    [...counts.keys()].filter((tag): tag is string => typeof tag === "string"),
    selected,
  );
  if (options.length === 0) return null;
  return (
    <FacetFilter
      title={title}
      options={options}
      selected={selected}
      counts={counts}
      onChange={(tag) => void setFilters({ tag })}
    />
  );
}

export function KeywordFacets({
  table,
  filters,
  setFilters,
}: {
  table: KeywordTable;
  filters: KeywordFilters;
  setFilters: SetValues<typeof keywordFilterParsers>;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const sourceOptions = KEYWORD_SOURCES.map((value) => ({
    value,
    label: sourceLabel(value, t),
  }));
  const bucketOptions = KEYWORD_BUCKETS.map((value) => ({
    value,
    label: bucketLabel(value, t),
  }));
  const statusOptions = KEYWORD_STATUSES.map((value) => ({
    value,
    label: statusLabel(value, t),
  }));
  const gradeOptions = GRADES.map((value) => ({
    value,
    label: gradeLabelInLocale(value, locale),
    swatch: gradeFill(value),
  }));
  const positionOptions = POSITION_BANDS.map((value) => ({
    value,
    label: positionBandLabel(value, t),
  }));

  return (
    <>
      <FacetFilter
        title={t("filters.position")}
        options={positionOptions}
        selected={filters.pos}
        counts={facetCounts(table, "position", (row) =>
          positionBandOf(row.original.latestPosition, row.original.latestDepth),
        )}
        onChange={(pos) => void setFilters({ pos })}
      />
      <FacetFilter
        title={t("filters.opportunity")}
        options={gradeOptions}
        selected={filters.opp}
        counts={gradeCounts(table, "opportunity", "opportunity")}
        onChange={(opp) => void setFilters({ opp })}
      />
      <FacetFilter
        title={t("filters.popularity")}
        options={gradeOptions}
        selected={filters.pop}
        counts={gradeCounts(table, "traffic", "popularity")}
        onChange={(pop) => void setFilters({ pop })}
      />
      <FacetFilter
        title={t("filters.difficulty")}
        options={gradeOptions}
        selected={filters.diff}
        counts={gradeCounts(table, "difficulty", "difficulty")}
        onChange={(diff) => void setFilters({ diff })}
      />
      <span className="inline-flex items-center gap-1">
        <FacetFilter
          title={t("filters.type")}
          options={keywordClassOptions(t)}
          selected={filters.type}
          counts={facetCounts(
            table,
            "type",
            (row) => row.original.keywordClass ?? null,
          )}
          onChange={(type) => void setFilters({ type })}
        />
        <KeywordTypeTip />
      </span>
      <TagFacet
        table={table}
        selected={filters.tag}
        setFilters={setFilters}
        title={t("filters.tags")}
      />
      <SelectFilter
        title={t("filters.status")}
        value={filters.status}
        options={statusOptions}
        onChange={(status) => void setFilters({ status })}
      />
      <FacetFilter
        title={t("filters.source")}
        options={sourceOptions}
        selected={filters.source}
        counts={facetCounts(table, "source", (row) => row.original.source)}
        onChange={(source) => void setFilters({ source })}
      />
      <FacetFilter
        title={t("filters.bucket")}
        options={bucketOptions}
        selected={filters.bucket}
        counts={facetCounts(table, "bucket", (row) => row.original.bucket)}
        onChange={(bucket) => void setFilters({ bucket })}
      />
    </>
  );
}
